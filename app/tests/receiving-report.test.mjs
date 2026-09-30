import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {transportRows,reportTotals,transportWorkbook} from '../src/reports/transportReport.mjs';
import {receivingTrip} from '../src/receiving/liveModel.mjs';
import {filters,summarize} from '../src/receiving/receivingSummary.mjs';
const base={vehicleCompany:'モデル運送〈架空〉',id:'b',date:'2026-09-30',site:{id:'s',name:'A'},location:{id:'l',name:'栃木'},quantity:10,unit:'m3',status:'confirmed',trip:{id:'t',vehicleId:'v',vehicle:'01',plannedQuantity:10,unit:'m3',status:'receiver_arrived'}};
test('arrival, gate, unloading and receiver confirmation stay distinct; remaining excludes cancellation',()=>{
 const arrived=receivingTrip(base),entry=receivingTrip({...base,gateRecords:[{direction:'entry',status:'confirmed'}]}),unloaded=receivingTrip({...base,trip:{...base.trip,status:'unloaded'},receiptRecord:{status:'pending',quantity:9.5,unit:'m3'}});
 assert.equal(arrived.reception,'待機');assert.equal(entry.reception,'受入中');assert.equal(filters['受入完了'](unloaded),false);
 const done=receivingTrip({...base,receiptRecord:{status:'confirmed',quantity:9.5,unit:'m3'},actual:{quantity:9.5,unit:'m3'}});
 const cancelled=receivingTrip({...base,status:'cancelled'});
 const result=summarize([arrived,unloaded,done,cancelled]);
 assert.equal(result.quantities[0].remaining,20);assert.equal(result.quantities[0].confirmed,9.5);assert.equal(result.quantities[0].pending,9.5);assert.equal(filters['未到着'](cancelled),false);
});
test('real XLSX round-trip has exactly visible rows, separate units, corrected confirmed quantity and cancelled actual',()=>{
 const data=[base,{...base,trip:{...base.trip,id:'t2'},receiptRecord:{status:'confirmed',quantity:9.5,unit:'m3'},actual:{quantity:9.4,unit:'m3'},receiptHistory:[{action:'receipt_correct'}]},{...base,status:'cancelled',trip:{...base.trip,id:'t3'}},{...base,status:'cancelled',trip:{...base.trip,id:'t4'},receiptRecord:{status:'confirmed',quantity:1,unit:'t'},actual:{quantity:1,unit:'t'}}];
 const rows=transportRows(data),totals=reportTotals(rows);
 assert.equal(rows[0].carrier,'モデル運送〈架空〉');
 assert.equal(totals[0].confirmed,9.4);assert.equal(totals[1].confirmed,1);assert.equal(totals[0].planned,20);assert.equal(totals[0].vehicles,1);assert.equal(rows[1].correction,1);
 const bytes=XLSX.write(transportWorkbook(rows,{period:'2026-09-30'}),{type:'buffer',bookType:'xlsx'});
 assert.equal(bytes.subarray(0,2).toString(),'PK');
 const wb=XLSX.read(bytes,{type:'buffer'});assert.deepEqual(wb.SheetNames,['集計','便別明細']);
 const detail=XLSX.utils.sheet_to_json(wb.Sheets['便別明細'],{header:1});
 assert.equal(detail.length,rows.length+1);assert.equal(detail[2][18],9.4);
 assert.equal(detail[3][18],undefined);assert.equal(detail[4][18],1);
});
