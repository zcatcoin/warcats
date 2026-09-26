/* Provider contract: snapshot(timeSeconds) -> { camera, entities }.
   Positions and bones are world-space metres. Camera uses yaw/pitch radians.
   Replace SampleProvider only when a documented data source is available. */
const links = [[0,1],[1,2],[2,3],[1,4],[4,5],[5,6],[1,7],[7,8],[8,9],[3,10],[10,11],[11,12],[3,13],[13,14],[14,15]];

function project(point, camera, width, height) {
  const dx=point.x-camera.position.x, dy=point.y-camera.position.y, dz=point.z-camera.position.z;
  const cy=Math.cos(camera.yaw), sy=Math.sin(camera.yaw);
  const cp=Math.cos(camera.pitch), sp=Math.sin(camera.pitch);
  const x=cy*dx-sy*dz, z0=sy*dx+cy*dz;
  const y=cp*dy-sp*z0, z=sp*dy+cp*z0;
  if(z<=0.05) return null;
  const focal=height/(2*Math.tan(camera.fov*Math.PI/360));
  return {x:width/2+x*focal/z,y:height/2-y*focal/z};
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

if(typeof module!=='undefined') module.exports={project,SampleProvider};
if(typeof document!=='undefined') {
  const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
  const controls=Object.fromEntries(['boxes','bones','distance','friends','fov','fovLabel','pause'].map(id=>[id,document.getElementById(id)]));
  let paused=false,time=0,last=null;
  controls.pause.onclick=()=>{paused=!paused;controls.pause.textContent=paused?'Resume':'Pause';};
  function frame(now){
    if(last!==null&&!paused)time+=Math.min((now-last)/1000,.1);last=now;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const {camera,entities}=SampleProvider.snapshot(time);camera.fov=Number(controls.fov.value);controls.fovLabel.textContent=`${camera.fov}°`;
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
