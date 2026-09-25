// A booking can contain several trips; the trip is the driver-facing identity.
export const driverRowKey=b=>b.trip?.id||b.id;
export const driverPlannedAt=b=>b.trip?.plannedAt||b.plannedAt;
export const driverPlannedQuantity=b=>b.trip?.plannedQuantity??b.quantity;
export const driverDone=b=>['unloaded','cancelled','refused'].includes(b.trip?.status);
export const assignmentSnapshot=b=>({vehicleId:b.trip?.vehicleId,driverId:b.trip?.driverId,vehicle:b.trip?.vehicle,plate:b.trip?.vehiclePlate||b.vehiclePlate,site:b.site?.name,location:b.location?.name,plannedAt:driverPlannedAt(b)});
export function assignmentChanges(previous,b){if(!previous)return [];const now=assignmentSnapshot(b);return [['vehicleId','車両',previous.vehicle,now.vehicle],['driverId','担当者',previous.driverId,now.driverId],['plate','車番'],['site','搬出元'],['location','受入先'],['plannedAt','指定時刻']].filter(([key])=>previous[key]!==now[key]).map(([key,label,before,after])=>({label,before:before??previous[key],after:after??now[key]}));}
export function driverNotifications(rows){return rows.flatMap(b=>{
 const items=[];const tripId=driverRowKey(b);const route=`${b.date} / 便 ${tripId.slice(0,8)} / ${b.site.name} → ${b.location.name}`;
 if(b.receiptRecord?.status==='returned')items.push({id:`return:${tripId}`,tripId,title:'伝票の差戻し',detail:b.receiptRecord.reason||'原票と入力内容を確認してください。',route});
 if(b.receiptRecord?.status==='pending')items.push({id:`pending:${tripId}`,tripId,title:'伝票は管理側の確認待ち',detail:'提出済みです。受入実績はまだ確定していません。',route});
 for(const issue of b.issues||[])items.push({id:`issue:${issue.id}`,tripId,title:issue.status==='resolved'?'問題報告への対応済み':'問題報告は対応待ち',detail:issue.resolution||issue.reason,route});
 if(b.actual)items.push({id:`actual:${tripId}`,tripId,title:'受入実績が確定',detail:`${b.actual.quantity} ${b.actual.unit==='m3'?'m³':b.actual.unit}`,route});
 return items;
});}

// Keep the last acknowledged assignment until the driver explicitly confirms it.
export function reviewAssignments(previous, rows) {
 const snapshots={...previous},alerts={};
 for(const b of rows.filter(b=>b.canReport)){
  const key=driverRowKey(b),diff=assignmentChanges(previous[key],b);
  if(diff.length)alerts[key]=diff;
  else snapshots[key]=assignmentSnapshot(b);
 }
 return {snapshots,alerts};
}
