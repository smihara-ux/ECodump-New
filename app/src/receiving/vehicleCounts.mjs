import {summarizeVehicles} from '../construction/operationsModel.mjs';
import {cancelled,confirmed} from './receivingSummary.mjs';

// Adapt receiving/API projections without changing construction's count rules.
export function receivingVehicleRows(rows) {
  return rows.map(row=>{
    const rejected=row.reservation==='受入不可'||row.evidence?.status==='rejected'||row.evidence?.trip?.status==='refused';
    const complete=row.evidence?confirmed(row):confirmed(row)||row.confirmed!=null;
    return {...row,
      vehicleId:row.vehicleId||row.evidence?.trip?.vehicleId||'',
      reservation:rejected?'受入不可':row.reservation,
      booking:cancelled(row)||row.booking==='取消'||row.operation==='取消'?'取消':'有効',
      confirmed:complete?Number(row.actual??row.confirmed??row.evidence?.actual?.quantity??0):null,
      received:complete?'確認済み':null,
    };
  });
}
export function receivingVehicleExport(rows) {
  return Object.fromEntries(summarizeVehicles(receivingVehicleRows(rows)).map(m=>[m.label,`実${m.actual}台／延べ${m.extended}台${m.unassigned?`（未配車${m.unassigned}件）`:''}`]));
}
