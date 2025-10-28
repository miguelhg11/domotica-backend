import { kv } from '@vercel/kv';

// =========================================================
//               CONFIGURACIÓN OBLIGATORIA
// =========================================================

// ⚠️ CAMBIA ESTO por tu dirección de DuckDNS (sin http://)
const DUCKDNS_HOST = "pabloalex123.duckdns.org"; 

// ⚠️ Lista de SHUTTERS (extraída de tu HTML)
const SHUTTERS=[
  {id:'sot_cald',name:'Cuarto caldera',floor:'Sótano',facade:'Principal',board:1,r1:1,r2:2},
  {id:'pb_desp',name:'Despacho',floor:'Baja',facade:'Principal',board:1,r1:3,r2:4},
  {id:'pb_salon',name:'Salón',floor:'Baja',facade:'Trasera',board:1,r1:5,r2:6},
  {id:'pb_cocina',name:'Cocina',floor:'Baja',facade:'Trasera',board:1,r1:7,r2:8},
  {id:'pb_escal',name:'Escalera planta baja',floor:'Baja',facade:'Principal',board:1,r1:9,r2:10},
  {id:'p1_esca',name:'Escalera planta primera',floor:'Primera',facade:'Principal',board:1,r1:11,r2:12},
  {id:'p1_pablo',name:'Habitación Pablo',floor:'Primera',facade:'Principal',board:1,r1:13,r2:14},
  {id:'p1_bano',name:'Baño hab. principal',floor:'Primera',facade:'Principal',board:1,r1:15,r2:16},
  {id:'p1_prin',name:'Habitación principal',floor:'Primera',facade:'Trasera',board:2,r1:1,r2:2},
  {id:'p1_alex',name:'Habitación Alex',floor:'Primera',facade:'Trasera',board:2,r1:3,r2:4},
  {id:'buh_1',name:'Buhardilla 1',floor:'Buhardilla',facade:'Principal',board:2,r1:5,r2:6},
  {id:'buh_2',name:'Buhardilla 2',floor:'Buhardilla',facade:'Principal',board:2,r1:12,r2:13},
  {id:'buh_es',name:'Escalera buhardilla',floor:'Buhardilla',facade:'Principal',board:2,r1:15,r2:16},
];

// ⚠️ Lista de LIGHTS (extraída de tu HTML)
const LIGHTS=[
  {id:'l_desp',name:'Luz Despacho',board:2,relay:7},
  {id:'l_es_p1',name:'Luz Escalera Planta 1',board:2,relay:8},
  {id:'l_pablo',name:'Luz Habitación Pablo',board:2,relay:9},
  {id:'l_es_buh',name:'Luz Escalera Buhardilla',board:2,relay:10},
  {id:'l_buh',name:'Luz Buhardilla',board:2,relay:11},
];

// =========================================================
//              MOTOR DE EJECUCIÓN (No tocar)
// =========================================================

// --- Configuración (copiada de tu app) ---
const FUEN = {lat:40.290, lon:-3.803}; // Coordenadas fijas
const PORTS = {1:8282, 2:8181};
const SEND_DELAY_MS = 750; // Delay robusto

// --- Funciones de Hora (copiadas de tu app) ---
function toMins(t){ if(!t) return 0; const [h,m]=t.split(':').map(x=>+x); return h*60+m; }
function nowMins(date){ const d = new Date(date); return d.getHours()*60+d.getMinutes(); }
function getDOW(date) { const d = new Date(date); return (d.getDay()+6)%7; } // Lunes=0, Domingo=6

function sunTimes(date,lat,lon){
  function rad(d){return d*Math.PI/180} function deg(r){return r*180/Math.PI}
  const d= Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(date.getFullYear(),0,0))/86400000);
  const lngHour = lon/15;
  function calc(isSunrise){
    const t = d + ((isSunrise?6:18)-lngHour)/24;
    const M = (0.9856*t)-3.289;
    const L = (M + 1.916*Math.sin(rad(M)) + 0.020*Math.sin(2*rad(M)) + 282.634)%360;
    const RA = (deg(Math.atan(0.91764*Math.tan(rad(L))))+360)%360;
    const Lq  = Math.floor(L/90)*90, RAq = Math.floor(RA/90)*90;
    const RAadj = (RA + (Lq - RAq))/15;
    const sinDec = 0.39782*Math.sin(rad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(rad(90.833)) - (sinDec*Math.sin(rad(FUEN.lat))))/(cosDec*Math.cos(rad(FUEN.lat)));
    if(cosH>1||cosH<-1) return null;
    const H = (isSunrise?360-deg(Math.acos(cosH)):deg(Math.acos(cosH)))/15;
    const T = H + RAadj - 0.06571*t - 6.622;
    const UT = (T - lngHour + 24)%24;
    const dt=new Date(date); dt.setUTCHours(0,0,0,0); const ms=UT*3600*1000; const local=new Date(dt.getTime()+ms);
    return local.getHours()*60+local.getMinutes();
  }
  return { sunrise: calc(true), sunset: calc(false) };
}

// --- Funciones de Envío (Aquí pones tu DuckDNS) ---
function urlFor({board,relay,value}){return `http://${DUCKDNS_HOST}:${PORTS[board]}/pwr/relays/${relay}?ac=123456&value=${value}`}
async function sendRelay(board,relay,value){
  const url=urlFor({board,relay,value});
  console.log(`HTTP GET ${url}`);
  try { 
    // Usamos fetch con un timeout de 5s por si el relé no responde
    await fetch(url, { signal: AbortSignal.timeout(5000) }); 
  } catch(e) { 
    console.error(`Error al lanzar URL: ${e.message}`); 
  }
  // Esperamos el delay *después* de lanzar la petición
  await new Promise(r=>setTimeout(r,SEND_DELAY_MS));
}
async function shutterAction(sh,dir){
  if(!sh) return;
  console.log(`ShutterAction: ${dir} -> ${sh.name}`);
  if(dir==='STOP'){
    await sendRelay(sh.board,sh.r1,0);
    await sendRelay(sh.board,sh.r2,0);
  }else{
    await sendRelay(sh.board,sh.r1,1);
    await sendRelay(sh.board,sh.r2,(dir==='UP'?0:1));
  }
}
async function lightDo(l,val){
  if(!l) return;
  console.log(`LightAction: ${val} -> ${l.name}`);
  await sendRelay(l.board,l.relay,val);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getSh(id){return SHUTTERS.find(x=>x.id===id)}
function getL(id){return LIGHTS.find(x=>x.id===id)}


// --- El Motor (Handler principal) ---
export default async function handler(request, response) {
  // Obtenemos la hora actual en la zona horaria correcta (Europa/Madrid)
  const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
  const dow = getDOW(d);
  const curM = nowMins(d);
  const sun = sunTimes(d, FUEN.lat, FUEN.lon);
  
  console.log(`CRON JOB: ${d.toISOString()} | Minuto: ${curM} | DOW: ${dow} | Sunrise: ${sun.sunrise} | Sunset: ${sun.sunset}`);

  let schedulesLights = [];
  let schedulesShutters = [];
  let shutterCalibrations = {};

  try {
    schedulesLights = await kv.get('domo_schedulesLights') || [];
    schedulesShutters = await kv.get('domo_schedulesShutters') || [];
    shutterCalibrations = await kv.get('domo_shutterCalibrations') || {};
  } catch (e) {
    console.error("Error fatal leyendo de KV", e);
    return response.status(500).send('Error leyendo de KV');
  }

  // --- Ejecutor de Luces ---
  for(const s of schedulesLights){ 
    if(!s.enabled || !s.days.includes(dow)) continue;

    let triggerMinute = -1;
    if (s.trigger.type === 'time') {
      triggerMinute = toMins(s.trigger.at);
    } else if (s.trigger.type === 'solar') {
      const base = (s.trigger.event === 'sunrise' ? sun.sunrise : sun.sunset);
      if (base == null) continue;
      const offset = (s.trigger.sign === '-' ? -1 : 1) * (s.trigger.h * 60 + s.trigger.m);
      triggerMinute = base + offset;
    }

    if (triggerMinute !== curM) continue;
    
    // ¡Coincidencia! Ejecutar acción
    console.log(`SCHED RUN [lights] ${s.name}`);
    let targets = [];
    if (s.target.type === 'ALL') targets = LIGHTS;
    if (s.target.type === 'INDIVIDUAL') targets = s.target.ids.map(getL);
    
    for(const l of targets){ 
      if(l) await lightDo(l, s.action.value);
    }
  }

  // --- Ejecutor de Persianas ---
  for(const s of schedulesShutters){ 
    if(!s.enabled || !s.days.includes(dow)) continue;
    
    let triggerMinute = -1;
    if (s.trigger.type === 'time') {
      triggerMinute = toMins(s.trigger.at);
    } else if (s.trigger.type === 'solar') {
      const base = (s.trigger.event === 'sunrise' ? sun.sunrise : sun.sunset);
      if (base == null) continue;
      const offset = (s.trigger.sign === '-' ? -1 : 1) * (s.trigger.h * 60 + s.trigger.m);
      triggerMinute = base + offset;
    }

    if (triggerMinute !== curM) continue;
    
    // ¡Coincidencia! Ejecutar acción
    console.log(`SCHED RUN [shutters] ${s.name} -> action=${s.action.dir}`);
    
    let dest = [];
    if(s.target.type==='ALL') dest=SHUTTERS;
    else if(s.target.type==='INDIVIDUAL') dest=s.target.ids.map(getSh);
    else if(s.target.type==='FLOOR') dest=SHUTTERS.filter(x=>s.target.ids.includes(x.floor));
    else if(s.target.type==='FACADE') dest=SHUTTERS.filter(x=>s.target.ids.includes(x.facade));
    
    dest = dest.filter(Boolean); // Quitar nulos si alguno no se encontró

    if(s.action.type==='SHUTTER' && s.action.dir==='PERCENT'){
      for(const sh of dest){ 
        const cal = shutterCalibrations[sh.id]; 
        if(!cal || !cal.downTime) {
          console.log(`Skip ${sh.name}: sin calibración`); 
          continue;
        }
        // Ejecutar lógica de porcentaje
        console.log(`SCHED Percent START -> ${sh.name} = ${s.action.percent}%`);
        await shutterAction(sh,'UP'); 
        await sleep(cal.downTime * 1.25); // Esperar subida completa + margen
        await shutterAction(sh,'STOP'); 
        await sleep(500); // Pausa
        
        const targetPercent = s.action.percent || 0; // % de apertura (0=cerrada, 100=abierta)
        const ms = Math.round(cal.downTime * (100 - targetPercent) / 100);
        
        if(ms > 0){ 
          await shutterAction(sh,'DOWN'); 
          await sleep(ms); 
        }
        await shutterAction(sh,'STOP');
        console.log(`SCHED Percent OK -> ${sh.name}`);
      }
    }else if(s.action.type==='SHUTTER'){
      // Acción simple (UP/DOWN/STOP)
      for(const sh of dest){ 
        await shutterAction(sh, s.action.dir);
      }
    }
  }
  
  response.status(200).send('OK');
}
