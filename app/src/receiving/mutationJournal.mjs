/** Retains an operation identity across reloads. It deliberately has no retry API. */
export function createMutationJournal({ storage, actorId, scope = "receiving", uuid = () => crypto.randomUUID() }) {
  const storageKey = `ecodump:${scope}:operation:v1:${actorId}`;
  const read = () => {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.actorId !== actorId || !value.key || !["pending", "unknown", "confirmed", "rejected"].includes(value.status)) {
      throw new Error("操作記録を読み取れません。更新せずに担当者へ確認してください。");
    }
    return value;
  };
  const write = (value) => { storage.setItem(storageKey, JSON.stringify(value)); return value; };
  return {
    read,
    async submit({ action, targetId, version }, send) {
      const previous = read();
      if (previous && ["pending", "unknown"].includes(previous.status)) throw new Error("前回の更新結果を先に照会してください。");
      const operation = write({ actorId, key: uuid(), action, targetId, version, status: "pending", startedAt: new Date().toISOString() });
      let result;
      try { result = await send(operation.key); }
      catch (error) {
        // Only explicit application 4xx responses prove rejection. A missing response
        // or any server/proxy failure may follow a committed transaction.
        const rejected = error.status >= 400 && error.status < 500 && ![408, 425, 429].includes(error.status);
        write({ ...operation, status: rejected ? "rejected" : "unknown", error: error.message });
        throw error;
      }
      write({ ...operation, status: "confirmed", result });
      return result;
    },
    async reconcile(lookup) {
      const operation = read();
      if (!operation) return null;
      const result = await lookup(operation.key);
      if (result.status === "completed" || result.status === "confirmed") {
        return write({ ...operation, status: "confirmed", result: result.result });
      }
      // "not found" does not prove a timed-out request will never commit.
      // Keep the original key and prohibit another mutation until resolved.
      return write({ ...operation, status: "unknown" });
    },
  };
}
