/** Aggregate confirmed values by their original unit; no conversion or pending inclusion. */
export function resultGroups(rows,group){
 const groups=new Map();
 for(const b of rows){
  if((['cancelled','rejected'].includes(b.status)||['cancelled','refused'].includes(b.trip?.status))&&!b.actual)continue;
  const name=group==='soil'?b.soil:group==='company'?(b.constructionCompany||b.construction?.name||'施工会社情報未提供'):b.site.name;
  const units=new Set([b.trip?.unit||b.unit,b.receiptRecord?.unit,b.actual?.unit].filter(Boolean));
  for(const unit of units){const k=name+'|'+unit;if(!groups.has(k))groups.set(k,{name,unit,trips:new Set(),vehicles:new Set(),missing:0,returned:0,pending:0,confirmed:0});const g=groups.get(k);
   if(b.trip){g.trips.add(b.trip.id);if(b.trip.vehicleId)g.vehicles.add(b.trip.vehicleId);}
   if(b.trip&&!b.receiptRecord&&unit===(b.trip?.unit||b.unit))g.missing++;
   if(b.receiptRecord?.unit===unit){if(b.receiptRecord.status==='returned')g.returned++;if(b.receiptRecord.status==='pending')g.pending++;}
   if(b.receiptRecord?.status==='confirmed'&&b.actual?.unit===unit)g.confirmed+=Number(b.actual.quantity);
  }
 }
 return [...groups.values()];
}
