// Uses the common construction session and common naritaIds; no UI-only seed.
import{readFile,writeFile}from'node:fs/promises';import{randomUUID}from'node:crypto';
const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url))),creds=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url))),ids=cfg.naritaIds;
if(!ids||cfg.api.database!=='ecodump_direct_validation')throw Error('Common Narita seed is required');
const base='http://127.0.0.1:6102/api/direct',tokens={};
async function call(w,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+tokens[w],'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d;}
for(const name of ['narita-construction','narita-receiver-tochigi','narita-receiver-ibaraki','narita-driver-aoki','narita-driver-sato']){const a=creds.accounts.find(a=>a.name===name);tokens[name]=(await call(null,'/session',{email:a.email,password:creds.password})).token;}
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),existing=(await call('narita-construction','/bookings')).bookings;
const plans=[['08:00',ids.siteA,ids.locationTochigi,ids.vehicle01,ids.driverAoki],['12:00',ids.siteA,ids.locationIbaraki,ids.vehicle01,ids.driverAoki],['16:00',ids.siteB,ids.locationTochigi,ids.vehicle01,ids.driverAoki],['09:00',ids.siteB,ids.locationIbaraki,ids.vehicle02,ids.driverSato]];
const evidence=[];
for(const [i,[time,siteId,locationId,vehicleId,driverId]]of plans.entries()){
 const note=`成田ドライバー共通プレビュー ${date} 第${i+1}便（架空・検証用）`;
 let b=existing.find(b=>b.agreementNote===note);const id=b?.id||randomUUID();
 if(!b)await call('narita-construction','/actions/create',{id,siteId,locationId,plannedAt:`${date}T${time}:00+09:00`,quantity:10,unit:'m3',soil:'第2種建設発生土',agreementNote:note});
 b=(await call('narita-construction','/bookings')).bookings.find(b=>b.id===id);
 if(b.status==='requested')await call(locationId===ids.locationTochigi?'narita-receiver-tochigi':'narita-receiver-ibaraki','/actions/confirm',{bookingId:id,expectedVersion:b.version,agree:true});
 b=(await call('narita-construction','/bookings')).bookings.find(b=>b.id===id);
 if(!b.trip)await call('narita-construction','/actions/assign',{bookingId:id,expectedVersion:b.version,vehicleId,driverId});
 b=(await call(driverId===ids.driverAoki?'narita-driver-aoki':'narita-driver-sato','/bookings')).bookings.find(b=>b.id===id);
 evidence.push({bookingId:b.id,tripId:b.trip.id,siteId,locationId,vehicleId,driverId,rotation:b.trip.rotation,date,time});
}
await writeFile(new URL('../../../docs/narita-validation/driver-preview-evidence.json',import.meta.url),JSON.stringify({environment:'isolated-postgresql',source:'shared construction create/confirm/assign APIs',date,trips:evidence},null,2));console.log(JSON.stringify({date,trips:evidence}));
