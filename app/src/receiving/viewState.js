import { useState, useEffect, useLayoutEffect, useRef } from "react";
export const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export const moveDay = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function useReceivingView(scope, defaults = {}) {
  const key = `ecodump-receiving-view:${scope}`;
  const [state, setState] = useState(() => {
    try {
      return {
        ...defaults,
        ...JSON.parse(sessionStorage.getItem(key) || "{}"),
      };
    } catch {
      return defaults;
    }
  });
  const update = (patch) =>
    setState((previous) => {
      const next = { ...previous, ...patch };
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [state, update];
}
export function useListPosition(scope, ready = true) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ready) return;
    const nodes = [];
    for (let n = ref.current; n; n = n.parentElement)
      if (n.scrollHeight > n.clientHeight) nodes.push(n);
    let saved = [];
    try {
      saved = JSON.parse(
        sessionStorage.getItem(`ecodump-scroll:${scope}`) || "[]",
      );
    } catch {}
    nodes.forEach((node, i) => {
      if (saved[i] != null) node.scrollTop = saved[i];
    });
    const save = () => {
      try {
        sessionStorage.setItem(
          `ecodump-scroll:${scope}`,
          JSON.stringify(nodes.map((n) => n.scrollTop)),
        );
      } catch {}
    };
    nodes.forEach((n) => n.addEventListener("scroll", save, { passive: true }));
    return () => nodes.forEach((n) => n.removeEventListener("scroll", save));
  }, [scope, ready]);
  return ref;
}
