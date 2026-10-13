import test from "node:test";
import assert from "node:assert/strict";
import { createMatchingJourney, transitionMatchingJourney as transition, selectedCandidate } from "../src/demo/matchingJourney.mjs";
import { createMatchingPlanTrips, validateMatchingPlan } from "../src/demo/matchingPlan.mjs";
import { sourceQuantityRows, sourceQuantityGroups } from "../src/receiving/capacityBreakdown.mjs";

function agreed() {
  let state = createMatchingJourney("2026-10-13");
  const act = (type, actor, extra = {}) => { state = transition(state, { type, actor, expectedVersion: state.version, at: "2026-10-13T00:00:00Z", ...extra }); };
  act("publish", "construction"); act("consult", "construction");
  for (const actor of ["construction", "receiving"]) { act("documents", actor); act("accept", actor, { revision: state.revision }); }
  return state.agreement;
}
const plan = agreement => ({ date: "2026-10-14", count: 2, quantity: 7, unit: "m³", soil: agreement.terms.soil, siteId: agreement.sourceSiteId, locationId: agreement.targetLocationId, time: "08:30", arrival: "10:00", requestKey: "request-1" });

test("an agreed case creates two trips under one reservation with consistent immutable IDs and conditions", () => {
  const agreement = agreed(); let counter = 0;
  const rows = createMatchingPlanTrips(agreement, plan(agreement), [], () => String(++counter));
  assert.equal(rows.length, 2); assert.equal(rows[0].reservationId, rows[1].reservationId); assert.notEqual(rows[0].id, rows[1].id);
  for (const row of rows) {
    assert.equal(row.sourceCaseId, agreement.sourceCaseId); assert.equal(row.targetCaseId, agreement.targetCaseId);
    assert.equal(row.matchAgreementId, agreement.id); assert.equal(row.material, "第2種建設発生土");
    assert.equal(row.reservation, "申請中"); assert.equal(row.vehicleId, ""); assert.equal(row.confirmed, null);
    assert.notEqual(row.agreementSnapshot, agreement);
  }
});

test("missing agreement, changed partner, unit, soil, invalid times and out-of-period dates are rejected", () => {
  const agreement = agreed(), base = plan(agreement);
  assert.throws(() => validateMatchingPlan(null, base, []), /双方が合意/);
  for (const patch of [{ date: "2026-10-01" }, { date: "2027-01-01" }, { unit: "t" }, { soil: "第1種建設発生土" }, { locationId: "other" }, { siteId: "other" }, { count: 1.5 }, { quantity: 0 }, { time: "25:00" }, { arrival: "07:00" }]) assert.throws(() => validateMatchingPlan(agreement, { ...base, ...patch }, []));
});

test("daily and overall remaining quantities count active trips and exclude cancellations, without duplicate requests", () => {
  const agreement = agreed(), base = plan(agreement);
  const active = { matchAgreementId: agreement.id, unit: "m³", date: base.date, planned: 150, booking: "有効", reservation: "申請中" };
  assert.throws(() => validateMatchingPlan(agreement, base, [active]), /1日あたり/);
  assert.doesNotThrow(() => validateMatchingPlan(agreement, base, [{ ...active, booking: "取消", reservation: "取消" }]));
  assert.throws(() => validateMatchingPlan(agreement, base, [{ ...active, date: "2026-10-15", planned: 6390 }]), /総数量/);
  assert.throws(() => validateMatchingPlan(agreement, base, [{ ...active, matchingRequestKey: base.requestKey }]), /既に登録済み/);
});

test("role-specific receiving registration changes the same candidate and units are never implicitly converted", () => {
  let state = createMatchingJourney("2026-10-13");
  const target = selectedCandidate(state);
  const event = { type: "receivingCase", actor: "receiving", expectedVersion: 0, locationId: target.locationId, condition: { soil: "第2種建設発生土", capacity: 9000, daily: 300, unit: "t", start: target.start, end: target.end } };
  state = transition(state, event);
  assert.equal(selectedCandidate(state).capacity, 9000); assert.equal(selectedCandidate(state).unit, "t");
  state = transition(state, { type: "publish", actor: "construction", expectedVersion: state.version });
  assert.throws(() => transition(state, { type: "consult", actor: "construction", expectedVersion: state.version }), /受入条件と合わない/);
});

test("source-site breakdown uses actual same-unit records, and excludes cancelled, rejected and unconfirmed amounts", () => {
  const common = { date: "2026-10-14", locationId: "Y-01", siteId: "site-A", departure: "現場A", unit: "m³", booking: "有効", reservation: "申請中" };
  const trips = [{ ...common, id: "1", planned: 7, confirmed: null }, { ...common, id: "2", planned: 8, confirmed: null, reported: 7.5 }, { ...common, id: "3", planned: 10, confirmed: 9 }, { ...common, id: "4", planned: 100, reservation: "取消" }, { ...common, id: "5", planned: 100, reservation: "受入不可" }, { ...common, id: "6", planned: 30, confirmed: null, unit: "t" }, { ...common, id: "7", planned: 50, locationId: "Y-02", confirmed: null }];
  const scope = { year: 2026, month: "10", unit: "m³", locationId: "Y-01" };
  const pending = sourceQuantityGroups(sourceQuantityRows(trips, { ...scope, metric: "予約予定量" }));
  assert.equal(pending[0].quantity, 15); assert.equal(pending[0].trips.length, 2);
  assert.equal(sourceQuantityGroups(sourceQuantityRows(trips, { ...scope, metric: "受入確定量" }))[0].quantity, 9);
  assert.equal(sourceQuantityRows(trips, { ...scope, metric: "予約予定量", month: "11" }).length, 0);
});
