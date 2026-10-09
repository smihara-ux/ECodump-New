export function readReviewContext(key, fallback = null) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
export function writeReviewContext(key, value) {
  if (value == null) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify(value));
}
