import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendStage,
  businessDate,
  correctionEvent,
  deliveryAction,
  isHeld,
  makeTrips,
  tripStage,
} from "../src/driver/driverModel.js";
test("JST business day crosses UTC boundary correctly", () =>
  assert.equal(businessDate(new Date("2026-09-24T15:01:00Z")), "2026-09-25"));
test("same vehicle rotations have separate trip IDs and progress", () => {
  const [a, b, c] = makeTrips();
  assert.equal(new Set([a.id, b.id, c.id]).size, 3);
  assert.equal(a.vehicle, b.vehicle);
  const es = [appendStage(a, [], 1)];
  assert.equal(tripStage(a, es), 1);
  assert.equal(tripStage(b, es), 0);
});
test("stage skipping, duplicate reporting, and foreign-driver mutation rejected", () => {
  const t = makeTrips()[0];
  assert.throws(() => appendStage(t, [], 2));
  const es = [appendStage(t, [], 1)];
  assert.throws(() => appendStage(t, es, 1));
  assert.throws(() => appendStage({ ...t, driverId: "other" }, [], 1));
});
test("four steps finish transport with unsent drafts, no receipt confirmation", () => {
  const t = makeTrips()[0];
  const es = [];
  for (let i = 1; i <= 4; i++) es.push(appendStage(t, es, i));
  assert.equal(tripStage(t, es), 4);
  assert.ok(es.every((e) => e.delivery === "unsent"));
  assert.throws(() => appendStage(t, es, 5));
  assert.ok(es.every((e) => !("receiptStatus" in e)));
});
test("correction is append-only, needs reason, and does not roll back sent data", () => {
  const t = makeTrips()[0];
  const es = [appendStage(t, [], 1)];
  assert.throws(() => correctionEvent(t, es, ""));
  const correction = correctionEvent(t, es, "誤操作");
  const updated = [...es, correction];
  assert.equal(es.length, 1);
  assert.equal(tripStage(t, updated), 0);
  assert.equal(updated[0].stage, 1);
  assert.throws(() =>
    correctionEvent(t, [{ ...es[0], delivery: "sent" }], "誤操作"),
  );
});
test("receiving refusal holds trip; delay does not advance its stage", () => {
  const t = makeTrips()[0];
  const es = [{ tripId: t.id, kind: "issue", issueType: "受入不可" }];
  assert.ok(isHeld(t.id, es));
  assert.throws(() => appendStage(t, es, 1));
  assert.equal(
    tripStage(t, [{ tripId: t.id, kind: "issue", issueType: "遅延" }]),
    0,
  );
});
test("unknown outcome offers status lookup only, sending cannot repeat", () => {
  assert.equal(deliveryAction("unknown"), "送信結果を照会");
  assert.equal(deliveryAction("sending"), null);
  assert.equal(deliveryAction("sent"), null);
});
