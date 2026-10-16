import VehicleSummary from '../construction/VehicleSummary.jsx';
import {receivingVehicleRows} from './vehicleCounts.mjs';
export {receivingVehicleRows,receivingVehicleExport} from './vehicleCounts.mjs';
export default function ReceivingVehicleSummary({rows,...props}) {
  return <VehicleSummary rows={receivingVehicleRows(rows)} className="receiving-vehicle-metrics" {...props}/>;
}
