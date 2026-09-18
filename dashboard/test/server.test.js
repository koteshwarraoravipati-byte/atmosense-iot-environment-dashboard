const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atmosense-test-'));
process.env.NODE_ENV='test';
process.env.AUTH_PROVIDER='demo';
process.env.MOCK_DATA='false';
process.env.AWS_IOT_ENDPOINT='';
process.env.DATA_DIR=tmp;
const {app}=require('../server');
let server;
let base;
let cookie='';

test.before(async()=>{await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${server.address().port}`;resolve()})})});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(tmp,{recursive:true,force:true})});

async function request(route,options={}){const headers={...(options.headers||{})};if(cookie)headers.cookie=cookie;const response=await fetch(`${base}${route}`,{...options,headers});const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];let body;const type=response.headers.get('content-type')||'';body=type.includes('json')?await response.json():await response.text();return{response,body}}

test('protects dashboard APIs before login',async()=>{const {response}=await request('/api/devices');assert.equal(response.status,401)});
test('supports demo signup and protected device/settings flows',async()=>{
  let result=await request('/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Test User',email:'test@example.com',password:'password123'})});
  assert.equal(result.response.status,201);assert.ok(cookie);
  result=await request('/api/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'classroom-01',name:'Classroom Sensor',location:'Lab'})});
  assert.equal(result.response.status,201);assert.equal(result.body.id,'classroom-01');
  result=await request('/api/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({alertsEnabled:true,temperatureLow:40,temperatureHigh:20,humidityLow:30,humidityHigh:70})});
  assert.equal(result.response.status,400);
  result=await request('/api/settings');assert.equal(result.response.status,200);assert.equal(result.body.temperatureLow,18);
  result=await request('/api/export.csv');assert.equal(result.response.status,200);assert.match(result.body,/received_at,device_id/);
});
test('rejects malformed signup data',async()=>{cookie='';const {response}=await request('/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'x',email:'not-an-email',password:'short'})});assert.equal(response.status,400)});
