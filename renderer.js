/* Provider contract: snapshot(timeSeconds) -> { camera, entities }.
   Positions and bones are world-space metres. Camera uses yaw/pitch radians.
   Replace SampleProvider only when a documented data source is available. */
const links = [[0,1],[1,2],[2,3],[1,4],[4,5],[5,6],[1,7],[7,8],[8,9],[3,10],[10,11],[11,12],[3,13],[13,14],[14,15]];

function validateSnapshot(input) {
  const fail=message=>{throw new Error(message);};
  const finite=(n,label,limit=1e7)=>{
    if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>limit)fail(`${label} must be a finite number within ±${limit}.`);
    return n;
  };
  const vector=(v,label)=>({x:finite(v?.x,`${label}.x`),y:finite(v?.y,`${label}.y`),z:finite(v?.z,`${label}.z`)});
  if(input?.schemaVersion!==1||input?.units!=='metres'||input?.coordinates!=='y-up-z-forward')fail('Expected schemaVersion 1, units metres and coordinates y-up-z-forward.');
  const c=input.camera;
  const camera={position:vector(c?.position,'camera.position'),yaw:finite(c?.yaw,'camera.yaw',Math.PI*2),pitch:finite(c?.pitch,'camera.pitch',Math.PI/2),roll:finite(c?.roll??0,'camera.roll',Math.PI*2),fov:finite(c?.fov,'camera.fov',179)};
  if(camera.fov<1)fail('Vertical FOV must be between 1 and 179 degrees.');
  if(!Array.isArray(input.entities)||input.entities.length>256)fail('Expected at most 256 entities.');
  const ids=new Set();
  const entities=input.entities.map((e,i)=>{
    if(typeof e?.id!=='string'||!e.id.length||e.id.length>80||ids.has(e.id))fail(`Entity ${i} needs a unique ID of 1–80 characters.`);
    ids.add(e.id);
    if(!['friendly','enemy'].includes(e.team))fail(`Entity ${i} has an invalid team.`);
    if(!Array.isArray(e.bones)||e.bones.length!==16)fail(`Entity ${i} needs exactly 16 world-space bones in the documented order.`);
    return {id:e.id,team:e.team,position:vector(e.position,`entity ${i}`),bones:e.bones.map((b,j)=>vector(b,`entity ${i} bone ${j}`))};
  });
  return {camera,entities};
}

function validateRecording(input) {
  if(input?.kind!=='recording'||!Array.isArray(input.frames)||input.frames.length<2||input.frames.length>600)
    throw new Error('Recording needs 2–600 frames and kind recording.');
  let previous=-1;
  const frames=input.frames.map((frame,i)=>{
    if(typeof frame?.time!=='number'||!Number.isFinite(frame.time)||frame.time<=previous||frame.time>3600||(i===0&&frame.time!==0))
      throw new Error(`Frame ${i}: times must start at zero and strictly increase, up to 3600 seconds.`);
    previous=frame.time;
    return {time:frame.time,...validateSnapshot({schemaVersion:input.schemaVersion,units:input.units,coordinates:input.coordinates,camera:frame.camera,entities:frame.entities})};
  });
  return {frames,duration:frames.at(-1).time};
}

// Hold the latest recorded frame: never invent intermediate entity or camera state.
function frameAt(recording,time) {
  let lo=0,hi=recording.frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(recording.frames[mid].time<=time)lo=mid;else hi=mid-1;}
  return recording.frames[lo];
}

function project(point, camera, width, height) {
  const dx=point.x-camera.position.x, dy=point.y-camera.position.y, dz=point.z-camera.position.z;
  const cy=Math.cos(camera.yaw), sy=Math.sin(camera.yaw);
  const cp=Math.cos(camera.pitch), sp=Math.sin(camera.pitch);
  const x=cy*dx-sy*dz, z0=sy*dx+cy*dz;
  const y=cp*dy-sp*z0, z=sp*dy+cp*z0;
  if(z<=0.05) return null;
  const focal=height/(2*Math.tan(camera.fov*Math.PI/360));
  const cr=Math.cos(camera.roll??0),sr=Math.sin(camera.roll??0);
  return {x:width/2+(cr*x+sr*y)*focal/z,y:height/2-(-sr*x+cr*y)*focal/z};
}

const SampleProvider={snapshot(t){
  const entities=Array.from({length:7},(_,i)=>{
    const position={x:(i-3)*3+Math.sin(t*.5+i)*1.5,y:0,z:12+(i%3)*9+Math.sin(t*.3+i)*3};
    const swing=Math.sin(t*3+i)*.18;
    const local=[[0,1.8,0],[0,1.52,0],[0,1.2,0],[0,.95,0],[-.3,1.5,0],[-.43,1.2,swing],[-.45,.95,swing],[.3,1.5,0],[.43,1.2,-swing],[.45,.95,-swing],[-.16,.9,0],[-.19,.48,-swing],[-.2,.05,-swing],[.16,.9,0],[.19,.48,swing],[.2,.05,swing]];
    return {id:`Sample ${i+1}`,team:i%3===0?'friendly':'enemy',position,bones:local.map(([x,y,z])=>({x:x+position.x,y:y+position.y,z:z+position.z}))};
  });
  return {camera:{position:{x:0,y:1.7,z:0},yaw:0,pitch:0,fov:75},entities};
}};

function sampleRecording() {
  return {schemaVersion:1,units:'metres',coordinates:'y-up-z-forward',kind:'recording',frames:Array.from({length:101},(_,i)=>{
    const t=i/10,scene=SampleProvider.snapshot(t);
    scene.camera.position.x=Math.sin(t*.6)*2;scene.camera.yaw=Math.sin(t*.4)*.15;
    scene.camera.roll=Math.sin(t*.5)*.04;
    return {time:t,...scene};
  })};
}

if(typeof module!=='undefined') module.exports={project,SampleProvider,validateSnapshot,validateRecording,frameAt,sampleRecording};
if(typeof document!=='undefined') {
  const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
  const controls=Object.fromEntries(['boxes','bones','distance','friends','fov','fovLabel','pause'].map(id=>[id,document.getElementById(id)]));
  let paused=false,time=0,last=null;
  let imported=null,recording=null,playhead=0,loadId=0;
  const timeline=document.getElementById('timeline'),speed=document.getElementById('speed'),clock=document.getElementById('clock');
  function resetPlayback(){playhead=0;paused=false;last=null;controls.pause.textContent='Pause';timeline.value=0;timeline.disabled=!recording;speed.disabled=!recording;timeline.max=recording?.duration??1;clock.textContent=recording?`0.0 / ${recording.duration.toFixed(1)} s`:'No recording loaded';}
  const source=document.getElementById('source'),error=document.getElementById('error'),fileInput=document.getElementById('snapshot');
  fileInput.onchange=async()=>{
    const id=++loadId,file=fileInput.files[0];if(!file)return;
    try {
      if(file.size>16*1024*1024)throw new Error('File must be smaller than 16 MiB.');
      const data=JSON.parse(await file.text()),isRecording=data?.kind==='recording';
      const candidate=isRecording?validateRecording(data):validateSnapshot(data);
      if(id!==loadId)return;
      recording=isRecording?candidate:null;imported=isRecording?null:candidate;error.textContent='';resetPlayback();
      source.textContent=`${isRecording?'RECORDED FILE':'IMPORTED SNAPSHOT'} · ${file.name} · No live connection`;
      controls.fov.disabled=true;controls.pause.disabled=!isRecording;
    } catch(e){if(id===loadId)error.textContent=`Import failed: ${e.message} Current scene retained.`;}
    finally{if(id===loadId)fileInput.value='';}
  };
  document.getElementById('sample').onclick=()=>{
    ++loadId;imported=null;recording=null;resetPlayback();fileInput.value='';error.textContent='';
    controls.fov.disabled=false;controls.pause.disabled=false;
    source.textContent='SAMPLE DATA · No connection to WARDOGS';
  };
  function download(data,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.getElementById('exportRecording').onclick=()=>download(sampleRecording(),'sample-recording.json');
  document.getElementById('export').onclick=()=>{
    const snapshot={schemaVersion:1,units:'metres',coordinates:'y-up-z-forward',...SampleProvider.snapshot(time)};
    snapshot.camera.fov=Number(controls.fov.value);
    download(snapshot,'sample-snapshot.json');
  };
  timeline.oninput=()=>{if(recording){playhead=Number(timeline.value);paused=true;controls.pause.textContent='Resume';}};
  controls.pause.onclick=()=>{if(recording&&playhead>=recording.duration){playhead=0;paused=false;}else paused=!paused;last=null;controls.pause.textContent=paused?'Resume':'Pause';};
  function frame(now){
    const dt=last===null?0:Math.min((now-last)/1000,.1);last=now;
    if(!paused){
      if(recording){playhead=Math.min(recording.duration,playhead+dt*Number(speed.value));if(playhead>=recording.duration){paused=true;controls.pause.textContent='Replay';}}
      else if(!imported)time+=dt;
    }
    if(recording){timeline.value=playhead;clock.textContent=`${playhead.toFixed(1)} / ${recording.duration.toFixed(1)} s`;}
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const {camera,entities}=recording?frameAt(recording,playhead):(imported??SampleProvider.snapshot(time));if(!imported&&!recording)camera.fov=Number(controls.fov.value);controls.fovLabel.textContent=`${camera.fov}°`;
    const p=v=>project(v,camera,w,h);
    function line(a,b,color,width=1){if(!a||!b)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(let z=5;z<=80;z+=5)line(p({x:-50,y:0,z}),p({x:50,y:0,z}),'#1d2b3d');
    for(let x=-50;x<=50;x+=5)line(p({x,y:0,z:2}),p({x,y:0,z:80}),'#1d2b3d');
    for(const e of entities){
      if(e.team==='friendly'&&!controls.friends.checked)continue;
      const points=e.bones.map(p);if(points.some(v=>!v))continue;
      const color=e.team==='friendly'?'#55dcb4':'#ff7d83';
      const minX=Math.min(...points.map(v=>v.x))-7,maxX=Math.max(...points.map(v=>v.x))+7;
      const minY=Math.min(...points.map(v=>v.y))-7,maxY=Math.max(...points.map(v=>v.y))+7;
      if(maxX<0||minX>w||maxY<0||minY>h)continue;
      if(controls.boxes.checked){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.strokeRect(minX,minY,maxX-minX,maxY-minY);}
      if(controls.bones.checked)for(const [a,b]of links)line(points[a],points[b],color,2);
      const metres=Math.hypot(e.position.x-camera.position.x,e.position.y-camera.position.y,e.position.z-camera.position.z);
      ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle=color;
      ctx.fillText(e.id,(minX+maxX)/2,minY-8);
      if(controls.distance.checked)ctx.fillText(`${metres.toFixed(1)} m`,(minX+maxX)/2,maxY+17);
    }
    line({x:w/2-5,y:h/2},{x:w/2+5,y:h/2},'#91a3bb');line({x:w/2,y:h/2-5},{x:w/2,y:h/2+5},'#91a3bb');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
