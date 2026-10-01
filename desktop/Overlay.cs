using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace Warcats {
    public sealed class Vec { public double x, y, z; }
    public sealed class Camera { public Vec position; public double yaw, pitch, roll, fov; }
    public sealed class Entity { public string id, team; public Vec position; public Vec[] bones; }
    public sealed class Snapshot {
        public int schemaVersion;
        public string units, coordinates;
        public Camera camera;
        public Entity[] entities;
    }
    public static class Scene {
        public static bool Finite(double n) { return !double.IsNaN(n) && !double.IsInfinity(n); }
        static bool Vector(Vec v) { return v != null && Finite(v.x) && Finite(v.y) && Finite(v.z) && Math.Abs(v.x) <= 1e7 && Math.Abs(v.y) <= 1e7 && Math.Abs(v.z) <= 1e7; }
        public static Snapshot Parse(string json) {
            var s = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Deserialize<Snapshot>(json);
            if (s == null || s.schemaVersion != 1 || s.units != "metres" || s.coordinates != "y-up-z-forward") throw new FormatException("Unsupported snapshot envelope");
            var c = s.camera;
            if (c == null || !Vector(c.position) || !Finite(c.yaw) || !Finite(c.pitch) || !Finite(c.roll) || !Finite(c.fov) || c.fov < 1 || c.fov > 179 || Math.Abs(c.yaw) > Math.PI * 2 || Math.Abs(c.pitch) > Math.PI / 2 || Math.Abs(c.roll) > Math.PI * 2) throw new FormatException("Invalid camera");
            if (s.entities == null || s.entities.Length > 256) throw new FormatException("Invalid entity count");
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var e in s.entities) {
                if (e == null || string.IsNullOrEmpty(e.id) || e.id.Length > 80 || !ids.Add(e.id) || (e.team != "enemy" && e.team != "friendly") || !Vector(e.position) || e.bones == null || e.bones.Length != 16 || e.bones.Any(v => !Vector(v))) throw new FormatException("Invalid entity");
            }
            return s;
        }
        public static PointF? Project(Vec p, Camera c, int w, int h) {
            double dx = p.x - c.position.x, dy = p.y - c.position.y, dz = p.z - c.position.z;
            double x = Math.Cos(c.yaw) * dx - Math.Sin(c.yaw) * dz;
            double z0 = Math.Sin(c.yaw) * dx + Math.Cos(c.yaw) * dz;
            double y = Math.Cos(c.pitch) * dy - Math.Sin(c.pitch) * z0;
            double z = Math.Sin(c.pitch) * dy + Math.Cos(c.pitch) * z0;
            if (z <= .05) return null;
            double f = h / (2 * Math.Tan(c.fov * Math.PI / 360));
            double px = w / 2.0 + (Math.Cos(c.roll) * x + Math.Sin(c.roll) * y) * f / z;
            double py = h / 2.0 - (-Math.Sin(c.roll) * x + Math.Cos(c.roll) * y) * f / z;
            if (!Finite(px) || !Finite(py) || Math.Abs(px) > 1e7 || Math.Abs(py) > 1e7) return null;
            return new PointF((float)px, (float)py);
        }
        public static bool Fresh(DateTime written, DateTime now) {
            var age = (now - written).TotalMilliseconds;
            return age >= -100 && age <= 500;
        }
    }
    public sealed class Overlay : Form {
        [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X, Y; }
        [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out Rect r);
        [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref NativePoint p);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint key);
        [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
        static readonly int[,] Links = {{0,1},{1,2},{2,3},{1,4},{4,5},{5,6},{1,7},{7,8},{8,9},{3,10},{10,11},{11,12},{3,13},{13,14},{14,15}};
        readonly Process target;
        readonly string path;
        readonly Timer timer = new Timer { Interval = 16 };
        readonly Font label = new Font("Segoe UI", 10);
        readonly ContextMenuStrip menu = new ContextMenuStrip();
        readonly NotifyIcon tray;
        Snapshot scene;
        DateTime loadedWrite = DateTime.MinValue;
        bool boxes = true, skeletons = true, distances = true, teammates = true, shown = true;
        public Overlay(int pid, string file) {
            SetProcessDPIAware();
            target = Process.GetProcessById(pid);
            path = Path.GetFullPath(file);
            FormBorderStyle = FormBorderStyle.None;
            BackColor = Color.Magenta;
            TransparencyKey = Color.Magenta;
            ShowInTaskbar = false;
            TopMost = true;
            DoubleBuffered = true;
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.Manual;
            Bounds = new Rectangle(-10000, -10000, 1, 1);
            Toggle("Boxes", v => boxes = v);
            Toggle("Skeletons", v => skeletons = v);
            Toggle("Distances", v => distances = v);
            Toggle("Teammates", v => teammates = v);
            Toggle("Show overlay", v => shown = v);
            menu.Items.Add("Exit", null, (s, e) => Close());
            tray = new NotifyIcon { Icon = SystemIcons.Information, Text = "Warcats: waiting for data", ContextMenuStrip = menu, Visible = true };
            timer.Tick += (s, e) => UpdateFrame();
            timer.Start();
        }
        void Toggle(string name, Action<bool> action) {
            var item = new ToolStripMenuItem(name) { Checked = true, CheckOnClick = true };
            item.CheckedChanged += (s, e) => action(item.Checked);
            menu.Items.Add(item);
        }
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams {
            get { var p = base.CreateParams; p.ExStyle |= 0x20 | 0x80000 | 0x8000000 | 0x80; return p; }
        }
        protected override void OnHandleCreated(EventArgs e) {
            base.OnHandleCreated(e);
            RegisterHotKey(Handle, 1, 0x4000 | 0x2 | 0x4, (uint)Keys.End);
        }
        protected override void WndProc(ref Message m) {
            if (m.Msg == 0x312 && m.WParam.ToInt32() == 1) { Close(); return; }
            if (m.Msg == 0x84) { m.Result = new IntPtr(-1); return; }
            base.WndProc(ref m);
        }
        void UpdateFrame() {
            if (target.HasExited) { Close(); return; }
            target.Refresh();
            IntPtr h = target.MainWindowHandle;
            Rect r;
            var origin = new NativePoint();
            if (!shown || h == IntPtr.Zero || IsIconic(h) || GetForegroundWindow() != h || !GetClientRect(h, out r) || !ClientToScreen(h, ref origin) || r.Right <= 0 || r.Bottom <= 0) { Hide(); return; }
            Bounds = new Rectangle(origin.X, origin.Y, r.Right, r.Bottom);
            try {
                var info = new FileInfo(path);
                if (!info.Exists || !Scene.Fresh(info.LastWriteTimeUtc, DateTime.UtcNow)) { scene = null; loadedWrite = DateTime.MinValue; tray.Text = "Warcats: no fresh data"; }
                else if (info.LastWriteTimeUtc != loadedWrite) {
                    if (info.Length > 16 * 1024 * 1024) throw new FormatException("Snapshot too large");
                    var write = info.LastWriteTimeUtc;
                    var candidate = Scene.Parse(File.ReadAllText(path));
                    scene = candidate;
                    loadedWrite = write;
                    tray.Text = "Warcats: receiving snapshots (source unverified)";
                }
            } catch (Exception ex) {
                if (!(ex is IOException || ex is UnauthorizedAccessException || ex is FormatException || ex is ArgumentException || ex is InvalidOperationException)) throw;
                scene = null;
                loadedWrite = DateTime.MinValue;
                tray.Text = "Warcats: invalid or unavailable snapshot";
            }
            if (!Visible) Show();
            Invalidate();
        }
        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);
            var g = e.Graphics;
            // No demo entities: an absent or stale source draws only this status.
            g.DrawString(scene == null ? "WARCATS | NO FRESH DATA | Ctrl+Shift+End to exit" : "WARCATS | EXTERNAL SNAPSHOTS | Ctrl+Shift+End to exit", label, Brushes.White, 12, 12);
            if (scene == null) return;
            foreach (var entity in scene.entities) {
                if (!teammates && entity.team == "friendly") continue;
                var points = entity.bones.Select(v => Scene.Project(v, scene.camera, ClientSize.Width, ClientSize.Height)).ToArray();
                if (points.Any(projected => !projected.HasValue)) continue;
                var p = points.Select(v => v.Value).ToArray();
                float left = p.Min(v => v.X) - 5, top = p.Min(v => v.Y) - 5, right = p.Max(v => v.X) + 5, bottom = p.Max(v => v.Y) + 5;
                if (right < 0 || left > Width || bottom < 0 || top > Height) continue;
                var color = entity.team == "friendly" ? Color.Aquamarine : Color.Salmon;
                using (var pen = new Pen(color, 1.5f)) using (var brush = new SolidBrush(color)) {
                    if (boxes) g.DrawRectangle(pen, left, top, right - left, bottom - top);
                    if (skeletons) for (int i = 0; i < Links.GetLength(0); i++) g.DrawLine(pen, p[Links[i,0]], p[Links[i,1]]);
                    if (distances) {
                        double dx = entity.position.x - scene.camera.position.x, dy = entity.position.y - scene.camera.position.y, dz = entity.position.z - scene.camera.position.z;
                        g.DrawString(Math.Sqrt(dx*dx + dy*dy + dz*dz).ToString("F1") + " m", label, brush, left, bottom + 2);
                    }
                }
            }
        }
        protected override void Dispose(bool disposing) {
            if (disposing) { timer.Stop(); timer.Dispose(); tray.Visible = false; tray.Dispose(); menu.Dispose(); label.Dispose(); target.Dispose(); if (IsHandleCreated) UnregisterHotKey(Handle, 1); }
            base.Dispose(disposing);
        }
    }
    static class Program {
        [STAThread] static void Main(string[] args) {
            try {
                if (args.Length == 2 && args[0] == "--self-test") { SelfTest(); File.WriteAllText(args[1], "PASS: projection, roll, clipping, input rejection and freshness\n"); return; }
                if (args.Length != 2) throw new ArgumentException("Usage: WarcatsOverlay.exe PROCESS_ID SNAPSHOT_PATH");
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new Overlay(int.Parse(args[0]), args[1]));
            } catch (Exception ex) {
                if (args.Length == 2 && args[0] == "--self-test") { File.WriteAllText(args[1], "FAIL: " + ex); Environment.ExitCode = 1; }
                else MessageBox.Show(ex.Message, "Warcats overlay", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
        static void SelfTest() {
            var c = new Camera { position = new Vec(), fov = 90 };
            var center = Scene.Project(new Vec { z = 10 }, c, 1920, 1080).Value;
            Check(center.X == 960 && center.Y == 540, "Center projection");
            Check(Scene.Project(new Vec { x = 10, z = 10 }, c, 1920, 1080).Value.X == 1500, "Vertical FOV aspect scaling");
            Check(!Scene.Project(new Vec { z = -.1 }, c, 1920, 1080).HasValue, "Behind camera clipped");
            c.roll = Math.PI / 2;
            Check(Math.Abs(Scene.Project(new Vec { x = 10, z = 10 }, c, 1920, 1080).Value.Y - 1080) < .01, "Camera roll");
            var now = DateTime.UtcNow;
            Check(Scene.Fresh(now.AddMilliseconds(-100), now) && !Scene.Fresh(now.AddMilliseconds(-501), now) && !Scene.Fresh(now.AddSeconds(10), now), "Stale/future rejection");
            const string valid = "{\"schemaVersion\":1,\"units\":\"metres\",\"coordinates\":\"y-up-z-forward\",\"camera\":{\"position\":{\"x\":0,\"y\":0,\"z\":0},\"yaw\":0,\"pitch\":0,\"fov\":75},\"entities\":[]}";
            Check(Scene.Parse(valid).entities.Length == 0, "Empty scene accepted");
            foreach (var bad in new [] { "null", "{}", valid.Replace("75", "0"), valid.Replace("metres", "centimetres"), valid.Replace("[]", "[null]") }) {
                bool rejected = false;
                try { Scene.Parse(bad); } catch (Exception) { rejected = true; }
                Check(rejected, "Malformed snapshot accepted");
            }
        }
    }
}
