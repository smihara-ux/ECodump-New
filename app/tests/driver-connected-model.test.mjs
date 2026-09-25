import test from 'node:test';
import assert from 'node:assert/strict';
import {driverRowKey,assignmentSnapshot,assignmentChanges,driverPlannedQuantity,driverNotifications,driverDone,reviewAssignments} from '../src/driver/connectedModel.mjs';
const b={id:'booking',quantity:30,plannedAt:'2026-09-25T08:00:00+09:00',site:{name:'A'},location:{name:'栃木'},trip:{id:'trip-1',driverId:'aoki',vehicleId:'01',vehicle:'検証01',vehiclePlate:'検証01',plannedQuantity:10,status:'assigned'}};
test('multiple trips retain individual identity, planned quantity and receipt notices',()=>{const second={...b,trip:{...b.trip,id:'trip-2'},receiptRecord:{status:'returned',reason:'数量再確認'}};assert.notEqual(driverRowKey(b),driverRowKey(second));assert.equal(driverPlannedQuantity(b),10);assert.deepEqual(driverNotifications([b,second]).map(n=>n.tripId),['trip-2']);});
test('vehicle/route/time changes require new review; progress alone does not alter assignment',()=>{const snapshot=assignmentSnapshot(b);assert.deepEqual(assignmentChanges(snapshot,{...b,trip:{...b.trip,status:'site_arrived',version:2}}),[]);const changed={...b,location:{name:'茨城'},trip:{...b.trip,vehicleId:'02',vehicle:'検証02'}};assert.deepEqual(assignmentChanges(snapshot,changed).map(c=>c.label),['車両','受入先']);assert.equal(driverDone({...b,trip:{...b.trip,status:'cancelled'}}),true);});

test('unacknowledged assignment survives refetch and reload; acknowledgement clears only that trip',()=>{
 const initial={...b,canReport:true}, changed={...initial,trip:{...initial.trip,vehicleId:'02',vehicle:'検証02'}};
 const first=reviewAssignments({},[initial]);
 const detected=reviewAssignments(first.snapshots,[changed]);
 assert.equal(detected.alerts['trip-1'][0].label,'車両');
 const restored=JSON.parse(JSON.stringify(detected.snapshots));
 assert.deepEqual(reviewAssignments(restored,[changed]).alerts,detected.alerts);
 assert.deepEqual(reviewAssignments({...restored,'trip-1':assignmentSnapshot(changed)},[changed]).alerts,{});
 assert.deepEqual(reviewAssignments(restored,[{...changed,canReport:false}]).alerts,{});
});
