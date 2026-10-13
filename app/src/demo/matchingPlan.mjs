import { demoCarrier, demoCompany, demoLocations } from "./model.mjs";

export function validateMatchingPlan(agreement, plan, trips) {
  if (!agreement || !agreement.confirmations || !Object.values(agreement.confirmations).every(version => version === agreement.revision)) throw new Error("双方が合意した案件を選択してください。");
  const terms = agreement.terms;
  if (!plan.date || plan.date < terms.start || plan.date > terms.end) throw new Error("合意した期間内の日付を選択してください。");
  if (!Number.isInteger(plan.count) || plan.count < 1 || plan.count > 20 || !Number.isFinite(plan.quantity) || plan.quantity <= 0) throw new Error("便数は1〜20の整数、1便数量は正の数で入力してください。");
  if (plan.unit !== terms.unit || plan.soil !== terms.soil || plan.siteId !== agreement.sourceSiteId || plan.locationId !== agreement.targetLocationId) throw new Error("合意した現場・受入先・土質・単位を引き継いでください。相手を変更する場合は再相談が必要です。");
  if (![plan.time, plan.arrival].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || plan.arrival < plan.time) throw new Error("同日の現場指定時刻・受入指定時刻を確認してください。");
  if (trips.some(trip => trip.matchingRequestKey === plan.requestKey)) throw new Error("この予定は既に登録済みです。予約一覧で結果を確認してください。");
  const active = trips.filter(trip => trip.matchAgreementId === agreement.id && trip.unit === terms.unit && !["取消", "受入不可"].includes(trip.reservation) && trip.booking !== "取消");
  const amount = plan.count * plan.quantity;
  if (active.reduce((sum, trip) => sum + trip.planned, 0) + amount > terms.volume + 1e-9) throw new Error("合意した総数量を超えます。残り数量を確認してください。");
  if (active.filter(trip => trip.date === plan.date).reduce((sum, trip) => sum + trip.planned, 0) + amount > terms.daily + 1e-9) throw new Error("合意した1日あたりの上限を超えます。");
}

export function createMatchingPlanTrips(agreement, plan, trips, makeId = () => crypto.randomUUID(), at = new Date().toISOString()) {
  validateMatchingPlan(agreement, plan, trips);
  const location = demoLocations.find(item => item.databaseId === agreement.targetLocationId);
  if (!location) throw new Error("合意した受入場所が見つかりません。");
  const reservationId = `MATCH-R-${makeId()}`;
  return Array.from({ length: plan.count }, (_, index) => ({
    id: `MATCH-TR-${makeId()}`, reservationId, date: plan.date,
    matchingRequestKey: plan.requestKey, matchAgreementId: agreement.id,
    sourceCaseId: agreement.sourceCaseId, targetCaseId: agreement.targetCaseId,
    consultationId: agreement.consultationId, agreementRevision: agreement.revision,
    agreementSnapshot: structuredClone(agreement), source: "マッチング成立案件",
    siteId: agreement.sourceSiteId, departure: agreement.sourceSiteName,
    locationId: location.id, locationDatabaseId: location.databaseId, destination: location.name,
    companyId: agreement.sourceCompanyId, company: demoCompany, carrier: demoCarrier,
    vehicleId: "", driverId: "", vehicle: "未配車", driver: "未配車",
    material: agreement.terms.soil, planned: plan.quantity, unit: agreement.terms.unit,
    departAt: plan.time, arriveAt: plan.arrival, siteScheduledAt: plan.time, receivingScheduledAt: plan.arrival,
    booking: "有効", reservation: "申請中", reception: "未到着", operation: "未手配", assignmentVersion: 1,
    reported: null, confirmed: null, received: null, departed: null, unloaded: null,
    slip: "未提出", issue: "なし", agreement: `条件合意 第${agreement.revision}版（デモ）`,
    history: [{ at, message: `${agreement.id} 第${agreement.revision}版から予約申請 ${index + 1}/${plan.count}便（デモ・未送信）` }],
  }));
}
