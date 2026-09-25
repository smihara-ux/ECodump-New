export const cancelled=t=>['取消','受入不可'].includes(t.reservation);
export const confirmed=t=>t.receipt==='実績確定';
export const filters={
 '予定':t=>!cancelled(t), '実績':t=>!cancelled(t)&&confirmed(t),
 '未着':t=>!cancelled(t)&&t.reception==='未到着', '取消':t=>t.reservation==='取消',
 '差分':t=>!cancelled(t)&&!confirmed(t),
 '未確認伝票':t=>!cancelled(t)&&(t.evidence?t.evidence.receiptRecord?.status!=='confirmed':!confirmed(t)),
 '待機':t=>!cancelled(t)&&t.reception==='待機',
 '受入中':t=>!cancelled(t)&&['受入中','内容確認待ち'].includes(t.reception),
 '到着予定':t=>!cancelled(t)&&t.reception==='未到着', '完了':t=>!cancelled(t)&&confirmed(t), '本日の予定':t=>!cancelled(t)
};
export function summarize(rows){
 const active=rows.filter(t=>!cancelled(t));
 const quantities=['m³','t'].map(unit=>({unit,planned:active.filter(t=>t.unit===unit).reduce((n,t)=>n+Number(t.planned||0),0),confirmed:active.filter(t=>confirmed(t)&&(!t.evidence||t.evidence.receiptRecord?.status==='confirmed')&&(t.actualUnit||t.unit)===unit).reduce((n,t)=>n+Number(t.actual||0),0),pending:active.filter(t=>!confirmed(t)&&t.evidence?.receiptRecord?.status==='pending'&&(t.evidence.receiptRecord.unit==='m3'?'m³':t.evidence.receiptRecord.unit)===unit).reduce((n,t)=>n+Number(t.evidence.receiptRecord.quantity),0)}));
 return {vehicles:new Set(active.map(t=>t.vehicleId||t.vehicle).filter(v=>v&&v!=='未配車')).size,rotations:active.length,quantities};
}
export function stayMinutes(records){
 const valid=records.filter(r=>r.status==='confirmed');const ins=valid.filter(r=>r.direction==='entry'),outs=valid.filter(r=>r.direction==='exit');
 if(ins.length!==1||outs.length!==1)return null;
 const value=(new Date(outs[0].occurred_at)-new Date(ins[0].occurred_at))/60000;
 return Number.isFinite(value)&&value>=0?Math.round(value):null;
}
