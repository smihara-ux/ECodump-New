import {driverDay} from './dayView.mjs';
export const driverViewKey='ecodump-driver-view-v1';
export function readDriverView(storage=globalThis.sessionStorage) {
  const base={tab:'today',date:driverDay(),endDate:driverDay(),filter:'',state:'すべて',scroll:{}};
  try {
    const saved=JSON.parse(storage.getItem(driverViewKey)||'{}');
    const date=/^\d{4}-\d{2}-\d{2}$/.test(saved.date)?saved.date:base.date;
    return {...base,...saved,tab:['today','history','notifications','profile'].includes(saved.tab)?saved.tab:base.tab,date,endDate:saved.endDate>=date?saved.endDate:date,scroll:saved.scroll||{}};
  }catch{return base;}
}
export function writeDriverView(view,storage=globalThis.sessionStorage) {
  try{storage.setItem(driverViewKey,JSON.stringify(view));}catch{}
}
export function driverReceiptLabel(trip) {
  return trip.confirmed!=null?`受入確認済み ${trip.confirmed} ${trip.unit}`:'受入確認待ち';
}

export function driverNextStep(trip, {stage,acknowledged,held,isNext=true}) {
  if(trip.cancelled)return {state:'取消',owner:'対応終了',next:'取消内容を確認してください。'};
  if(trip.confirmed!=null)return {state:'受入完了',owner:'対応終了',next:`受入側が ${trip.confirmed} ${trip.unit} を確認済みです。`};
  if(held)return {state:'受入不可・保留',owner:'管理者・受入側',next:'待機して、問題報告の内容を確認してください。'};
  if(trip.reservation!=='予約確定')return {state:'予約承認待ち',owner:'受入側',next:'予約承認後に運行の報告へ進めます。'};
  if(stage>=4)return {state:'荷下ろし報告済み',owner:trip.reported==null?'ドライバー':'受入側',next:trip.reported==null?'原票写真と数量を確認してください。':'受入側の数量確認待ちです。受入実績はまだ未確定です。',receipt:true};
  if(!acknowledged)return {state:'出発前の確認',owner:'ドライバー',next:'本人・車両・行先を確認してください。'};
  if(!isNext)return {state:'先行する運行の確認待ち',owner:'ドライバー',next:'今日の運行に戻り、先に対応する便を確認してください。'};
  return {state:['配車済み','搬出元到着','運行中','受入先到着'][stage]||'運行中',owner:'ドライバー',next:['搬出元に到着したら報告してください。','出発したら報告してください。','受入先に到着したら報告してください。','荷下ろしが完了したら報告してください。'][stage]||'運行の状況を確認してください。'};
}
