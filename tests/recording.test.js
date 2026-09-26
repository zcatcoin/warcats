const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateRecording,frameAt,sampleRecording}=require('../renderer.js');
test('sample recording round trips, includes moving camera and fits file limit',()=>{
  const json=JSON.stringify(sampleRecording(),null,2);assert.ok(Buffer.byteLength(json)<16*1024*1024);
  const r=validateRecording(JSON.parse(json));assert.equal(r.duration,10);assert.equal(r.frames.length,101);
  assert.notDeepEqual(r.frames[0].camera,r.frames[50].camera);
});
test('seeking holds latest frame and clamps to recording boundaries',()=>{
  const r=validateRecording(sampleRecording());
  for(const [t,expected] of [[-1,0],[0,0],[.099,0],[.1,.1],[.19,.1],[9.99,9.9],[10,10],[15,10]])assert.equal(frameAt(r,t).time,expected);
});
test('reject bad timestamps, frame counts and malformed nested snapshots',()=>{
  for(const edit of [x=>x.frames=[],x=>x.frames.length=1,x=>x.frames=Array(601).fill(x.frames[0]),x=>x.frames[0].time=1,x=>x.frames[1].time=0,x=>x.frames[1].time=NaN,x=>x.frames[2].time=3601,x=>x.frames[1].entities[0].bones=[],x=>x.units='cm',x=>x.kind='other']){
    const x=sampleRecording();edit(x);assert.throws(()=>validateRecording(x));
  }
});
test('empty entity frames replace previous players rather than retaining ghosts',()=>{
  const x=sampleRecording();x.frames[1].entities=[];const r=validateRecording(x);
  assert.equal(frameAt(r,.1).entities.length,0);assert.equal(frameAt(r,.2).entities.length,7);
});
