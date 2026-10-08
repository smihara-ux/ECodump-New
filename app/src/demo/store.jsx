import { useSyncExternalStore } from "react";
import { createNaritaDemo, demoDay, numberTrips } from "./model.mjs";
const key = "ecodump-narita-preview-v1";
let snapshot,
  storageError = "",
  listeners = new Set();
function read() {
  try {
    const d = JSON.parse(localStorage.getItem(key) || "null");
    if (d?.day === demoDay() && Array.isArray(d.trips)) return d.trips;
  } catch {}
  return createNaritaDemo();
}
function get() {
  return (snapshot ??= read());
}
function notify() {
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === key) {
      snapshot = read();
      notify();
    }
  });
export function writeDemoTrips(update) {
  const current = read(); // Include the latest changes from other role tabs.
  const next = numberTrips(
    typeof update === "function" ? update(current) : update,
  );
  try {
    localStorage.setItem(key, JSON.stringify({ day: demoDay(), trips: next }));
    storageError = "";
  } catch {
    storageError = "ブラウザへの保存に失敗しました。変更は反映していません。";
    throw new Error(storageError);
  }
  snapshot = next;
  notify();
  return next;
}
export function updateDemoTrip(id, patch, expectedVersion) {
  return writeDemoTrips((rows) =>
    rows.map((t) => {
      if (t.id !== id) return t;
      if (expectedVersion != null && t.assignmentVersion !== expectedVersion)
        throw new Error(
          "別画面で配車が変更されました。再読込して確認してください。",
        );
      return { ...t, ...(typeof patch === "function" ? patch(t) : patch) };
    }),
  );
}
export const demoNotice =
  "成田モデル・ブラウザ内共有デモ。役割画面間で仮状態を共有します。相手への送信・API／DB保存は行いません。日付が変わると予定のデモ状態は初期化されます。";
export function useDemoTrips() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get,
    get,
  );
}
export function demoTrips() {
  return get();
}
