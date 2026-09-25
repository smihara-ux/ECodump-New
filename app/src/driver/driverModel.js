// UUID fallback also supports local LAN HTTP previews.
export function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const DEMO_DRIVER = "demo-driver-01";
export const stages = [
  "配車済み",
  "現場到着",
  "積込完了・出発",
  "受入先到着",
  "荷下ろし完了",
];
export const deliveryStates = {
  sending: [
    "通信中",
    "サーバーの応答を待っています。重ねて操作しないでください。",
  ],
  unsent: ["未送信", "この端末の下書きです。管理者には届いていません。"],
  failed: [
    "送信失敗",
    "送信されなかったことが確認できた状態。内容を確認して再送します。",
  ],
  unknown: [
    "結果確認中",
    "届いたか不明です。同じ報告を再送せず、結果を照会します。",
  ],
  sent: ["送信済み", "サーバー受領と再取得を確認した状態です。"],
};
export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function makeTrips() {
  const today = businessDate();
  const yesterday = businessDate(new Date(Date.now() - 86400000));
  return [
    ...["08:30", "10:30", "13:30"].map((time, i) => ({
      id: `TR-${today}-0${i + 1}`,
      driverId: DEMO_DRIVER,
      date: today,
      sequence: i + 1,
      rotation: i + 1,
      time,
      arrival: ["09:15", "11:15", "14:15"][i],
      from: "サンプル現場 A",
      to: "サンプル受入場所 B",
      vehicle: "サンプル車両 01",
      registration: "DEMO-001",
      soil: "建設発生土（砂質土）",
      quantity: 7,
      unit: "m³",
      baseStage: 0,
    })),
    {
      id: `TR-${yesterday}-01`,
      driverId: DEMO_DRIVER,
      date: yesterday,
      sequence: 1,
      rotation: 1,
      time: "09:00",
      arrival: "09:45",
      from: "サンプル現場 A",
      to: "サンプル受入場所 B",
      vehicle: "サンプル車両 01",
      registration: "DEMO-001",
      soil: "建設発生土（砂質土）",
      quantity: 7,
      unit: "m³",
      baseStage: 4,
    },
  ];
}
export function activeEvents(events, tripId) {
  const cancelled = new Set(
    events
      .filter((e) => e.tripId === tripId && e.kind === "correction")
      .map((e) => e.targetId),
  );
  return events.filter(
    (e) => e.tripId === tripId && e.kind === "stage" && !cancelled.has(e.id),
  );
}
export function tripStage(trip, events) {
  return activeEvents(events, trip.id).at(-1)?.stage ?? trip.baseStage;
}
export function isHeld(tripId, events) {
  return events.some(
    (e) =>
      e.tripId === tripId && e.kind === "issue" && e.issueType === "受入不可",
  );
}
export function appendStage(trip, events, requestedStage) {
  if (trip.driverId !== DEMO_DRIVER)
    throw new Error("本人の割当便ではありません。");
  if (isHeld(trip.id, events))
    throw new Error(
      "受入不可のため保留中です。管理者の指示を確認してください。",
    );
  const current = tripStage(trip, events);
  if (requestedStage !== current + 1 || requestedStage > 4)
    throw new Error("報告の順番を確認してください。");
  return {
    id: newId(),
    operationId: newId(),
    tripId: trip.id,
    kind: "stage",
    stage: requestedStage,
    delivery: "unsent",
    at: new Date().toISOString(),
  };
}
export function correctionEvent(trip, events, reason) {
  const latest = activeEvents(events, trip.id).at(-1);
  if (!reason.trim()) throw new Error("訂正理由を入力してください。");
  if (!latest || latest.delivery !== "unsent")
    throw new Error(
      "端末内で訂正できる報告がありません。送信済み報告は承認が必要です。",
    );
  return {
    id: newId(),
    tripId: trip.id,
    kind: "correction",
    targetId: latest.id,
    reason: reason.trim(),
    delivery: "unsent",
    at: new Date().toISOString(),
  };
}
export function deliveryAction(state) {
  return {
    unsent: "送信する",
    sending: null,
    failed: "内容を確認して再送",
    unknown: "送信結果を照会",
    sent: null,
  }[state];
}
let databasePromise;
function database() {
  databasePromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("ecodump-driver-prototype-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("drafts");
    req.onerror = () =>
      reject(
        new Error(
          "端末内保存を利用できません。ブラウザの保存設定を確認してください。",
        ),
      );
    req.onsuccess = () => resolve(req.result);
  });
  return databasePromise;
}
export async function readDrafts() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").get(DEMO_DRIVER);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () =>
      reject(new Error("下書きを読み込めません。再読込してください。"));
  });
}
export async function saveDrafts(events, expectedCount) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    let conflict = false;
    const store = tx.objectStore("drafts");
    const req = store.get(DEMO_DRIVER);
    req.onsuccess = () => {
      if ((req.result || []).length !== expectedCount) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(events, DEMO_DRIVER);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error("端末内に保存できませんでした。空き容量を確認してください。"),
      );
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? "別のタブで下書きが更新されました。再読込してから操作してください。上書きはしていません。"
            : "端末内保存が中断されました。内容は反映していません。",
        ),
      );
  });
}
