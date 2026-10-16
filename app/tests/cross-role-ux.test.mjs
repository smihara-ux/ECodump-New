import test from 'node:test';
import assert from 'node:assert/strict';
import {receivingVehicleRows,receivingVehicleExport} from '../src/receiving/vehicleCounts.mjs';
import {summarizeVehicles} from '../src/construction/operationsModel.mjs';
import {filters} from '../src/receiving/receivingSummary.mjs';
import {readDriverView,writeDriverView,driverReceiptLabel,driverViewKey} from '../src/driver/driverView.mjs';

test('receiving projections keep construction counts for repeat vehicles, pending confirmations and unassigned rotations',()=>{
  const rows=[{vehicleId:'A',receipt:'実績確定',actual:0},{vehicleId:'A',receipt:'未確定'}, {vehicleId:'B',receipt:'未確定'}, {vehicleId:'',receipt:'未確定'}, {vehicleId:'B',booking:'取消'}, {vehicleId:'C',reservation:'受入不可'}];
  const counts=summarizeVehicles(receivingVehicleRows(rows));
  assert.deepEqual(counts.map(c=>[c.actual,c.extended,c.unassigned]),[[2,4,1],[1,1,0],[2,3,1],[1,1,0]]);
  assert.equal(receivingVehicleExport(rows).予定台数,'実2台／延べ4台（未配車1件）');
});
test('an API driver unloading report or pending receipt is not receiving confirmation',()=>{
  const rows=[{vehicleId:'A',actual:8,evidence:{receiptRecord:{status:'pending'},actual:{quantity:8}}},{vehicleId:'A',actual:0,evidence:{receiptRecord:{status:'confirmed'},actual:{quantity:0}}}];
  assert.deepEqual(receivingVehicleRows(rows).map(r=>r.confirmed),[null,0]);
});
test('cancelled confirmed quantities stay historical while completed-count filters exclude cancelled trips',()=>{
  const row={vehicleId:'A',receipt:'実績確定',actual:5,reservation:'取消'};
  assert.equal(filters.受入完了(row),false);assert.equal(filters.実績(row),true);
  assert.equal(summarizeVehicles(receivingVehicleRows([row]))[1].extended,0);
});
test('driver history shows confirmed zero quantities and distinguishes receiving pending',()=>{
  assert.equal(driverReceiptLabel({confirmed:0,unit:'t'}),'受入確認済み 0 t');
  assert.equal(driverReceiptLabel({confirmed:null,unit:'t'}),'受入確認待ち');
});
test('driver navigation restores date, query and scroll without storing report drafts',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  writeDriverView({tab:'history',date:'2026-10-16',endDate:'2026-10-15',filter:'A工区',scroll:{history:350}},storage);
  const view=readDriverView(storage);assert.equal(view.tab,'history');assert.equal(view.endDate,'2026-10-16');assert.equal(view.filter,'A工区');assert.equal(view.scroll.history,350);
  storage.setItem(driverViewKey,'bad json');assert.equal(readDriverView(storage).tab,'today');
});
