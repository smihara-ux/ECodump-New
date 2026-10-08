import test from "node:test";
import assert from "node:assert/strict";
import {
  createNaritaDemo,
  asDriver,
  asReceiving,
  asControl,
  mergeReceiving,
  numberTrips,
  demoSites,
  planProgress,
} from "../src/demo/model.mjs";
import { naritaIds } from "../src/demo/naritaIds.mjs";
import { summarizeTrips } from "../src/construction/operationsModel.mjs";
import {
  initialCompliance,
  changeDocument,
  categories,
} from "../src/demo/complianceModel.mjs";
import { transitionTrip } from "../src/receiving-model.mjs";
test("three role adapters preserve trip identity, assignment snapshot and separate quantities", () => {
  for (const trip of createNaritaDemo("2026-10-08")) {
    const r = asReceiving(trip),
      d = asDriver(trip),
      c = asControl(trip);
    assert.equal(r.id, d.id);
    assert.equal(c.id, d.id);
    assert.equal(r.reported, trip.reported);
    assert.equal(d.confirmed, trip.confirmed);
    assert.equal(d.registration, r.vehicle);
    assert.equal(d.driverId, r.driverId);
    assert.equal(r.site, d.from);
    assert.equal(d.to, trip.destination);
  }
});
test("site scope, unique vehicles and day sequence never use global array position", () => {
  const all = createNaritaDemo("2026-10-08"),
    a = all.filter(
      (t) => t.siteId === naritaIds.siteA && t.date === "2026-10-08",
    );
  assert.equal(a.length, 3);
  assert.ok(a.every((t) => t.siteId !== naritaIds.siteB));
  const repeated = a.filter((t) => t.vehicleId === naritaIds.vehicle01);
  assert.deepEqual(
    repeated.map((t) => t.vehicleSequence),
    [1, 2],
  );
  const driver = all.filter(
    (t) => t.driverId === naritaIds.driverAoki && t.date === "2026-10-08",
  );
  assert.equal(new Set(driver.map((t) => t.vehicleId)).size, 2);
  assert.deepEqual(
    driver.map((t) => t.driverSequence),
    [1, 2, 3],
  );
  assert.equal(
    numberTrips([...all].reverse()).find((t) => t.id === repeated[1].id)
      .vehicleSequence,
    2,
  );
});
test("quantity 0, unconfirmed, mixed reporting units and cancelled confirmed records remain distinct", () => {
  const rows = [
    {
      booking: "有効",
      unit: "m³",
      planned: 7,
      reported: 5,
      reportedUnit: "t",
      confirmed: 0,
    },
    { booking: "取消", unit: "m³", planned: 7, reported: 7, confirmed: 6.8 },
  ];
  const q = summarizeTrips(rows).quantities;
  assert.equal(q[0].reported, 0);
  assert.equal(q[1].reported, 5);
  assert.equal(q[0].confirmed, 6.8);
  assert.equal(q[0].remaining, 0);
});
test("receiver confirmation projects to shared trip without replacing the driver report", () => {
  const t = createNaritaDemo("2026-10-08").find((t) => t.reported === 7.2);
  const checked = transitionTrip(asReceiving(t), "review", {
    actual: 7.1,
    actualSoil: t.material,
    unit: t.unit,
    reason: "計量差",
  });
  const confirmed = transitionTrip(checked, "confirm");
  const next = mergeReceiving(t, confirmed);
  assert.equal(next.reported, 7.2);
  assert.equal(next.confirmed, 7.1);
  assert.equal(next.operation, "受入確認済み");
  assert.equal(next.id, t.id);
});
test("plan progress uses same-unit cumulative confirmed, separates pending and overrun", () => {
  const site = demoSites[0],
    q = planProgress(site, [
      { siteId: site.id, unit: site.unit, confirmed: 6500 },
      { siteId: site.id, unit: "t", confirmed: 500 },
      {
        siteId: site.id,
        unit: site.unit,
        confirmed: null,
        reported: 7.2,
        booking: "有効",
      },
    ]);
  assert.equal(q.remaining, 0);
  assert.equal(q.over, 100);
  assert.equal(q.confirmed, 6500);
  assert.equal(q.reportedPending, 7.2);
});
test("document workflow enforces missing inputs, return reason, version and category isolation", () => {
  let state = initialCompliance();
  const id = "NC-03:許可情報";
  assert.throws(() => changeDocument(state, id, "submit"));
  state = changeDocument(state, id, "draft", {
    checks: categories["許可情報"],
  });
  state = changeDocument(state, id, "submit");
  assert.throws(() => changeDocument(state, id, "return", { comment: "" }));
  state = changeDocument(state, id, "return", { comment: "番号を確認" });
  assert.equal(state.records.find((r) => r.id === id).status, "差戻し");
  state = changeDocument(state, id, "submit");
  state = changeDocument(state, id, "confirm");
  assert.equal(state.records.find((r) => r.id === id).status, "受領済");
  assert.equal(
    state.records.find((r) => r.id === "NC-03:契約情報").status,
    "未提出",
  );
  assert.throws(() =>
    changeDocument(state, id, "comment", {
      comment: "古い版",
      expectedVersion: 1,
    }),
  );
});

test("receiver demo unload and refusal retain their separate states after projection", () => {
  const t = createNaritaDemo("2026-10-08")[3];
  let r = transitionTrip(asReceiving(t), "approve");
  r = transitionTrip(r, "arrive");
  r = transitionTrip(r, "start");
  r = transitionTrip(r, "driver-report");
  const projected = asReceiving(mergeReceiving(t, r));
  assert.equal(projected.driverReport, true);
  assert.equal(projected.tripStatus, "運行完了");
  assert.equal(projected.receipt, "未確定");
  let rejected = transitionTrip(asReceiving(t), "reject", {
    reason: "条件不一致",
  });
  assert.equal(
    asReceiving(mergeReceiving(t, rejected)).reservation,
    "受入不可",
  );
});
