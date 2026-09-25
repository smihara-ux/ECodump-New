import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemoTrips,
  transitionTrip,
  receiptCsv,
} from "../src/receiving-model.mjs";

test("同じ車両の複数便を識別し、実績確定をドライバー報告から分離", () => {
  const trips = createDemoTrips();
  assert.equal(trips[0].vehicle, trips[1].vehicle);
  assert.notEqual(trips[0].id, trips[1].id);
  let trip = transitionTrip(trips[0], "approve");
  trip = transitionTrip(trip, "arrive");
  trip = transitionTrip(trip, "start");
  trip = transitionTrip(trip, "driver-report");
  assert.equal(trip.tripStatus, "運行完了");
  assert.equal(trip.receipt, "未確定");
  assert.throws(() => transitionTrip(trip, "confirm"), /確認が必要/);
  trip = transitionTrip(trip, "review", {
    actual: 8,
    actualSoil: trip.soil,
    unit: "m³",
  });
  trip = transitionTrip(trip, "confirm");
  assert.equal(trip.receipt, "実績確定");
  assert.throws(
    () => transitionTrip(trip, "cancel", { reason: "test" }),
    /確定済み/,
  );
  assert.equal(trips[1].receipt, "未確定");
});
test("数量・単位・土質・差異理由を検証する", () => {
  const trip = createDemoTrips()[4];
  for (const value of [0, -1, "no", Infinity])
    assert.throws(() =>
      transitionTrip(trip, "review", {
        actual: value,
        actualSoil: trip.soil,
        unit: "m³",
      }),
    );
  assert.throws(
    () =>
      transitionTrip(trip, "review", {
        actual: 8,
        actualSoil: trip.soil,
        unit: "t",
      }),
    /単位/,
  );
  assert.throws(
    () =>
      transitionTrip(trip, "review", {
        actual: 7.5,
        actualSoil: trip.soil,
        unit: "m³",
      }),
    /差異理由/,
  );
  assert.equal(
    transitionTrip(trip, "review", {
      actual: 7.5,
      actualSoil: trip.soil,
      unit: "m³",
      reason: "実測差",
    }).actual,
    7.5,
  );
});
test("変更・取消・受入不可には理由、取消後は再操作不可", () => {
  const trip = createDemoTrips()[0];
  for (const action of ["change", "cancel", "reject"])
    assert.throws(() => transitionTrip(trip, action), /理由/);
  const changed = transitionTrip(trip, "change", { reason: "時間変更" });
  const resubmitted = transitionTrip(changed, "resubmit", {
    planned: 6,
    eta: "14:00",
  });
  assert.equal(resubmitted.reservation, "申請中");
  assert.throws(() => transitionTrip(resubmitted, "arrive"), /予約確定/);
  const cancelled = transitionTrip(trip, "cancel", { reason: "工事延期" });
  assert.throws(() => transitionTrip(cancelled, "approve"), /終了した予約/);
  assert.throws(
    () => transitionTrip(createDemoTrips()[2], "cancel", { reason: "取消" }),
    /到着後/,
  );
});
test("遅延は予約・運行工程を上書きしない", () => {
  const trip = createDemoTrips()[1];
  const delayed = transitionTrip(trip, "delay", {
    eta: "12:00",
    reason: "交通遅延",
  });
  assert.equal(delayed.reservation, trip.reservation);
  assert.equal(delayed.reception, "未到着");
  assert.equal(delayed.eta, "12:00");
});
test("CSVは試作を明記し、数式・引用符をエスケープする", () => {
  const csv = receiptCsv([
    { ...createDemoTrips()[5], site: '=HYPERLINK("x")' },
  ]);
  assert.match(csv, /試作データ/);
  assert.match(csv, /'=HYPERLINK\(""x""\)/);
});
