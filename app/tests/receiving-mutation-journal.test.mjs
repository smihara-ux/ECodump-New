import test from "node:test";
import assert from "node:assert/strict";
import { createMutationJournal } from "../src/receiving/mutationJournal.mjs";
const store = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
const intent = { action: "actual", targetId: "booking-A", version: 5 };

test("lost response survives reload and can only be reconciled, never blindly replayed", async () => {
  const storage = store(); let writes = 0;
  let journal = createMutationJournal({ storage, actorId: "receiver-A", uuid: () => "stable-key" });
  await assert.rejects(journal.submit(intent, async () => { writes++; throw new TypeError("connection lost after commit"); }));
  journal = createMutationJournal({ storage, actorId: "receiver-A" });
  assert.equal(journal.read().status, "unknown");
  await assert.rejects(journal.submit(intent, async () => writes++), /先に照会/);
  assert.equal(writes, 1);
  await journal.reconcile(async (key) => { assert.equal(key, "stable-key"); return { status: "not_found" }; });
  await assert.rejects(journal.submit(intent, async () => writes++), /先に照会/);
  await journal.reconcile(async () => ({ status: "completed", result: { quantity: 7.8 } }));
  assert.equal(journal.read().status, "confirmed");
  assert.equal(journal.read().result.quantity, 7.8);
  assert.equal(writes, 1);
});

test("storage failure prevents transmission and a different actor cannot inherit the pending operation", async () => {
  let writes = 0;
  const journal = createMutationJournal({ actorId: "receiver-A", storage: { getItem: () => null, setItem: () => { throw new Error("disk full"); } } });
  await assert.rejects(journal.submit(intent, async () => writes++), /disk full/);
  assert.equal(writes, 0);
  const storage = store();
  const a = createMutationJournal({ storage, actorId: "receiver-A" });
  await assert.rejects(a.submit(intent, async () => { throw new Error("network"); }));
  assert.equal(createMutationJournal({ storage, actorId: "receiver-B" }).read(), null);
});

test("a rejected stale update and an uncertain server failure remain distinct", async () => {
  const journal = createMutationJournal({ storage: store(), actorId: "receiver-A" });
  await assert.rejects(journal.submit(intent, async () => { throw Object.assign(new Error("stale"), { status: 409 }); }));
  assert.equal(journal.read().status, "rejected");
  await assert.rejects(journal.submit(intent, async () => { throw Object.assign(new Error("server"), { status: 503 }); }));
  assert.equal(journal.read().status, "unknown");
});
