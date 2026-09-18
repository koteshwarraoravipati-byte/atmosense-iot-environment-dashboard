require('dotenv').config();
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const express=require('express');
const mqtt=require('mqtt');
const {createClient}=require('@supabase/supabase-js');

const PORT=Number(process.env.PORT||3000);
const ENDPOINT=process.env.AWS_IOT_ENDPOINT;
const TOPIC=process.env.MQTT_TOPIC||'environment/dht11';
const CERT_DIR=process.env.CERT_DIR||'../secrets';
const MOCK=String(process.env.MOCK_DATA||'false').toLowerCase()==='true';
const AUTH_PROVIDER=String(process.env.AUTH_PROVIDER||'demo').toLowerCase();
const SUPABASE_URL=process.env.SUPABASE_URL||'';
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY||'';
const SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const IS_SUPABASE=AUTH_PROVIDER==='supabase'&&Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);
const IS_PRODUCTION=process.env.NODE_ENV==='production';

if(AUTH_PROVIDER==='supabase'&&!IS_SUPABASE)throw new Error('AUTH_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_ANON_KEY');
if(IS_PRODUCTION&&AUTH_PROVIDER==='demo')console.warn('WARNING: demo authentication is enabled in production. Use AUTH_PROVIDER=supabase.');

const app=express();
app.set('trust proxy',1);
const clients=new Set();
const sessions=new Map();
const rateBuckets=new Map();
const USERS_FILE=path.join(DATA_DIR,'users.json');
const HISTORY_FILE=path.join(DATA_DIR,'telemetry.json');
const DEVICES_FILE=path.join(DATA_DIR,'devices.json');
const SETTINGS_FILE=path.join(DATA_DIR,'settings.json');
fs.mkdirSync(DATA_DIR,{recursive:true});

const defaults={alertsEnabled:true,temperatureLow:18,temperatureHigh:32,humidityLow:30,humidityHigh:70};
const seedDevices=[{id:'demo-esp32-dht11',name:'Demo Classroom Sensor',location:'Atmosense Lab',type:'ESP32 + DHT11',enabled:true,last_seen:null}];
function ensureFile(file,value){if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(value,null,2))}
ensureFile(USERS_FILE,[]);ensureFile(HISTORY_FILE,[]);ensureFile(DEVICES_FILE,seedDevices);ensureFile(SETTINGS_FILE,defaults);
function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJSON(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2))}
let recent=readJSON(HISTORY_FILE,[]).slice(-2000);
let devices=readJSON(DEVICES_FILE,seedDevices);
let settings={...defaults,...readJSON(SETTINGS_FILE,defaults)};

function securityHeaders(_req,res,next){res.set({
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
});next()}
app.use(securityHeaders);
app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public')));

function clientIp(req){return String(req.ip||req.socket.remoteAddress||'unknown')}
function rateLimit({windowMs=60000,max=30}={}){return(req,res,next)=>{const key=`${req.path}:${clientIp(req)}`,now=Date.now(),entry=rateBuckets.get(key);if(!entry||now-entry.startedAt>windowMs){rateBuckets.set(key,{startedAt:now,count:1});return next()}entry.count+=1;if(entry.count>max)return res.status(429).json({error:'Too many requests. Try again shortly.'});next()}}
function cleanUser(u){return{id:u.id,name:u.name,email:u.email}}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`}
function validPassword(password,stored){try{const [salt,key]=stored.split(':');return crypto.timingSafeEqual(Buffer.from(key,'hex'),crypto.scryptSync(password,salt,64))}catch{return false}}
function bearerToken(req){const value=String(req.headers.authorization||'');return value.startsWith('Bearer ')?value.slice(7).trim():''}
function sessionUser(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('atmosense_session='))?.split('=')[1];return token?sessions.get(token):null}
function setSession(res,user){const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user);const secure=IS_PRODUCTION?'; Secure':'';res.setHeader('Set-Cookie',`atmosense_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`)}
function clearSession(res){res.setHeader('Set-Cookie',`atmosense_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${IS_PRODUCTION?'; Secure':''}`)}
async function requireSession(req,res,next){
  if(!IS_SUPABASE){const user=sessionUser(req);if(!user)return res.status(401).json({error:'Sign in required'});req.authUser=user;return next()}
  const token=bearerToken(req);if(!token)return res.status(401).json({error:'A Supabase bearer token is required'});
  try{const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});const {data,error}=await supabase.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:'Invalid or expired Supabase session'});req.authUser=data.user;req.supabase=supabase;req.authToken=token;next()}catch(error){console.error('Supabase auth validation failed:',error.message);res.status(503).json({error:'Authentication service unavailable'})}
}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
function normalizeReading(reading){const temperature=Number(reading.temperature_c),humidity=Number(reading.humidity_percent);if(!Number.isFinite(temperature)||temperature<-80||temperature>100||!Number.isFinite(humidity)||humidity<0||humidity>100)return null;const rssi=reading.rssi_dbm==null?null:Number(reading.rssi_dbm);return{device_id:String(reading.device_id||'unknown-device').slice(0,100),temperature_c:temperature,humidity_percent:humidity,rssi_dbm:Number.isFinite(rssi)?rssi:null,sample_time:reading.sample_time||null,timestamp_ms:reading.timestamp_ms||null,received_at:new Date().toISOString()}}
function alertFor(r,s){if(!s.alertsEnabled)return[];const out=[];if(r.temperature_c<s.temperatureLow)out.push({type:'temperature_low',message:`Temperature below ${s.temperatureLow}°C`});if(r.temperature_c>s.temperatureHigh)out.push({type:'temperature_high',message:`Temperature above ${s.temperatureHigh}°C`});if(r.humidity_percent<s.humidityLow)out.push({type:'humidity_low',message:`Humidity below ${s.humidityLow}%`});if(r.humidity_percent>s.humidityHigh)out.push({type:'humidity_high',message:`Humidity above ${s.humidityHigh}%`});return out}
function mapDevice(d){return{id:d.id,name:d.name,location:d.location||'Unassigned',type:d.type||d.device_type||'ESP32 sensor',enabled:d.enabled!==false,last_seen:d.last_seen||null,online:d.last_seen?Date.now()-new Date(d.last_seen).getTime()<120000:false}}
function mapTelemetry(r){return{device_id:r.device_id,temperature_c:Number(r.temperature_c),humidity_percent:Number(r.humidity_percent),rssi_dbm:r.rssi_dbm==null?null:Number(r.rssi_dbm),sample_time:r.sample_time||null,timestamp_ms:r.timestamp_ms||null,received_at:r.received_at||r.recorded_at}}

app.get('/api/config',(_req,res)=>res.json({authProvider:IS_SUPABASE?'supabase':'demo',supabaseUrl:IS_SUPABASE?SUPABASE_URL:'',supabaseAnonKey:IS_SUPABASE?SUPABASE_ANON_KEY:'',liveMode:Boolean(ENDPOINT&&!MOCK)}));
const readUsers=()=>readJSON(USERS_FILE,[]);const saveUsers=users=>writeJSON(USERS_FILE,users);
app.post('/api/auth/signup',rateLimit({max:10}), (req,res)=>{if(IS_SUPABASE)return res.status(400).json({error:'Use Supabase Auth for signup'});const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(name.length<2||name.length>100||!validEmail(email)||password.length<8||password.length>200)return res.status(400).json({error:'Enter a valid name, email, and password between 8 and 200 characters.'});const users=readUsers();if(users.some(u=>u.email===email))return res.status(409).json({error:'An account with this email already exists.'});const user={id:crypto.randomUUID(),name,email,passwordHash:hashPassword(password),createdAt:new Date().toISOString()};users.push(user);saveUsers(users);const safe=cleanUser(user);setSession(res,safe);res.status(201).json(safe)});
app.post('/api/auth/login',rateLimit({max:10}), (req,res)=>{if(IS_SUPABASE)return res.status(400).json({error:'Use Supabase Auth for login'});const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(!validEmail(email)||password.length>200)return res.status(400).json({error:'Enter a valid email and password.'});const user=readUsers().find(u=>u.email===email);if(!user||!validPassword(password,user.passwordHash))return res.status(401).json({error:'Email or password is incorrect.'});const safe=cleanUser(user);setSession(res,safe);res.json(safe)});
app.get('/api/auth/me',async(req,res)=>{if(!IS_SUPABASE){const user=sessionUser(req);if(!user)return res.status(401).json({error:'Not signed in'});return res.json(user)}return requireSession(req,res,()=>res.json({id:req.authUser.id,email:req.authUser.email,name:req.authUser.user_metadata?.full_name||req.authUser.email}))});
app.post('/api/auth/logout',(req,res)=>{if(!IS_SUPABASE){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('atmosense_session='))?.split('=')[1];if(token)sessions.delete(token)}clearSession(res);res.json({ok:true})});

async function supabaseDevices(req){const {data,error}=await req.supabase.from('devices').select('*').order('name');if(error)throw error;return(data||[]).map(mapDevice)}
async function supabaseSettings(req){const {data,error}=await req.supabase.from('alert_settings').select('*').maybeSingle();if(error)throw error;return data?{alertsEnabled:data.enabled,temperatureLow:Number(data.temperature_low),temperatureHigh:Number(data.temperature_high),humidityLow:Number(data.humidity_low),humidityHigh:Number(data.humidity_high)}:defaults}
function safeHours(value){const hours=String(value||'24');return ['1','24','168','all'].includes(hours)?hours:'24'}
async function supabaseHistory(req,hours,deviceId='all',limit=2000){hours=safeHours(hours);let query=req.supabase.from('telemetry').select('device_id,temperature_c,humidity_percent,rssi_dbm,recorded_at').order('recorded_at',{ascending:true}).limit(limit);if(hours!=='all')query=query.gte('recorded_at',new Date(Date.now()-Number(hours)*3600000).toISOString());if(deviceId!=='all')query=query.eq('device_id',deviceId);const {data,error}=await query;if(error)throw error;return(data||[]).map(mapTelemetry)}

app.get('/api/latest',requireSession,async(req,res)=>{try{if(IS_SUPABASE){const history=await supabaseHistory(req,'all','all',1);return res.json({latest:history.at(-1)||null,recent:history,devices:await supabaseDevices(req),settings:await supabaseSettings(req)})}res.json({latest:recent.at(-1)||null,recent:recent.slice(-60),devices:devices.map(mapDevice),settings})}catch(error){res.status(500).json({error:'Unable to load dashboard data'})}});
app.get('/api/history',requireSession,async(req,res)=>{try{const hours=safeHours(req.query.hours),deviceId=String(req.query.deviceId||'all').slice(0,100);if(IS_SUPABASE)return res.json({history:await supabaseHistory(req,hours,deviceId),range:hours,deviceId});const cutoff=hours==='all'?0:Date.now()-Number(hours)*3600000;const history=recent.filter(r=>(!cutoff||new Date(r.received_at).getTime()>=cutoff)&&(deviceId==='all'||r.device_id===deviceId));res.json({history,range:hours,deviceId})}catch(error){res.status(500).json({error:'Unable to load telemetry history'})}});
app.get('/api/devices',requireSession,async(req,res)=>{try{res.json({devices:IS_SUPABASE?await supabaseDevices(req):devices.map(mapDevice)})}catch(error){res.status(500).json({error:'Unable to load devices'})}});
function normalizeDeviceBody(body){const id=String(body.id||'').trim().replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80),name=String(body.name||id).trim().slice(0,100),location=String(body.location||'Unassigned').trim().slice(0,120),type=String(body.type||'ESP32 sensor').trim().slice(0,100);if(!id||!name)return null;return{id,name,location,type}}
app.post('/api/devices',requireSession,async(req,res)=>{const input=normalizeDeviceBody(req.body);if(!input)return res.status(400).json({error:'Device ID and name are required.'});try{if(IS_SUPABASE){const {data,error}=await req.supabase.from('devices').insert({id:input.id,owner_id:req.authUser.id,name:input.name,location:input.location,device_type:input.type}).select().single();if(error)return res.status(error.code==='23505'?409:400).json({error:error.code==='23505'?'That device ID already exists.':'Unable to add device.'});return res.status(201).json(mapDevice(data))}if(devices.some(d=>d.id===input.id))return res.status(409).json({error:'That device ID already exists.'});const device={...input,enabled:true,last_seen:null};devices.push(device);writeJSON(DEVICES_FILE,devices);res.status(201).json(mapDevice(device))}catch(error){res.status(500).json({error:'Unable to add device'})}});
app.patch('/api/devices/:id',requireSession,async(req,res)=>{const id=String(req.params.id).slice(0,80);try{if(IS_SUPABASE){const patch={};for(const key of ['name','location'])if(req.body[key]!=null)patch[key]=String(req.body[key]).trim().slice(0,120);if(req.body.type!=null)patch.device_type=String(req.body.type).trim().slice(0,100);if(req.body.enabled!=null)patch.enabled=Boolean(req.body.enabled);const {data,error}=await req.supabase.from('devices').update(patch).eq('id',id).select().maybeSingle();if(error)throw error;if(!data)return res.status(404).json({error:'Device not found'});return res.json(mapDevice(data))}const device=devices.find(d=>d.id===id);if(!device)return res.status(404).json({error:'Device not found'});for(const key of ['name','location','type'])if(req.body[key]!=null)device[key]=String(req.body[key]).trim().slice(0,120);if(req.body.enabled!=null)device.enabled=Boolean(req.body.enabled);writeJSON(DEVICES_FILE,devices);res.json(mapDevice(device))}catch(error){res.status(500).json({error:'Unable to update device'})}});
app.delete('/api/devices/:id',requireSession,async(req,res)=>{const id=String(req.params.id).slice(0,80);try{if(IS_SUPABASE){const {error}=await req.supabase.from('devices').delete().eq('id',id);if(error)throw error;return res.json({ok:true})}if(id==='demo-esp32-dht11'&&MOCK)return res.status(400).json({error:'The demo device cannot be removed in sample mode.'});devices=devices.filter(d=>d.id!==id);writeJSON(DEVICES_FILE,devices);res.json({ok:true})}catch(error){res.status(500).json({error:'Unable to delete device'})}});
app.get('/api/settings',requireSession,async(req,res)=>{try{res.json(IS_SUPABASE?await supabaseSettings(req):settings)}catch(error){res.status(500).json({error:'Unable to load alert settings'})}});
function normalizedSettings(body){const values={alertsEnabled:body.alertsEnabled!==false,temperatureLow:Number(body.temperatureLow),temperatureHigh:Number(body.temperatureHigh),humidityLow:Number(body.humidityLow),humidityHigh:Number(body.humidityHigh)};if(![values.temperatureLow,values.temperatureHigh,values.humidityLow,values.humidityHigh].every(Number.isFinite)||values.temperatureLow>=values.temperatureHigh||values.humidityLow>=values.humidityHigh||values.humidityLow<0||values.humidityHigh>100)return null;return values}
app.put('/api/settings',requireSession,async(req,res)=>{const next=normalizedSettings(req.body);if(!next)return res.status(400).json({error:'Use numeric thresholds with lower values below upper values.'});try{if(IS_SUPABASE){const {data,error}=await req.supabase.from('alert_settings').upsert({owner_id:req.authUser.id,enabled:next.alertsEnabled,temperature_low:next.temperatureLow,temperature_high:next.temperatureHigh,humidity_low:next.humidityLow,humidity_high:next.humidityHigh}).select().single();if(error)throw error;return res.json({alertsEnabled:data.enabled,temperatureLow:Number(data.temperature_low),temperatureHigh:Number(data.temperature_high),humidityLow:Number(data.humidity_low),humidityHigh:Number(data.humidity_high)})}settings=next;writeJSON(SETTINGS_FILE,settings);res.json(settings)}catch(error){res.status(500).json({error:'Unable to save alert settings'})}});
app.get('/api/alerts',requireSession,async(req,res)=>{try{const s=IS_SUPABASE?await supabaseSettings(req):settings;const rows=IS_SUPABASE?await supabaseHistory(req,'all','all',200):recent.slice(-200);const alerts=rows.flatMap(r=>alertFor(r,s).map(a=>({...r,...a}))).reverse().slice(0,40);res.json({alerts,settings:s})}catch(error){res.status(500).json({error:'Unable to load alerts'})}});
app.get('/api/export.csv',requireSession,async(req,res)=>{try{const rows=IS_SUPABASE?await supabaseHistory(req,'all','all',2000):recent;const csvRows=rows.map(r=>[r.received_at,r.device_id,r.temperature_c,r.humidity_percent,r.rssi_dbm??''].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','));res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="atmosense-readings.csv"');res.send(['received_at,device_id,temperature_c,humidity_percent,rssi_dbm',...csvRows].join('\n'))}catch(error){res.status(500).json({error:'Unable to export telemetry'})}});
app.get('/events',requireSession,(req,res)=>{res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();clients.add(res);const last=recent.at(-1);if(last)res.write(`data: ${JSON.stringify(last)}\n\n`);req.on('close',()=>clients.delete(res))});

let runtime;
async function publishReading(reading){const item=normalizeReading(reading);if(!item)return;if(IS_SUPABASE){if(!SUPABASE_SERVICE_ROLE_KEY){console.error('Telemetry skipped: SUPABASE_SERVICE_ROLE_KEY is required for AWS ingestion in Supabase mode');return}try{const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const {data:device,error:deviceError}=await admin.from('devices').select('id,owner_id').eq('id',item.device_id).maybeSingle();if(deviceError||!device){console.error('Telemetry device is not registered:',item.device_id);return}const {error}=await admin.from('telemetry').insert({owner_id:device.owner_id,device_id:item.device_id,temperature_c:item.temperature_c,humidity_percent:item.humidity_percent,rssi_dbm:item.rssi_dbm,recorded_at:item.received_at});if(error)throw error;const {error:updateError}=await admin.from('devices').update({last_seen:item.received_at}).eq('id',item.device_id);if(updateError)throw updateError}catch(error){console.error('Supabase telemetry persistence failed:',error.message);return}}
else{recent.push(item);while(recent.length>2000)recent.shift();writeJSON(HISTORY_FILE,recent);upsertDeviceLocal(item.device_id,item)}
const message=`data: ${JSON.stringify(item)}\n\n`;for(const client of clients)client.write(message)}
function upsertDeviceLocal(id,reading){let device=devices.find(d=>d.id===id);if(!device){device={id,name:id,location:'Unassigned',type:'ESP32 sensor',enabled:true,last_seen:null};devices.push(device)}device.last_seen=reading.received_at;device.online=true;writeJSON(DEVICES_FILE,devices)}
function startRuntime(){if(MOCK||!ENDPOINT){console.log('Running in SAMPLE_DATA demo mode. Set AWS_IOT_ENDPOINT and MOCK_DATA=false for AWS IoT Core.');const sampleFile=path.join(__dirname,'data','sample-readings.json');const sample=fs.existsSync(sampleFile)?readJSON(sampleFile,[]):[];let sampleIndex=0;const emitSample=()=>void publishReading(sample.length?sample[sampleIndex++%sample.length]:{device_id:'demo-esp32-dht11',temperature_c:26.8,humidity_percent:55.2,rssi_dbm:-55});emitSample();runtime=setInterval(emitSample,3000)}else{const read=name=>fs.readFileSync(path.resolve(__dirname,CERT_DIR,name));const client=mqtt.connect(`mqtts://${ENDPOINT}:8883`,{clientId:`dashboard-${Date.now()}`,ca:read('AmazonRootCA1.pem'),cert:read('dashboard-certificate.pem.crt'),key:read('dashboard-private.pem.key'),clean:true,reconnectPeriod:3000});client.on('connect',()=>{console.log(`Connected to AWS IoT Core; subscribing to ${TOPIC}`);client.subscribe(TOPIC)});client.on('message',(_topic,payload)=>void publishReading(JSON.parse(payload.toString())).catch(e=>console.error('Invalid telemetry:',e.message)));client.on('error',err=>console.error('MQTT error:',err.message))}}
if(require.main===module){startRuntime();app.listen(PORT,'0.0.0.0',()=>console.log(`Atmosense available at http://localhost:${PORT}`))}
module.exports={app,defaults,normalizeReading,normalizedSettings,rateBuckets};
