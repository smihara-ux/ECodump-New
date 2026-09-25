/** Shared API projection only: never supplies synthetic reservations or GPS. */
export const bookingLabels={requested:'申請中',confirmed:'予約確定',partially_completed:'一部完了・残予定取消',cancelled:'取消',rejected:'受入不可',change_requested:'変更依頼中'};
const tripLabels={assigned:'配車済み',site_arrived:'現場到着',in_transit:'積込完了・出発',receiver_arrived:'受入先到着',unloaded:'荷下ろし完了'};
export function receivingTrip(b){
 const inactive=['cancelled','rejected'].includes(b.status)||['cancelled','refused'].includes(b.trip?.status);
 const reservation=b.actual&&inactive?'実績確定・残予定取消':b.trip?.status==='cancelled'?'取消':b.trip?.status==='refused'?'受入不可':bookingLabels[b.status]||`状態未対応（${b.status}）`;
 return {id:b.trip?.id||b.id,siteId:b.site.id,vehicleId:b.trip?.vehicleId,evidence:b,actual:b.actual?.quantity,actualUnit:b.actual?.unit==='m3'?'m³':b.actual?.unit,reservationId:b.id,locationId:b.location.id,date:b.date,eta:new Date(b.trip?.plannedAt||b.plannedAt).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}),site:b.site.name,vehicle:b.vehiclePlate||b.trip?.vehicle||'未配車',rotation:b.trip?.rotation||0,planned:b.trip?.plannedQuantity??b.quantity,unit:(b.trip?.unit||b.unit)==='m3'?'m³':(b.trip?.unit||b.unit),reservation,reception:b.actual?'完了':inactive?'対象外':b.status!=='confirmed'?'承認待ち':b.trip?.status==='unloaded'?'内容確認待ち':b.trip?.status==='receiver_arrived'?'待機':'未到着',receipt:b.actual?'実績確定':'未確定',tripStatus:tripLabels[b.trip?.status]||'未配車'};
}
