import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkflowServer } from "../server/workflow-api.mjs";

const token={construction:"construction-token",receiving:"receiving-token",driver:"driver-token",outsider:"outsider-token"};
const call=async(base,role,path,{method="GET",body,version,key}={})=>{
  const response=await fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${token[role]}`,...(body?{"content-type":"application/json"}:{}),...(version?{"if-match":String(version)}:{}),...(key?{"idempotency-key":key}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
};

test("direct transport persists across roles with authorization and concurrency controls", async(t)=>{
  const dir=mkdtempSync(join(tmpdir(),"ecodump-workflow-"));
  const api=createWorkflowServer({dbPath:join(dir,"test.sqlite"),port:0});
  const address=await api.listen(); const base=`http://127.0.0.1:${address.port}/api`;
  t.after(async()=>{await api.close();rmSync(dir,{recursive:true,force:true})});
  const created=await call(base,"construction","/reservations",{method:"POST",key:"create-1",body:{siteId:"site-01",receivingLocationId:"location-01",plannedAt:"2026-10-01T08:00:00+09:00",soilType:"第2種建設発生土",plannedQuantity:8,unit:"m3"}});
  assert.equal(created.status,201); const reservation=created.body.reservation;
  const replay=await call(base,"construction","/reservations",{method:"POST",key:"create-1",body:{siteId:"site-01",receivingLocationId:"location-01",plannedAt:"2026-10-01T08:00:00+09:00",soilType:"第2種建設発生土",plannedQuantity:8,unit:"m3"}});
  assert.equal(replay.body.reservation.id,reservation.id); assert.equal(replay.body.replayed,true);
  assert.equal((await call(base,"outsider","/workflow")).body.data.length,0);
  assert.equal((await call(base,"outsider",`/reservations/${reservation.id}/confirm`,{method:"POST",version:1,key:"bad-confirm",body:{}})).status,403);
  const confirmed=await call(base,"receiving",`/reservations/${reservation.id}/confirm`,{method:"POST",version:1,key:"confirm-1",body:{}});
  assert.equal(confirmed.body.reservation.status,"confirmed");
  const stale=await call(base,"receiving",`/reservations/${reservation.id}/confirm`,{method:"POST",version:1,key:"confirm-stale",body:{}});
  assert.equal(stale.status,409); assert.equal(stale.body.code,"VERSION_CONFLICT");
  const assigned=await call(base,"construction",`/reservations/${reservation.id}/assign`,{method:"POST",version:2,key:"assign-1",body:{vehicleId:"vehicle-01",driverId:"driver-01"}});
  let trip=assigned.body.trip; assert.equal((await call(base,"driver","/workflow")).body.data[0].trip.id,trip.id);
  assert.equal((await call(base,"outsider",`/trips/${trip.id}/events`,{method:"POST",version:1,key:"bad-event",body:{eventType:"arrived"}})).status,403);
  for (const [eventType,key] of [["arrived","event-1"],["departed","event-2"],["unloaded","event-3"]]) { const result=await call(base,"driver",`/trips/${trip.id}/events`,{method:"POST",version:trip.version,key,body:{eventType}}); assert.equal(result.status,201); trip=result.body.trip; }
  const receipt=await call(base,"receiving",`/trips/${trip.id}/receipt/confirm`,{method:"POST",version:trip.version,key:"receipt-1",body:{actualQuantity:7.8,unit:"m3"}});
  assert.equal(receipt.body.receipt.status,"confirmed");
  for (const role of ["construction","receiving"]) { const loaded=await call(base,role,"/workflow"); assert.equal(loaded.body.data[0].receipt.actual_quantity,7.8); assert.equal(loaded.body.data[0].events.length,3); }
  const operation=await call(base,"driver","/operations/event-3"); assert.equal(operation.body.status,"completed");
});
