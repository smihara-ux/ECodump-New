// Anonymous, in-memory prototype. No API calls or persistence.
export const demoDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
}).format(new Date());
export function nextDate(date) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
export const soils = ["第1種建設発生土", "第2種建設発生土", "第3種建設発生土"];
export const seedLocations = [
  {
    id: "Y-01",
    name: "サンプル受入ヤード A",
    address: "サンプル市 東地区（架空）",
    entrance: "東側入口・受付で便IDを提示",
    hours: "08:00–17:00",
    contact: "サンプル担当 A",
    soil: soils[1],
    capacity: 1200,
    slots: "08:00–12:00 / 13:00–17:00",
    slotLimit: 12,
    holidays: "日曜・祝日",
    notes: "場内は徐行。シートは指定場所で外してください。",
    privateNotes: "取引先専用：到着前に受付へ連絡してください。",
    visibility: "公開",
    congestion: "やや混雑",
  },
  {
    id: "Y-02",
    name: "サンプル受入ヤード B",
    address: "サンプル市 西地区（架空）",
    entrance: "南側入口・一方通行",
    hours: "09:00–16:00",
    contact: "サンプル担当 B",
    soil: soils[2],
    capacity: 800,
    slots: "09:00–12:00 / 13:00–16:00",
    slotLimit: 8,
    holidays: "土曜・日曜",
    notes: "昼休み中は入場できません。",
    privateNotes: "取引先専用：受付順で誘導します。",
    visibility: "取引先のみ",
    congestion: "空きあり",
  },
  {
    id: "Y-03",
    name: "サンプル受入ヤード C",
    address: "サンプル市 北地区（架空）",
    entrance: "北側ゲート",
    hours: "08:30–17:00",
    contact: "サンプル担当 C",
    soil: soils[0],
    capacity: 600,
    slots: "08:30–12:00 / 13:00–17:00",
    slotLimit: 6,
    holidays: "日曜",
    notes: "入口で誘導員の指示に従ってください。",
    privateNotes: "取引先専用：大型車は北側で待機。",
    visibility: "公開",
    congestion: "混雑",
  },
];
export function createDemoTrips() {
  const steps = [
    "申請中",
    "予約確定",
    "予約確定",
    "予約確定",
    "予約確定",
    "予約確定",
    "予約確定",
  ];
  return steps.map((reservation, index) => ({
    id: `T-${String(index + 1).padStart(3, "0")}`,
    reservationId: `R-${String(index + 1).padStart(3, "0")}`,
    sequence: 1,
    rotation: index === 1 ? 2 : 1,
    locationId: index < 5 ? "Y-01" : "Y-02",
    site: `サンプル搬出現場 ${index < 2 ? "A" : String.fromCharCode(65 + index)}`,
    partner: "サンプル施工会社 A",
    vehicle: index < 2 ? "サンプル車両 01" : `サンプル車両 0${index}`,
    driver: `サンプル運転者 ${index < 2 ? "A" : String.fromCharCode(65 + index)}`,
    date: index === 6 ? nextDate(demoDate) : demoDate,
    eta: ["09:00", "11:00", "09:30", "09:45", "10:00", "10:30", "13:00"][index],
    source: index % 2 ? "直接予約" : "発生土マッチ",
    agreement: "条件合意済み（サンプル v1）",
    soil: index < 5 ? soils[1] : soils[2],
    planned: 8,
    unit: "m³",
    reservation,
    reception: [
      "未到着",
      "未到着",
      "待機",
      "受入中",
      "内容確認待ち",
      "完了",
      "未到着",
    ][index],
    driverReport: index === 4 || index === 5,
    tripStatus: index === 4 || index === 5 ? "運行完了" : "運行中",
    actual: index === 5 ? 7.8 : "",
    actualSoil: index === 5 ? soils[2] : "",
    receipt: index === 5 ? "実績確定" : "未確定",
    differenceReason: index === 5 ? "サンプル計測値との差" : "",
    confirmedAt: index === 5 ? `${demoDate} 10:40（サンプル）` : "",
    confirmedBy: index === 5 ? "サンプル承認者 A" : "",
    reason: "",
    delay: "",
    history: ["匿名サンプルとして初期表示"],
  }));
}
export function transitionTrip(trip, action, input = {}) {
  const next = { ...trip };
  const deny = (text) => {
    throw new Error(text);
  };
  if (trip.receipt === "実績確定")
    deny("確定済み実績は変更できません。訂正申請は次工程で対応します。");
  if (["受入不可", "取消"].includes(trip.reservation))
    deny("終了した予約は変更できません。新しい予約が必要です。");
  const reason = (input.reason || "").trim();
  switch (action) {
    case "approve":
      if (trip.reservation !== "申請中") deny("申請中の予約だけ承認できます。");
      if (!trip.agreement) deny("条件合意の確認が必要です。");
      next.reservation = "予約確定";
      break;
    case "change":
      if (trip.reservation !== "申請中")
        deny("申請中の予約だけ変更依頼できます。");
      if (!reason) deny("変更理由を入力してください。");
      next.reservation = "変更依頼";
      next.reason = reason;
      break;
    case "resubmit":
      if (trip.reservation !== "変更依頼")
        deny("変更依頼された予約だけ再申請できます。");
      if (
        !Number.isFinite(Number(input.planned)) ||
        Number(input.planned) <= 0 ||
        !input.eta
      )
        deny("正の予定数量と到着予定を入力してください。");
      next.planned = Number(input.planned);
      next.eta = input.eta;
      next.reservation = "申請中";
      break;
    case "reject":
    case "cancel":
      if (trip.driverReport || trip.reception === "内容確認待ち")
        deny("荷下ろし後は取消できません。実績確認が必要です。");
      if (!reason) deny("理由を入力してください。");
      if (action === "cancel" && trip.reception !== "未到着")
        deny("到着後は現地の受入不可処理が必要です。");
      next.reservation = action === "reject" ? "受入不可" : "取消";
      next.reason = reason;
      break;
    case "arrive":
      if (trip.reservation !== "予約確定" || trip.reception !== "未到着")
        deny("予約確定・未到着の便だけ受付できます。");
      next.reception = "待機";
      next.tripStatus = "到着";
      break;
    case "start":
      if (trip.reservation !== "予約確定" || trip.reception !== "待機")
        deny("受付済みの便だけ受入開始できます。");
      next.reception = "受入中";
      break;
    case "driver-report":
      if (trip.reception !== "受入中" || trip.driverReport)
        deny("受入中の便のサンプル報告だけ反映できます。");
      next.driverReport = true;
      next.tripStatus = "運行完了";
      next.reception = "内容確認待ち";
      break;
    case "review": {
      if (!trip.driverReport || trip.reception !== "内容確認待ち")
        deny("荷下ろし完了報告後に内容確認してください。");
      const actual = Number(input.actual);
      if (!Number.isFinite(actual) || actual <= 0)
        deny("実績数量は0より大きい数値を入力してください。");
      if (input.unit !== trip.unit)
        deny("予定と実績の単位が異なります。自動換算できません。");
      if (!soils.includes(input.actualSoil))
        deny("確認した土質を選択してください。");
      if (
        (actual !== trip.planned || input.actualSoil !== trip.soil) &&
        !reason
      )
        deny("数量または土質の差異理由を入力してください。");
      next.actual = actual;
      next.actualSoil = input.actualSoil;
      next.differenceReason = reason;
      next.receipt = "内容確認済み";
      break;
    }
    case "confirm":
      if (!trip.driverReport || trip.receipt !== "内容確認済み")
        deny("ドライバー報告と受入内容の確認が必要です。");
      next.receipt = "実績確定";
      next.reception = "完了";
      next.confirmedAt = new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      });
      next.confirmedBy = "サンプル承認者 A";
      break;
    case "delay":
      if (trip.reservation !== "予約確定" || trip.reception !== "未到着")
        deny("未到着の確定便だけ遅延を記録できます。");
      if (!reason || !input.eta)
        deny("遅延理由と新しい到着予定を入力してください。");
      next.delay = reason;
      next.eta = input.eta;
      break;
    default:
      deny("この操作には対応していません。");
  }
  next.history = [
    ...trip.history,
    `${new Date().toLocaleTimeString("ja-JP")} ${action}（試作・未送信）${reason ? `：${reason}` : ""}`,
  ];
  return next;
}

export function receiptCsv(trips) {
  const escape = (value) =>
    `"${String(value ?? "")
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      ["試作データ・正式帳票ではありません"],
      [
        "便ID",
        "予約ID",
        "便順",
        "受入日",
        "現場",
        "予定数量",
        "実績数量",
        "単位",
        "確定状態",
        "確定者",
        "確定日時",
      ],
      ...trips.map((t) => [
        t.id,
        t.reservationId,
        t.sequence,
        t.date,
        t.site,
        t.planned,
        t.actual,
        t.unit,
        t.receipt,
        t.confirmedBy,
        t.confirmedAt,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}
