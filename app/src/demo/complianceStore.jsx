import { useSyncExternalStore } from "react";
import { initialCompliance, normalizeCompliance } from "./complianceModel.mjs";
const key = "ecodump-compliance-demo-v1";
let snapshot,
  listeners = new Set();
function read() {
  try {
    return normalizeCompliance(
      JSON.parse(localStorage.getItem(key) || "null") || initialCompliance()
    );
  } catch {
    return normalizeCompliance(initialCompliance());
  }
}
function get() {
  return (snapshot ??= read());
}
function notify() {
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === key) {
      snapshot = read();
      notify();
    }
  });
export function updateCompliance(change) {
  const current = read(),
    next = change(current);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    throw new Error("端末に保存できません。入力を保持して再確認してください。");
  }
  snapshot = next;
  notify();
}
export function useCompliance() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    get,
    get,
  );
}
export function focusCompliance(companyId, category) {
  sessionStorage.setItem(
    "ecodump-compliance-focus",
    JSON.stringify({ companyId, category }),
  );
}
