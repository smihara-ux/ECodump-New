const pad = (value) => String(value).padStart(2, "0");

export function todayJst(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

export function addDays(date, amount) {
  const value = new Date(`${date || todayJst()}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

const sampleStates = [
  { operation: "受入確認済み", booking: "有効", departed: "08:04", unloaded: "09:08", received: "09:18", slip: "確認済み", planned: 7, reported: 6.9, confirmed: 6.8, unit: "m³" },
  { operation: "遅延", booking: "有効", departed: "09:22", unloaded: null, received: null, slip: "未提出", planned: 8, reported: null, confirmed: null, unit: "t" },
  { operation: "運行中", booking: "有効", departed: "10:31", unloaded: null, received: null, slip: "提出待ち", planned: 7, reported: null, confirmed: null, unit: "m³" },
  { operation: "未手配", booking: "有効", departed: null, unloaded: null, received: null, slip: "未提出", planned: 8, reported: null, confirmed: null, unit: "t" },
  { operation: "報告済み", booking: "有効", departed: "11:34", unloaded: "12:31", received: null, slip: "確認待ち", planned: 7, reported: 7.2, confirmed: null, unit: "m³" },
  { operation: "取消", booking: "取消", departed: null, unloaded: null, received: null, slip: "対象外", planned: 7, reported: null, confirmed: null, unit: "m³" },
];

export function constructionTrips(plans, baseDate = todayJst()) {
  return plans.map((plan, index) => {
    const state = sampleStates[index % sampleStates.length];
    const offset = plan.day === "前日" ? -1 : plan.day === "翌日" ? 1 : 0;
    return {
      ...plan,
      date: addDays(baseDate, offset),
      tripNo: `${index + 1}便目`,
      carrier: index % 2 ? "モデル運送 B〈架空〉" : "モデル運送 A〈架空〉",
      siteScheduledAt: plan.departAt,
      receivingScheduledAt: plan.arriveAt,
      ...state,
      ticketId: state.slip === "未提出" || state.slip === "対象外" ? null : `W-${baseDate.replaceAll("-", "")}-${pad(index + 1)}`,
      issue: state.operation === "遅延" ? "道路混雑・到着見込み確認中" : "なし",
      correctionHistory: state.reported != null && state.confirmed != null ? "受入計量により確定値を記録" : "訂正なし",
    };
  });
}

export const isActiveTrip = (trip) => trip.booking !== "取消";

export function matchesTripState(trip, filter) {
  if (filter === "すべて") return true;
  if (filter === "有効予定") return isActiveTrip(trip);
  if (filter === "未搬出") return isActiveTrip(trip) && !trip.departed;
  if (filter === "搬出済み・受入未完了") return isActiveTrip(trip) && Boolean(trip.departed) && !trip.received;
  if (filter === "受入完了") return isActiveTrip(trip) && Boolean(trip.received);
  if (filter === "取消") return !isActiveTrip(trip);
  if (filter === "伝票確認待ち") return trip.slip === "確認待ち";
  return trip.operation === filter;
}

export function summarizeTrips(rows) {
  const values = {
    active: rows.filter(isActiveTrip).length,
    notDeparted: rows.filter((row) => isActiveTrip(row) && !row.departed).length,
    exportedPending: rows.filter((row) => isActiveTrip(row) && row.departed && !row.received).length,
    received: rows.filter((row) => isActiveTrip(row) && row.received).length,
    cancelled: rows.filter((row) => !isActiveTrip(row)).length,
  };
  values.quantities = ["m³", "t"].map((unit) => {
    const unitRows = rows.filter((row) => isActiveTrip(row) && row.unit === unit);
    const planned = unitRows.reduce((sum, row) => sum + row.planned, 0);
    const reported = unitRows.reduce((sum, row) => sum + (row.reported || 0), 0);
    const confirmedRows = rows.filter(row => row.unit === unit && row.confirmed != null);
    const confirmed = confirmedRows.reduce((sum, row) => sum + row.confirmed, 0);
    const remaining = unitRows.filter(row => row.confirmed == null).reduce((sum, row) => sum + row.planned, 0);
    const variance = confirmedRows.reduce((sum, row) => sum + row.confirmed - row.planned, 0);
    return { unit, planned, reported, confirmed, remaining, variance };
  });
  return values;
}
