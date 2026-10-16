import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationStep,reservationErrors,reviewedValuesMatch,displayReservationHistory} from '../src/receiving/reservationWorkflow.mjs';
import {receiptErrors,receiptStep} from '../src/driver/receiptForm.mjs';
import {driverNextStep} from '../src/driver/driverView.mjs';
const trip={reservation:'予約確定',reception:'未到着',receipt:'未確定',planned:7,soil:'第2種建設発生土',agreement:'合意済み'};
test('guidance separates agreement, booking, unloading and receiving confirmation including zero',()=>{
 assert.equal(reservationStep({...trip,reservation:'申請中'}).panel,'conditions');
 assert.equal(reservationStep({...trip,reception:'受入中'}).owner,'ドライバー');
 assert.equal(reservationStep({...trip,driverReport:true}).state,'荷下ろし報告済み');
 assert.equal(reservationStep({...trip,confirmed:0}).state,'受入完了');
 assert.equal(reservationStep({...trip,reservation:'取消',confirmed:7}).state,'取消');
 assert.equal(reservationStep({...trip,reservation:'変更依頼',matchAgreementId:'A'}).owner,'施工側');
});
test('modified quantity, soil or difference reason invalidates the previous review',()=>{
 const reviewed={...trip,receipt:'内容確認済み',actual:7.3,actualSoil:trip.soil,differenceReason:'計量差'};
 const values={actual:'7.3',actualSoil:trip.soil,reason:'計量差'};
 assert.equal(reviewedValuesMatch(reviewed,values),true);
 for(const change of [{actual:'7.4'},{actualSoil:'第1種建設発生土'},{reason:'別の差異'},{actual:''}])assert.equal(reviewedValuesMatch(reviewed,{...values,...change}),false);
 assert.equal(reservationErrors(trip,{actual:'7.3',actualSoil:trip.soil,reason:''},'review').reason,'数量または土質の差異理由を入力してください。');
 assert.equal(displayReservationHistory('12:00 confirm（試作・未送信）：計量差'),'12:00 実績確定（試作・未送信）：計量差');
});
test('receipt validation rejects blank, nonfinite and unsupported precision while retaining explicit unit',()=>{
 const value={number:'T-1',quantity:'6.9',unit:'t',photo:{filename:'ticket.png'}};
 assert.deepEqual(receiptErrors(value),{});
 for(const quantity of ['',0,-1,'Infinity','6.1234'])assert.ok(receiptErrors({...value,quantity}).quantity);
 assert.ok(receiptErrors({...value,number:'  '}).number);
 assert.ok(receiptErrors({...value,photo:null}).photo);
 assert.ok(receiptErrors({...value,unit:'kg'}).unit);
 assert.equal(receiptStep({state:'pending'}),3);assert.equal(receiptStep({photo:{}}),2);assert.equal(receiptStep({step:1,photo:{}}),1);
});
test('driver next action never turns unloading into receiving completion',()=>{
 const base={reservation:'予約確定',confirmed:null,unit:'t',reported:null};
 assert.equal(driverNextStep(base,{stage:4}).owner,'ドライバー');
 assert.equal(driverNextStep({...base,reported:8},{stage:4}).owner,'受入側');
 assert.equal(driverNextStep({...base,confirmed:0},{stage:4}).state,'受入完了');
 assert.equal(driverNextStep({...base,reservation:'申請中'},{stage:0}).state,'予約承認待ち');
});
