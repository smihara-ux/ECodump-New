import { summarizeVehicles, isRejectedTrip } from "./operationsModel.mjs";
import "./vehicleSummary.css";

export default function VehicleSummary({ rows, className = "construction-progress-grid", period = "当日の台数", selected, onSelect }) {
  const metrics = summarizeVehicles(rows);
  const rejected = rows.filter(isRejectedTrip).length;
  return <section className="vehicle-summary" aria-label={period}>
    <h3>{period}</h3>
    <div className={`${className} vehicle-metrics`}>
      {metrics.map(metric => {
        const Tag = onSelect ? "button" : "article";
        return <Tag key={metric.key} className={selected === metric.key ? "active" : ""}
          data-vehicle-state={metric.key} aria-label={`${metric.label} 実${metric.actual}台 延べ${metric.extended}台${metric.unassigned ? ` 未配車${metric.unassigned}件` : ""}`}
          {...(onSelect ? { type: "button", "aria-pressed": selected === metric.key, onClick: () => onSelect(metric.key) } : {})}>
          <span>{metric.label}</span>
          <b className="vehicle-actual"><span>実</span>{metric.actual}<small>台</small></b>
          <span className="vehicle-extended">延べ {metric.extended}台</span>
          {metric.unassigned > 0 && <small className="vehicle-unassigned">未配車 {metric.unassigned}件・実台数未確定</small>}
        </Tag>;
      })}
    </div>
    <details className="vehicle-count-explanation"><summary>台数の数え方（同じ車両2回＝実1台／延べ2台）</summary>
      <p>実台数は各項目で車両IDの重複を除き、延べ台数は運搬1回を1台として数えます。予定台数は取消を除き、受入待ちは受入確認が完了していない予定です。未配車の予定は延べ台数に含め、実台数に含めません。</p>
      <p>同じ車両に完了と待ちの運搬がある場合、両方の実台数に含まれます。各項目の実台数を足しても予定台数とは一致しない場合があります。</p>
    </details>
    {rejected > 0 && <p className="vehicle-excluded" role="note">受入不可 {rejected}件は、予定・待ち・取消の台数に含めていません。</p>}
  </section>;
}
