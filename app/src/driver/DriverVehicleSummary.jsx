import VehicleSummary from '../construction/VehicleSummary.jsx';
import {summarizeVehicles} from '../construction/operationsModel.mjs';
export default function DriverVehicleSummary({rows,period,selected,onSelect}) {
  const planned=summarizeVehicles(rows)[0];
  return <details className="driver-count-disclosure"><summary>{period} · 実{planned.actual}台／延べ{planned.extended}台</summary>
    <VehicleSummary rows={rows} period={period} className="driver-vehicle-metrics" selected={selected} onSelect={onSelect}/>
    <p>荷下ろしの報告と受入完了は別です。受入側の確認が済むまで「受入待ち」に含めます。</p>
  </details>;
}
