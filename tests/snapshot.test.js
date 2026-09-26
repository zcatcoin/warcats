const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project,SampleProvider,validateSnapshot}=require('../renderer.js');
const fixture=()=>({schemaVersion:1,units:'metres',coordinates:'y-up-z-forward',...SampleProvider.snapshot(0)});
test('export-shaped JSON round trips and preserves imported camera',()=>{
  const input=fixture();input.camera.fov=120;input.camera.roll=.3;
  const result=validateSnapshot(JSON.parse(JSON.stringify(input)));
  assert.equal(result.camera.fov,120);assert.equal(result.camera.roll,.3);
  assert.deepEqual(result.entities,input.entities);
  result.entities[0].bones[0].x=900;assert.notEqual(input.entities[0].bones[0].x,900);
});
test('reject malformed, mismatched, oversized and non-finite snapshots',()=>{
  for(const edit of [x=>x.units='centimetres',x=>x.camera.fov=0,x=>x.camera.position.x=Infinity,x=>x.entities[0].bones.pop(),x=>x.entities[0].team='unknown',x=>x.entities[1].id=x.entities[0].id,x=>x.entities=Array(257).fill(x.entities[0])]){
    const input=fixture();edit(input);assert.throws(()=>validateSnapshot(input));
  }
  for(const value of [null,{},[],{schemaVersion:1}])assert.throws(()=>validateSnapshot(value));
});
test('allow an empty scene',()=>{const x=fixture();x.entities=[];assert.equal(validateSnapshot(x).entities.length,0);});
test('projection follows camera translation, yaw and roll; clips rear points',()=>{
  const camera={position:{x:2,y:3,z:4},yaw:0,pitch:0,fov:90};
  assert.deepEqual(project({x:2,y:3,z:14},camera,800,600),{x:400,y:300});
  assert.equal(project({x:2,y:3,z:3},camera,800,600),null);
  camera.yaw=Math.PI/2;assert.ok(Math.abs(project({x:12,y:3,z:4},camera,800,600).x-400)<1e-8);
  camera.yaw=0;camera.roll=Math.PI/2;
  const rolled=project({x:12,y:3,z:14},camera,800,600);
  assert.ok(Math.abs(rolled.x-400)<1e-8);assert.ok(Math.abs(rolled.y-600)<1e-8);
});
