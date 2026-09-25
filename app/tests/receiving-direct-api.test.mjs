import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "../server/node_modules/pg/lib/index.js";

// Opt-in: never contacts a cloud endpoint or uses production credentials.
test("receiving acceptance against isolated PostgreSQL: authorization, stale writes, lost response and persisted cross-role result", { skip: process.env.ECODUMP_RECEIVING_DB_TEST !== "1" }, async (t) => {
  const config = JSON.parse(await readFile(new URL("../server/.local/config.json", import.meta.url)));
  assert.equal(config.api.database, "ecodump_direct_validation");
  assert.ok(config.api.host.startsWith("/tmp/ecodump-direct-"));
  const base = `http://127.0.0.1:${config.port}/api/direct`;
  const credentials = JSON.parse(await readFile(new URL("../server/.local/credentials.json", import.meta.url)));
  const tokens = {};
  const call = async (role, path, body, key, extraHeaders = {}) => {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { ...(tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}), "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  for (const name of ["construction", "receiver", "driver", "receiver-other", "driver-other", "outsider"]) {
    const account = credentials.accounts.find((entry) => entry.name === name);
    const login = await call(name, "/session", { email: account.email, password: credentials.password });
    assert.equal(login.status, 200, `isolated login ${name}`);
    tokens[name] = login.body.token;
  }
  const context = (await call("construction", "/context")).body;
  const site = context.sites.find((site) => context.scopes.some((scope) => scope.site_id === site.id && scope.role === "construction"));
  const location = context.locations[0];
  const bookingId = randomUUID();
  const createKey = randomUUID();
  const plannedAt = new Date(Date.UTC(2040, 0, 1) + Math.floor(Math.random() * 3000) * 86400000).toISOString();
  const payload = { id: bookingId, siteId: site.id, locationId: location.id, plannedAt, quantity: 8, unit: location.unit, soil: location.soil, agreementNote: "匿名の受入側統合検証。予定8m³、確定時に実測数量を記録。" };
  const created = await call("construction", "/actions/create", payload, createKey);
  assert.equal(created.status, 200);
  // Delete only this test's known record after checks; never reset the shared DB.
  t.after(async () => {
    const db = new pg.Client(config.admin); await db.connect();
    try {
      await db.query("BEGIN");
      await db.query("DELETE FROM direct.audit WHERE booking_id=$1", [bookingId]);
      await db.query("DELETE FROM direct.operations WHERE result->>'bookingId'=$1", [bookingId]);
      await db.query("DELETE FROM direct.attachments WHERE booking_id=$1", [bookingId]);
      await db.query("DELETE FROM direct.actuals WHERE trip_id IN (SELECT id FROM direct.trips WHERE booking_id=$1)", [bookingId]);
      await db.query("DELETE FROM direct.trip_events WHERE trip_id IN (SELECT id FROM direct.trips WHERE booking_id=$1)", [bookingId]);
      await db.query("DELETE FROM direct.trips WHERE booking_id=$1", [bookingId]);
      await db.query("DELETE FROM direct.bookings WHERE id=$1", [bookingId]);
      await db.query("COMMIT");
    } finally { await db.end(); }
  });
  assert.equal((await call("construction", "/actions/create", payload, createKey)).status, 200);
  assert.equal((await call("construction", "/actions/create", { ...payload, quantity: 9 }, createKey)).status, 409);
  for (const role of ["receiver-other", "driver-other", "outsider"]) {
    assert.ok(!(await call(role, "/bookings")).body.bookings.some((booking) => booking.id === bookingId));
    assert.equal((await call(role, "/actions/confirm", { bookingId, expectedVersion: 1, agree: true }, randomUUID())).status, 403);
  }
  const confirmations = await Promise.all([1, 2].map(() => call("receiver", "/actions/confirm", { bookingId, expectedVersion: 1, agree: true }, randomUUID())));
  assert.deepEqual(confirmations.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await call("construction", "/actions/assign", { bookingId, expectedVersion: 1, vehicleId: context.vehicles[0].id, driverId: context.drivers[0].id }, randomUUID())).status, 409);
  const assigned = await call("construction", "/actions/assign", { bookingId, expectedVersion: 2, vehicleId: context.vehicles[0].id, driverId: context.drivers[0].id }, randomUUID());
  assert.equal(assigned.status, 200);
  assert.equal((await call("receiver", "/actions/actual", { bookingId, expectedVersion: 1, quantity: 7.8, unit: "m3", differenceReason: "実測" }, randomUUID())).status, 422);
  let version = 1;
  for (const state of ["site_arrived", "in_transit", "receiver_arrived", "unloaded"]) {
    const reported = await call("driver", "/actions/report", { bookingId, expectedVersion: version, state, reportedAt: new Date().toISOString() }, randomUUID());
    assert.equal(reported.status, 200); version = reported.body.tripVersion;
  }
  const before = (await call("receiver", "/bookings")).body.bookings.find((entry) => entry.id === bookingId);
  assert.equal(before.actual, null); assert.equal(before.trip.status, "unloaded");
  assert.equal((await call("receiver", "/actions/actual", { bookingId, expectedVersion: version, quantity: 7.8, unit: "m3", differenceReason: "" }, randomUUID())).status, 422);
  const actualKey = randomUUID();
  await assert.rejects(call("receiver", "/actions/actual", { bookingId, expectedVersion: version, quantity: 7.8, unit: "m3", differenceReason: "受入時の実測差" }, actualKey, { "x-validation-drop-response": "1" }));
  const outcome = await call("receiver", `/operations/${actualKey}`);
  assert.equal(outcome.body.state, "applied");
  assert.equal((await call("receiver", "/actions/actual", { bookingId, expectedVersion: version, quantity: 7.8, unit: "m3", differenceReason: "実測" }, randomUUID())).status, 409);
  for (const role of ["construction", "receiver"]) {
    const refreshed = (await call(role, "/bookings")).body.bookings.find((entry) => entry.id === bookingId);
    assert.equal(Number(refreshed.actual.quantity), 7.8); assert.equal(refreshed.actual.unit, "m3"); assert.equal(refreshed.events.length, 4);
  }
  const db = new pg.Client(config.api); await db.connect();
  try {
    await db.query("BEGIN");
    const userId = credentials.accounts.find((entry) => entry.name === "receiver-other").id;
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [userId]);
    assert.equal((await db.query("SELECT id FROM direct.bookings WHERE id=$1", [bookingId])).rowCount, 0);
    await assert.rejects(db.query("SELECT direct.mutate('actual',$1,$2::jsonb)", [randomUUID(), JSON.stringify({ bookingId, expectedVersion: version, quantity: 8, unit: "m3" })]), (error) => error.code === "42501");
    await db.query("ROLLBACK");
  } finally { await db.end(); }
});
