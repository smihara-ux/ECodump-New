import {
  buildOperationsWorkbook,
  downloadOperationsWorkbook,
} from "./exportWorkbook.mjs";
// Shared construction/receiving projection. Input must already be server-scoped.
export const bookingDate = (b) =>
  b.trip?.plannedAt
    ? new Date(b.trip.plannedAt).toLocaleDateString("sv-SE", {
        timeZone: "Asia/Tokyo",
      })
    : b.date;
export const reportUnit = (u) => (u === "m3" ? "m³" : u);
// Format only the presentation; totals and workbook values retain their precision.
export const formatReportQuantity = (value) => value == null ? "未報告" :
  new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
export function transportRows(bookings) {
  return bookings.map((b) => {
    const receipt = b.receiptRecord,
      confirmed = receipt?.status === "confirmed" && b.actual;
    return {
      id: b.trip?.id || b.id,
      bookingId: b.id,
      date: bookingDate(b),
      locationId: b.location.id,
      location: b.location.name,
      site: b.site.name,
      siteId: b.site.id,
      soil: b.soil,
      vehicle: b.vehiclePlate || b.trip?.vehicle || "未配車",
      vehicleId: b.trip?.vehicleId || "",
      driver: b.trip?.driver || "未配車",
      carrier: b.vehicleCompany || b.carrierCompany || b.trip?.carrier || "API未提供",
      plannedAt: b.trip?.plannedAt || b.plannedAt,
      planned: Number(b.trip?.plannedQuantity ?? b.quantity),
      unit: reportUnit(b.trip?.unit || b.unit),
      reported: receipt ? Number(receipt.quantity) : null,
      reportedUnit: reportUnit(receipt?.unit),
      confirmed: confirmed ? Number(b.actual.quantity) : null,
      confirmedUnit: reportUnit(b.actual?.unit),
      cancelled:
        ["cancelled", "rejected"].includes(b.status) ||
        ["cancelled", "refused"].includes(b.trip?.status),
      receipt: receipt?.status || "未提出",
      correction: (b.receiptHistory || receipt?.history || []).filter(
        (h) => h.action === "correct" || h.action === "receipt_correct",
      ).length,
      arrival:
        (b.events || []).filter((e) => e.state === "receiver_arrived").at(-1)
          ?.reportedAt || "",
      entry:
        (b.gateRecords || []).find(
          (g) => g.direction === "entry" && g.status === "confirmed",
        )?.occurred_at || "",
      unloaded:
        (b.events || []).filter((e) => e.state === "unloaded").at(-1)
          ?.reportedAt || "",
      status: b.trip?.status || b.status,
    };
  });
}
export function reportTotals(rows) {
  return ["m³", "t"].map((unit) => ({
    unit,
    count: rows.filter((r) => r.unit === unit).length,
    vehicles: new Set(
      rows
        .filter((r) => r.unit === unit && r.vehicleId)
        .map((r) => r.vehicleId),
    ).size,
    cancelled: rows.filter((r) => r.unit === unit && r.cancelled).length,
    planned: rows
      .filter((r) => r.unit === unit && !r.cancelled)
      .reduce((s, r) => s + r.planned, 0),
    reported: rows
      .filter(
        (r) => r.reportedUnit === unit && r.reported !== null && !r.cancelled,
      )
      .reduce((s, r) => s + r.reported, 0),
    confirmed: rows
      .filter((r) => r.confirmedUnit === unit && r.confirmed !== null)
      .reduce((s, r) => s + r.confirmed, 0),
    pending: rows.filter(
      (r) => r.unit === unit && !r.cancelled && r.confirmed === null,
    ).length,
  }));
}
function workbookOptions(
  rows,
  { context = "受入", period = "", sample = false, filters = {} } = {},
) {
  return {
    title: `ECO DUMP ${context}実績`,
    conditions: {
      対象期間: period,
      ...filters,
      データ: sample ? "試作データ・API未接続" : "共通API取得データ",
      取消: "有効予定・報告から除外。保存済み確定実績は保持。",
      訂正: "訂正後の受入確定値を集計。履歴件数を明細に表示。",
    },
    summaryRows: reportTotals(rows).flatMap((t) => [
      ["対象行数", t.unit, t.count],
      ["実車両台数", t.unit, t.vehicles],
      ["取消・受入不可", t.unit, t.cancelled],
      ["有効予定数量", t.unit, t.planned],
      ["報告数量", t.unit, t.reported],
      ["受入確定数量", t.unit, t.confirmed],
      ["未確定件数", t.unit, t.pending],
    ]),
    detailHeaders: [
      "便ID（未配車は予約ID）",
      "予約ID",
      "日付",
      "受入場所",
      "搬出元",
      "土質",
      "車両番号",
      "運送会社",
      "ドライバー",
      "到着予定（予約時刻）",
      "到着報告",
      "受付",
      "荷下ろし報告",
      "状態",
      "予定数量",
      "予定単位",
      "報告数量",
      "報告単位",
      "受入確定数量",
      "確定単位",
      "伝票状態",
      "取消・受入不可",
      "訂正履歴件数",
    ],
    detailRows: rows.map((r) => [
      r.id,
      r.bookingId,
      r.date,
      r.location,
      r.site,
      r.soil,
      r.vehicle,
      r.carrier,
      r.driver,
      r.plannedAt,
      r.arrival,
      r.entry,
      r.unloaded,
      r.status,
      r.planned,
      r.unit,
      r.reported,
      r.reportedUnit,
      r.confirmed,
      r.confirmedUnit,
      r.receipt,
      r.cancelled ? "対象" : "",
      r.correction,
    ]),
  };
}
export function transportWorkbook(rows, options) {
  return buildOperationsWorkbook(workbookOptions(rows, options));
}
export function downloadTransportWorkbook(rows, options) {
  return downloadOperationsWorkbook(workbookOptions(rows, options));
}
