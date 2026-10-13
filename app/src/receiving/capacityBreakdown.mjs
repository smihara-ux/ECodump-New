export function sourceQuantityRows(trips, { year, month, day, unit, locationId, metric }) {
  return trips.filter(trip => {
    const [y, m, d] = String(trip.date || "").split("-").map(Number);
    return y === Number(year) && (month === "all" || m === Number(month)) && (!day || d === day) &&
      (!locationId || trip.locationId === locationId) && trip.booking !== "取消" && !["取消", "受入不可"].includes(trip.reservation) &&
      (metric === "受入確定量" ? trip.confirmed != null && (trip.actualUnit || trip.unit) === unit : trip.confirmed == null && trip.unit === unit);
  }).map(trip => ({ ...trip, quantity: metric === "受入確定量" ? Number(trip.confirmed) : Number(trip.planned) }))
    .filter(trip => Number.isFinite(trip.quantity) && trip.quantity >= 0);
}
export function sourceQuantityGroups(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const id = row.siteId || row.departure;
    if (!groups.has(id)) groups.set(id, { id, name: row.departure || row.site, quantity: 0, trips: [] });
    const group = groups.get(id); group.quantity += row.quantity; group.trips.push(row);
  });
  return [...groups.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
