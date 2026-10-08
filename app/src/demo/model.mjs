import { naritaIds as ids } from "./naritaIds.mjs";
export const demoCompany = "WINNERS建設〈検証用〉";
export const demoCarrier = "成田モデル運送〈架空〉";
export const demoSites = [
  {
    id: ids.siteA,
    alias: "32182",
    name: "成田空港モデル現場 A工区",
    planned: 6400,
    unit: "m³",
  },
  {
    id: ids.siteB,
    alias: "32183",
    name: "成田空港モデル現場 B工区",
    planned: 1800,
    unit: "t",
  },
];
export const demoLocations = [
  {
    id: "Y-01",
    databaseId: ids.locationTochigi,
    name: "栃木モデル採石場〈架空〉",
    code: "R-01",
  },
  {
    id: "Y-02",
    databaseId: ids.locationIbaraki,
    name: "茨城モデル採石場〈架空〉",
    code: "R-02",
  },
];
export const demoDrivers = [
  { id: ids.driverAoki, name: "青木 太郎〈架空〉" },
  { id: ids.driverSato, name: "佐藤 健〈架空〉" },
  { id: ids.driverSuzuki, name: "鈴木 一郎〈架空〉" },
];
export const demoVehicles = ["01", "02", "03"].map((n, i) => ({
  id: ids[`vehicle${n}`],
  name: `検証ダンプ ${n}`,
  number: `成田 100 を 01-0${i + 1}`,
  kind: "大型ダンプ",
  capacity: "9.5t",
  company: demoCarrier,
  expires: i === 1 ? "2026-09-30" : "2027-09-30",
  driverId: demoDrivers[i].id,
  attachment: null,
}));
export const demoDay = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
export function dayOffset(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function numberTrips(trips) {
  const vehicleCounts = {},
    driverCounts = {};
  const numbered = [...trips]
    .sort((a, b) =>
      `${a.date} ${a.departAt} ${a.id}`.localeCompare(
        `${b.date} ${b.departAt} ${b.id}`,
      ),
    )
    .map((t) => {
      const v = `${t.date}:${t.vehicleId}`,
        d = `${t.date}:${t.driverId}`;
      const vehicleSequence = t.vehicleId
        ? (vehicleCounts[v] = (vehicleCounts[v] || 0) + 1)
        : null;
      const driverSequence = t.driverId
        ? (driverCounts[d] = (driverCounts[d] || 0) + 1)
        : null;
      return {
        ...t,
        vehicleSequence,
        driverSequence,
        tripNo: vehicleSequence ? `車両の当日${vehicleSequence}便目` : "未配車",
      };
    });
  return trips.map((t) => numbered.find((x) => x.id === t.id));
}
export function createNaritaDemo(date = demoDay()) {
  const config = [
    [0, 0, 0, "08:30", "09:45", "受入確認済み", 7, 6.9, 6.8, "m³"],
    [1, 1, 1, "09:10", "10:30", "遅延", 8, null, null, "t"],
    [0, 1, 2, "10:00", "11:20", "運行中", 7, null, null, "m³"],
    [1, 0, -1, "13:30", "14:50", "未手配", 8, null, null, "t"],
    [0, 0, 0, "11:30", "12:45", "報告済み", 7, 7.2, null, "m³"],
    [1, 1, 1, "12:15", "13:35", "取消", 8, null, null, "t"],
    [0, 1, 0, "08:45", "10:00", "配車済み", 7, null, null, "m³"],
  ];
  return numberTrips(
    config.map(
      (
        [
          s,
          l,
          v,
          departAt,
          arriveAt,
          operation,
          planned,
          reported,
          confirmed,
          unit,
        ],
        i,
      ) => {
        const site = demoSites[s],
          location = demoLocations[l],
          vehicle = demoVehicles[v],
          driver = demoDrivers[i === 2 ? 0 : v];
        const tripDate = i === 6 ? dayOffset(date, 1) : date;
        return {
          id: `TR-202608${i === 6 ? "21" : "20"}-${String(i === 6 ? 1 : i + 1).padStart(2, "0")}`,
          reservationId: `NARITA-R-${i + 1}`,
          siteId: site.id,
          locationId: location.id,
          locationDatabaseId: location.databaseId,
          companyId: ids.orgConstruction,
          company: demoCompany,
          departure: site.name,
          destination: location.name,
          carrier: demoCarrier,
          carrierId: ids.orgCarrier,
          vehicleId: vehicle?.id || "",
          vehicle: vehicle?.number || "未配車",
          vehicleName: vehicle?.name || "未配車",
          driverId: driver?.id || "",
          driver: driver?.name || "未配車",
          date: tripDate,
          day: i === 6 ? "翌日" : "当日",
          departAt,
          arriveAt,
          siteScheduledAt: departAt,
          receivingScheduledAt: arriveAt,
          material: "第2種建設発生土",
          travelMinutes: 75,
          workMinutes: 30,
          operation,
          booking: operation === "取消" ? "取消" : "有効",
          reservation: operation === "未手配" ? "申請中" : "予約確定",
          reception:
            confirmed != null
              ? "完了"
              : reported != null
                ? "内容確認待ち"
                : "未到着",
          departed: ["受入確認済み", "遅延", "運行中", "報告済み"].includes(
            operation,
          )
            ? departAt
            : null,
          unloaded: reported != null ? arriveAt : null,
          received: confirmed != null ? "10:05" : null,
          planned,
          reported,
          confirmed,
          unit,
          slip:
            confirmed != null
              ? "確認済み"
              : reported != null
                ? "確認待ち"
                : "未提出",
          ticketId: reported != null ? `NARITA-W-${i + 1}` : null,
          issue: operation === "遅延" ? "道路混雑・到着見込み確認中" : "なし",
          assignmentVersion: 1,
          history: [],
          correctionHistory: "訂正なし",
          actualDestination: confirmed != null ? location.name : null,
          source: "直接予約",
          agreement: "成田モデル条件 v1（デモ）",
        };
      },
    ),
  );
}
export function asReceiving(t) {
  return {
    ...t,
    site: t.departure,
    partner: t.company,
    soil: t.material,
    eta: t.arriveAt,
    sequence: t.vehicleSequence,
    rotation: t.vehicleSequence,
    reservation:
      t.reservation === "受入不可"
        ? "受入不可"
        : t.booking === "取消"
          ? "取消"
          : t.reservation || "予約確定",
    driverReport: Boolean(t.unloaded),
    tripStatus: t.unloaded ? "運行完了" : t.operation,
    actual: t.confirmed ?? t.actual ?? "",
    actualSoil: t.actualSoil || t.material,
    receipt: t.confirmed != null ? "実績確定" : t.receipt || "未確定",
    confirmedAt: t.received || "",
    confirmedBy: t.confirmed != null ? "成田モデル承認者〈架空〉" : "",
    reason: t.reason || "",
    delay: t.issue === "なし" ? "" : t.issue,
    differenceReason: t.differenceReason || "",
    history: t.history.map((h) =>
      typeof h === "string" ? h : `${h.at} ${h.message}`,
    ),
  };
}
export function mergeReceiving(original, r) {
  return {
    ...original,
    ...r,
    departure: r.site,
    arriveAt: r.eta,
    receivingScheduledAt: r.eta,
    booking: ["取消", "受入不可"].includes(r.reservation) ? "取消" : "有効",
    confirmed: r.receipt === "実績確定" ? Number(r.actual) : original.confirmed,
    unloaded: r.driverReport
      ? original.unloaded || "仮報告（未送信）"
      : original.unloaded,
    received:
      r.receipt === "実績確定"
        ? r.confirmedAt || "デモ確認済み"
        : original.received,
    operation:
      r.receipt === "実績確定"
        ? "受入確認済み"
        : r.reservation === "取消"
          ? "取消"
          : r.tripStatus === "運行完了"
            ? "報告済み"
            : original.operation,
    slip: r.receipt === "実績確定" ? "確認済み" : original.slip,
    actualDestination:
      r.receipt === "実績確定"
        ? original.destination
        : original.actualDestination,
  };
}
export function asDriver(t) {
  return {
    ...t,
    cancelled: t.booking === "取消",
    sequence: t.driverSequence,
    rotation: t.driverSequence,
    time: t.departAt,
    arrival: t.arriveAt,
    from: t.departure,
    to: t.destination,
    registration: t.vehicle,
    vehicle: t.vehicleName,
    soil: t.material,
    quantity: t.planned,
    baseStage:
      t.driverInitialStage ??
      (t.unloaded ? 4 : t.reception === "受入中" ? 3 : t.departed ? 2 : 0),
  };
}
export function asControl(t) {
  return {
    ...t,
    cargo: "建設発生土",
    plannedVolume: `${t.planned} ${t.unit}`,
    actualVolume: t.confirmed == null ? "未確定" : `${t.confirmed} ${t.unit}`,
    time: t.departAt,
    from: `S-0${t.siteId === ids.siteA ? 1 : 2} ${t.departure}`,
    to: `${demoLocations.find((l) => l.id === t.locationId)?.code || "R-01"} ${t.destination}`,
    eta: t.arriveAt,
    status:
      t.booking === "取消"
        ? "取消"
        : t.confirmed != null
          ? "完了"
          : t.operation === "報告済み"
            ? "受入中"
            : t.operation === "配車済み" || t.operation === "未手配"
              ? "待機中"
              : t.operation,
  };
}
export function planProgress(site, trips) {
  const rows = trips.filter(
    (t) => t.siteId === site.id && t.unit === site.unit,
  );
  const confirmed = rows.reduce((n, t) => n + (t.confirmed ?? 0), 0);
  return {
    planned: site.planned,
    confirmed,
    remaining: Math.max(0, site.planned - confirmed),
    over: Math.max(0, confirmed - site.planned),
    percent: site.planned ? (confirmed / site.planned) * 100 : 0,
    reportedPending: rows
      .filter(
        (t) =>
          t.confirmed == null &&
          t.booking !== "取消" &&
          (t.reportedUnit || t.unit) === site.unit,
      )
      .reduce((n, t) => n + (t.reported ?? 0), 0),
  };
}
