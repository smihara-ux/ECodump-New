import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkflowServer } from "../server/workflow-api.mjs";

const tokens = {
  construction: "construction-token",
  receiving: "receiving-token",
  driver: "driver-token",
  driver2: "driver-02-token",
  outsider: "outsider-token",
};

const call = async (base, role, path, options = {}) => {
  const { method = "GET", body, version, key } = options;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${tokens[role]}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(version ? { "if-match": String(version) } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};

const reservationBody = (suffix = "A") => ({
  siteId: "site-01",
  receivingLocationId: "location-01",
  plannedAt: `2026-10-${suffix === "A" ? "01" : "02"}T08:00:00+09:00`,
  soilType: "第2種建設発生土",
  plannedQuantity: 8,
  unit: "m3",
});

test("trial operation exceptions, repeated rotations, persistence, and access controls", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ecodump-trial-"));
  const dbPath = join(dir, "trial.sqlite");
  let api = createWorkflowServer({ dbPath, port: 0 });
  let address = await api.listen();
  let base = `http://127.0.0.1:${address.port}/api`;
  try {
    const created = await call(base, "construction", "/reservations", {
      method: "POST",
      key: "trial-create",
      body: reservationBody("A"),
    });
    assert.equal(created.status, 201);
    let reservation = created.body.reservation;

    const changed = await call(
      base,
      "construction",
      `/reservations/${reservation.id}/change`,
      {
        method: "POST",
        version: reservation.version,
        key: "trial-change",
        body: { plannedQuantity: 9, reason: "施工計画変更" },
      },
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.reservation.planned_quantity, 9);
    assert.equal(changed.body.reservation.status, "requested");
    reservation = changed.body.reservation;

    const confirmed = await call(
      base,
      "receiving",
      `/reservations/${reservation.id}/confirm`,
      {
        method: "POST",
        version: reservation.version,
        key: "trial-confirm",
        body: {},
      },
    );
    reservation = confirmed.body.reservation;

    const first = await call(
      base,
      "construction",
      `/reservations/${reservation.id}/assign`,
      {
        method: "POST",
        version: reservation.version,
        key: "trial-assign-1",
        body: {
          vehicleId: "vehicle-01",
          driverId: "driver-01",
          rotationNo: 1,
        },
      },
    );
    assert.equal(first.status, 201);
    reservation = first.body.reservation;
    let trip1 = first.body.trip;

    const second = await call(
      base,
      "construction",
      `/reservations/${reservation.id}/assign`,
      {
        method: "POST",
        version: reservation.version,
        key: "trial-assign-2",
        body: {
          vehicleId: "vehicle-01",
          driverId: "driver-01",
          rotationNo: 2,
        },
      },
    );
    assert.equal(second.status, 201);
    assert.equal(second.body.trip.rotation_no, 2);
    assert.equal(second.body.trip.vehicle_id, trip1.vehicle_id);
    let trip2 = second.body.trip;

    const reassigned = await call(
      base,
      "construction",
      `/trips/${trip2.id}/reassign`,
      {
        method: "POST",
        version: trip2.version,
        key: "trial-reassign",
        body: { vehicleId: "vehicle-02", driverId: "driver-02" },
      },
    );
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.trip.driver_id, "driver-02");
    trip2 = reassigned.body.trip;
    assert.equal(
      (await call(base, "driver2", "/workflow")).body.data[0].trip.id,
      trip2.id,
    );

    const delayed = await call(base, "driver", `/trips/${trip1.id}/delay`, {
      method: "POST",
      version: trip1.version,
      key: "trial-delay",
      body: {
        reason: "交通混雑",
        estimatedArrivalAt: "2026-10-01T08:30:00+09:00",
      },
    });
    assert.equal(delayed.status, 201);
    assert.equal(delayed.body.event.event_type, "delayed");
    assert.equal(delayed.body.trip.status, "assigned");
    trip1 = delayed.body.trip;

    for (const [eventType, key] of [
      ["arrived", "trial-arrived"],
      ["departed", "trial-departed"],
      ["unloaded", "trial-unloaded"],
    ]) {
      const reported = await call(base, "driver", `/trips/${trip1.id}/events`, {
        method: "POST",
        version: trip1.version,
        key,
        body: { eventType },
      });
      assert.equal(reported.status, 201);
      trip1 = reported.body.trip;
    }

    const receipt = await call(
      base,
      "receiving",
      `/trips/${trip1.id}/receipt/confirm`,
      {
        method: "POST",
        version: trip1.version,
        key: "trial-receipt",
        body: { actualQuantity: 8.6, unit: "m3" },
      },
    );
    assert.equal(receipt.status, 201);
    const corrected = await call(
      base,
      "receiving",
      `/receipts/${receipt.body.receipt.id}/correct`,
      {
        method: "POST",
        version: receipt.body.receipt.version,
        key: "trial-correction",
        body: { actualQuantity: 8.4, reason: "計量票再確認" },
      },
    );
    assert.equal(corrected.status, 200);
    assert.equal(corrected.body.receipt.status, "corrected");
    assert.equal(corrected.body.correction.previous_quantity, 8.6);

    const operation = await call(base, "driver", "/operations/trial-delay");
    assert.equal(operation.status, 200);
    assert.equal(operation.body.status, "completed");
    const replay = await call(base, "driver", `/trips/${trip1.id}/delay`, {
      method: "POST",
      version: 1,
      key: "trial-delay",
      body: { reason: "別内容", estimatedArrivalAt: "2026-10-01" },
    });
    assert.equal(replay.status, 409);
    assert.equal(replay.body.code, "IDEMPOTENCY_CONFLICT");

    const cancelCreated = await call(base, "construction", "/reservations", {
      method: "POST",
      key: "cancel-create",
      body: reservationBody("B"),
    });
    const cancelled = await call(
      base,
      "construction",
      `/reservations/${cancelCreated.body.reservation.id}/cancel`,
      {
        method: "POST",
        version: 1,
        key: "cancel-action",
        body: { reason: "工事日程変更" },
      },
    );
    assert.equal(cancelled.body.reservation.status, "cancelled");

    const unavailableCreated = await call(
      base,
      "construction",
      "/reservations",
      {
        method: "POST",
        key: "unavailable-create",
        body: reservationBody("B"),
      },
    );
    const unavailable = await call(
      base,
      "receiving",
      `/reservations/${unavailableCreated.body.reservation.id}/unavailable`,
      {
        method: "POST",
        version: 1,
        key: "unavailable-action",
        body: { reason: "受入設備停止" },
      },
    );
    assert.equal(unavailable.body.reservation.status, "rejected");

    const concurrentCreated = await call(
      base,
      "construction",
      "/reservations",
      {
        method: "POST",
        key: "concurrent-create",
        body: reservationBody("B"),
      },
    );
    const concurrent = await Promise.all([
      call(
        base,
        "construction",
        `/reservations/${concurrentCreated.body.reservation.id}/change`,
        {
          method: "POST",
          version: 1,
          key: "concurrent-a",
          body: { plannedQuantity: 10, reason: "変更A" },
        },
      ),
      call(
        base,
        "construction",
        `/reservations/${concurrentCreated.body.reservation.id}/change`,
        {
          method: "POST",
          version: 1,
          key: "concurrent-b",
          body: { plannedQuantity: 11, reason: "変更B" },
        },
      ),
    ]);
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      [200, 409],
    );
    const denied = await call(
      base,
      "outsider",
      `/reservations/${reservation.id}/cancel`,
      {
        method: "POST",
        version: reservation.version,
        key: "outsider-cancel",
        body: { reason: "権限外" },
      },
    );
    assert.equal(denied.status, 403);

    await api.close();
    api.db.close();
    api = createWorkflowServer({ dbPath, port: 0 });
    address = await api.listen();
    base = `http://127.0.0.1:${address.port}/api`;
    const afterRelogin = await call(base, "construction", "/workflow");
    const persisted = afterRelogin.body.data.find(
      (item) => item.reservation.id === reservation.id,
    );
    assert.equal(persisted.trips.length, 2);
    assert.equal(persisted.receipt.actual_quantity, 8.4);
    assert.equal(persisted.events[0].event_type, "delayed");
  } finally {
    await api.close();
    api.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
