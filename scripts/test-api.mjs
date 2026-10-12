import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787/api';
async function req(path,method='GET',data){const r=await fetch(base+path,{method,headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};}
const original=(await req('/export')).body;
try{
 const med={name:'接口验证药物',spec:'4mg/片',unit:'片',dose:1,frequency:1,route:'口服',startDate:'2026-10-12',endDate:'',note:'测试记录'};
 const m=await req('/medications','POST',med);assert.equal(m.status,201);const mid=m.body.data.id;
 const t=await req('/temperatures','POST',{measuredAt:'2026-10-12T10:00',value:38.1,method:'腋温',symptoms:['乏力'],note:'验证'});assert.equal(t.status,201);
 assert.equal((await req('/temperatures/'+t.body.data.id,'PUT',{...t.body.data,value:37.8})).status,200);
 assert.equal((await req('/medicationLogs','POST',{medicationId:mid,occurredAt:'2026-10-12T10:01',dose:1,missed:false,note:''})).status,201);
 assert.equal((await req('/labs','POST',{testedAt:'2026-10-12',name:'CRP',value:12,unit:'mg/L',reference:'0-8',hospital:'测试',note:''})).status,201);
 assert.equal((await req('/temperatures','POST',{measuredAt:'2026-02-30T10:00',value:55,method:'腋温',symptoms:[]})).status,400);
 const exported=(await req('/export')).body;assert.equal(exported.backupVersion,1);assert.ok(exported.temperatures.some(x=>x.value===37.8));assert.ok(exported.medicationLogs.some(x=>x.medicationId===mid));
 assert.equal((await req('/import','POST',{backupVersion:1})).status,400);
 assert.deepEqual((await req('/export')).body.temperatures,exported.temperatures);
 assert.equal((await req('/import','POST',exported)).status,200);
 assert.equal((await req('/medications/'+mid,'DELETE')).status,200);
 assert.ok(!(await req('/medicationLogs')).body.data.some(x=>x.medicationId===mid));
 assert.equal((await req('/temperatures/'+t.body.data.id,'DELETE')).status,200);
 const historyMed=(await req('/medications','POST',{...med,name:'历史方案验证',dose:4,startDate:'2026-10-01'})).body.data;
 await req('/medicationLogs','POST',{medicationId:historyMed.id,occurredAt:'2026-10-03T08:00',dose:4,missed:false,note:''});
 assert.equal((await req('/medications/'+historyMed.id,'PUT',{...historyMed,dose:2,effectiveDate:'2026-10-12',changeMode:'adjustment'})).status,200);
 const after=(await req('/export')).body;
 const old=after.medications.find(x=>x.name==='历史方案验证'&&x.dose===4);
 assert.equal(old.endDate,'2026-10-11');assert.equal(after.medications.find(x=>x.id===historyMed.id).startDate,'2026-10-12');
 assert.ok(after.events.some(e=>e.title==='开始用药：历史方案验证'&&e.occurredAt==='2026-10-01T00:00'));
 assert.ok(after.events.some(e=>e.title==='调整用药：历史方案验证'&&e.occurredAt==='2026-10-12T00:00'));
 assert.ok(after.medicationLogs.some(x=>x.medicationId===old.id&&x.dose===4));
 const invalid=structuredClone(after);invalid.temperatures.push({id:'a/b',schemaVersion:1,measuredAt:'2026-10-12T10:00',value:38,method:'腋温',symptoms:[],note:''});
 assert.equal((await req('/import','POST',invalid)).status,400);
 assert.equal((await req('/dashboard')).status,200);
 console.log('PASS: medication adjustment preserves old dose, effective date and actual logs; imported IDs validated');
 console.log('PASS: real D1 CRUD, edits, validation, backup round-trip, invalid import preservation, cascade deletion');
}finally{assert.equal((await req('/import','POST',original)).status,200);console.log('Restored original local data');}
