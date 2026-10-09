import { transportRows, formatReportQuantity } from "../reports/transportReport.mjs";
const time = (v) =>
  v && !Number.isNaN(new Date(v).getTime())
    ? new Date(v).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未記録";
export function demoReportRows(trips, locations) {
  return trips.map((t) => ({
    id: t.id,
    bookingId: t.reservationId,
    date: t.date,
    locationId: t.locationId,
    location: locations.find((l) => l.id === t.locationId)?.name || "",
    site: t.site,
    soil: t.soil || "未登録",
    vehicle: t.vehicle,
    vehicleId: t.vehicleId || (t.vehicle === "未配車" ? "" : t.vehicle),
    driver: t.driver || "未登録",
    carrier: t.carrier || "未登録",
    plannedAt: `${t.date}T${t.eta}:00+09:00`,
    planned: Number(t.planned),
    unit: t.unit,
    reported:
      t.reported != null && t.reported !== ""
        ? Number(t.reported)
        : null,
    reportedUnit: t.reportedUnit || t.unit,
    confirmed: t.receipt === "実績確定" ? Number(t.actual) : null,
    confirmedUnit: t.unit,
    cancelled: ["取消", "受入不可"].includes(t.reservation),
    receipt: t.receipt,
    correction: 0,
    arrival: t.arrivedAt || "",
    entry: t.enteredAt || "",
    unloaded: t.unloadedAt || "",
    status: t.reception,
  }));
}
export default function TripList({ rows, onOpen }) {
  const sorted = [...rows].sort((a, b) =>
    String(a.plannedAt).localeCompare(String(b.plannedAt)),
  );
  return (
    <div className="receiving-trip-list">
      <p>
        到着予定順。予定時刻は予約時刻であり、GPSによるリアルタイム予測ではありません。
      </p>
      <table>
        <thead>
          <tr>
            <th>到着予定・搬出元</th>
            <th>車両・担当</th>
            <th>報告・受付</th>
            <th>数量・伝票</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td data-label="到着予定・搬出元">
                {time(r.plannedAt)}
                <br />
                {r.site}
                <small>
                  {r.location}
                  <br />便 {r.id}
                </small>
              </td>
              <td data-label="車両・担当">
                <b>{r.vehicle}</b>
                <br />
                {r.carrier}
                <br />
                {r.driver}
              </td>
              <td data-label="報告・受付">
                状態：
                {{
                  assigned: "配車済み",
                  site_arrived: "搬出元到着",
                  in_transit: "向かっています",
                  receiver_arrived: "到着報告済み",
                  unloaded: "荷下ろし報告済み",
                  requested: "申請中",
                  change_requested: "変更承認待ち",
                  cancelled: "取消",
                  refused: "受入不可",
                }[r.status] || r.status}
                <br />
                到着報告：{time(r.arrival)}
                <br />
                受付：{time(r.entry)}
                <br />
                荷下ろし報告：{time(r.unloaded)}
              </td>
              <td data-label="数量・伝票">
                予定：{formatReportQuantity(r.planned)} {r.unit}
                <br />
                報告：{r.reported == null ? "未提出" : formatReportQuantity(r.reported)}{" "}
                {r.reported !== null ? r.reportedUnit : ""}
                <br />
                受入確定：{r.confirmed == null ? "未確定" : formatReportQuantity(r.confirmed)}{" "}
                {r.confirmed !== null ? r.confirmedUnit : ""}
                <br />
                伝票：
                {{
                  pending: "確認待ち",
                  returned: "差戻し",
                  confirmed: "確定済み",
                }[r.receipt] || r.receipt}
                <br />
                {r.cancelled
                  ? "取消・受入不可"
                  : r.confirmed !== null
                    ? "受入完了"
                    : "未完了"}
              </td>
              <td>
                <button
                  aria-label={r.id + "の予約詳細"}
                  onClick={() => onOpen(r.id)}
                >
                  受付・原票・運行詳細
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && <p>対象便はありません。</p>}
    </div>
  );
}
export { transportRows };
