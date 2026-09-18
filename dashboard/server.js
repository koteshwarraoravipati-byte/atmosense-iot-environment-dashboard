require('dotenv').config();
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const express=require('express');
const mqtt=require('mqtt');

const PORT=Number(process.env.PORT||3000);
const ENDPOINT=process.env.AWS_IOT_ENDPOINT;
const TOPIC=process.env.MQTT_TOPIC||'environment/dht11';
const CERT_DIR=process.env.CERT_DIR||'../secrets';
const MOCK=String(process.env.MOCK_DATA||'false').toLowerCase()==='true';
const AUTH_PROVIDER=String(process.env.AUTH_PROVIDER||'demo').toLowerCase();
const SUPABASE_URL=process.env.SUPABASE_URL||'';
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY||'';

const app=express();
const clients=new Set();
const sessions=new Map();
const DATA_DIR=path.join(__dirname,'data');
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

app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public')));
app.get('/api/config',(_req,res)=>res.json({authProvider:AUTH_PROVIDER==='supabase'&&SUPABASE_URL&&SUPABASE_ANON_KEY?'supabase':'demo',supabaseUrl:SUPABASE_URL,supabaseAnonKey:SUPABASE_ANON_KEY,liveMode:Boolean(ENDPOINT&&!MOCK)}));

const readUsers=()=>readJSON(USERS_FILE,[]);
const saveUsers=users=>writeJSON(USERS_FILE,users);
const cleanUser=u=>({id:u.id,name:u.name,email:u.email});
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`}
function validPassword(password,stored){try{const [salt,key]=stored.split(':');return crypto.timingSafeEqual(Buffer.from(key,'hex'),crypto.scryptSync(password,salt,64))}catch{return false}}
function sessionUser(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('atmosense_session='))?.split('=')[1];return token?sessions.get(token):null}
function setSession(res,user){const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user);res.setHeader('Set-Cookie',`atmosense_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`)}
function requireSession(req,res,next){if(AUTH_PROVIDER==='supabase')return next();if(!sessionUser(req))return res.status(401).json({error:'Sign in required'});next()}

app.post('/api/auth/signup',(req,res)=>{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(name.length<2||!email.includes('@')||password.length<8)return res.status(400).json({error:'Enter a name, valid email, and password of at least 8 characters.'});const users=readUsers();if(users.some(u=>u.email===email))return res.status(409).json({error:'An account with this email already exists.'});const user={id:crypto.randomUUID(),name,email,passwordHash:hashPassword(password),createdAt:new Date().toISOString()};users.push(user);saveUsers(users);const safe=cleanUser(user);setSession(res,safe);res.status(201).json(safe)});
app.post('/api/auth/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const user=readUsers().find(u=>u.email===email);if(!user||!validPassword(password,user.passwordHash))return res.status(401).json({error:'Email or password is incorrect.'});const safe=cleanUser(user);setSession(res,safe);res.json(safe)});
app.get('/api/auth/me',(req,res)=>{const user=sessionUser(req);if(!user)return res.status(401).json({error:'Not signed in'});res.json(user)});
app.post('/api/auth/logout',(req,res)=>{const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('atmosense_session='))?.split('=')[1];if(token)sessions.delete(token);res.setHeader('Set-Cookie','atmosense_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.json({ok:true})});

function normalizeReading(reading){const temperature=Number(reading.temperature_c),humidity=Number(reading.humidity_percent);if(!Number.isFinite(temperature)||!Number.isFinite(humidity))return null;return{device_id:String(reading.device_id||'unknown-device'),temperature_c:temperature,humidity_percent:humidity,rssi_dbm:reading.rssi_dbm==null?null:Number(reading.rssi_dbm),sample_time:reading.sample_time||null,timestamp_ms:reading.timestamp_ms||null,received_at:new Date().toISOString()}}
function upsertDevice(id,reading){let device=devices.find(d=>d.id===id);if(!device){device={id,name:id,location:'Unassigned',type:'ESP32 sensor',enabled:true,last_seen:null};devices.push(device)}device.last_seen=reading.received_at;device.online=true;writeJSON(DEVICES_FILE,devices)}
function publishReading(reading){const item=normalizeReading(reading);if(!item)return;recent.push(item);while(recent.length>2000)recent.shift();writeJSON(HISTORY_FILE,recent);upsertDevice(item.device_id,item);const message=`data: ${JSON.stringify(item)}\n\n`;for(const client of clients)client.write(message)}

app.get('/api/latest',(_req,res)=>res.json({latest:recent.at(-1)||null,recent:recent.slice(-60),devices,settings}));
app.get('/api/history',(req,res)=>{const hours=String(req.query.hours||'24'),deviceId=String(req.query.deviceId||'all');const cutoff=hours==='all'?0:Date.now()-Number(hours||24)*3600000;const history=recent.filter(r=>(!cutoff||new Date(r.received_at).getTime()>=cutoff)&&(deviceId==='all'||r.device_id===deviceId));res.json({history,range:hours,deviceId})});
app.get('/api/devices',(_req,res)=>res.json({devices:devices.map(d=>({...d,online:d.last_seen?Date.now()-new Date(d.last_seen).getTime()<120000:false}))}));
app.post('/api/devices',requireSession,(req,res)=>{const id=String(req.body.id||'').trim().replace(/[^a-zA-Z0-9_-]/g,'-');const name=String(req.body.name||id).trim();const location=String(req.body.location||'Unassigned').trim();if(!id||!name)return res.status(400).json({error:'Device ID and name are required.'});if(devices.some(d=>d.id===id))return res.status(409).json({error:'That device ID already exists.'});const device={id,name,location,type:String(req.body.type||'ESP32 sensor'),enabled:true,last_seen:null};devices.push(device);writeJSON(DEVICES_FILE,devices);res.status(201).json(device)});
app.patch('/api/devices/:id',requireSession,(req,res)=>{const device=devices.find(d=>d.id===req.params.id);if(!device)return res.status(404).json({error:'Device not found'});for(const key of ['name','location','type'])if(req.body[key]!=null)device[key]=String(req.body[key]).trim();if(req.body.enabled!=null)device.enabled=Boolean(req.body.enabled);writeJSON(DEVICES_FILE,devices);res.json(device)});
app.delete('/api/devices/:id',requireSession,(req,res)=>{if(req.params.id==='demo-esp32-dht11'&&MOCK)return res.status(400).json({error:'The demo device cannot be removed in sample mode.'});devices=devices.filter(d=>d.id!==req.params.id);writeJSON(DEVICES_FILE,devices);res.json({ok:true})});
app.get('/api/settings',requireSession,(_req,res)=>res.json(settings));
app.put('/api/settings',requireSession,(req,res)=>{settings={...settings,alertsEnabled:req.body.alertsEnabled!==false,temperatureLow:Number(req.body.temperatureLow),temperatureHigh:Number(req.body.temperatureHigh),humidityLow:Number(req.body.humidityLow),humidityHigh:Number(req.body.humidityHigh)};if(![settings.temperatureLow,settings.temperatureHigh,settings.humidityLow,settings.humidityHigh].every(Number.isFinite))return res.status(400).json({error:'Thresholds must be numeric.'});writeJSON(SETTINGS_FILE,settings);res.json(settings)});
app.get('/api/alerts',requireSession,(req,res)=>{const alerts=recent.slice(-200).flatMap(r=>{const out=[];if(settings.alertsEnabled&&r.temperature_c<settings.temperatureLow)out.push({...r,type:'temperature_low',message:`Temperature below ${settings.temperatureLow}°C`});if(settings.alertsEnabled&&r.temperature_c>settings.temperatureHigh)out.push({...r,type:'temperature_high',message:`Temperature above ${settings.temperatureHigh}°C`});if(settings.alertsEnabled&&r.humidity_percent<settings.humidityLow)out.push({...r,type:'humidity_low',message:`Humidity below ${settings.humidityLow}%`});if(settings.alertsEnabled&&r.humidity_percent>settings.humidityHigh)out.push({...r,type:'humidity_high',message:`Humidity above ${settings.humidityHigh}%`});return out}).reverse();res.json({alerts:alerts.slice(0,40),settings})});
app.get('/api/export.csv',(req,res)=>{const rows=recent.map(r=>[r.received_at,r.device_id,r.temperature_c,r.humidity_percent,r.rssi_dbm??''].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','));res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="atmosense-readings.csv"');res.send(['received_at,device_id,temperature_c,humidity_percent,rssi_dbm',...rows].join('\n'))});
app.get('/events',(req,res)=>{res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.flushHeaders();clients.add(res);const last=recent.at(-1);if(last)res.write(`data: ${JSON.stringify(last)}\n\n`);req.on('close',()=>clients.delete(res))});

if(MOCK||!ENDPOINT){console.log('Running in SAMPLE_DATA demo mode. Set AWS_IOT_ENDPOINT and MOCK_DATA=false for AWS IoT Core.');const sampleFile=path.join(__dirname,'data','sample-readings.json');const sample=fs.existsSync(sampleFile)?readJSON(sampleFile,[]):[];let sampleIndex=0;const emitSample=()=>publishReading(sample.length?sample[sampleIndex++%sample.length]:{device_id:'demo-esp32-dht11',temperature_c:26.8,humidity_percent:55.2,rssi_dbm:-55});emitSample();setInterval(emitSample,3000)}else{const read=name=>fs.readFileSync(path.resolve(__dirname,CERT_DIR,name));const client=mqtt.connect(`mqtts://${ENDPOINT}:8883`,{clientId:`dashboard-${Date.now()}`,ca:read('AmazonRootCA1.pem'),cert:read('dashboard-certificate.pem.crt'),key:read('dashboard-private.pem.key'),clean:true,reconnectPeriod:3000});client.on('connect',()=>{console.log(`Connected to AWS IoT Core; subscribing to ${TOPIC}`);client.subscribe(TOPIC)});client.on('message',(_topic,payload)=>{try{publishReading(JSON.parse(payload.toString()))}catch(e){console.error('Invalid telemetry:',e.message)}});client.on('error',err=>console.error('MQTT error:',err.message))}
app.listen(PORT,'0.0.0.0',()=>console.log(`Atmosense available at http://localhost:${PORT}`));
