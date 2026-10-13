import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatchingJourney, candidateChecks, matchingCandidatesFor, matchingDemoKey,
  readMatchingJourney, transitionMatchingJourney as transition, validateTerms,
  writeMatchingJourney,
} from "../src/demo/matchingJourney.mjs";

const fixture = () => createMatchingJourney("2026-10-13");
const action = (state, type, actor = "construction", fields = {}) => transition(state, {
  type, actor, expectedVersion: state.version, at: "2026-10-13T01:00:00Z", ...fields,
});
const consulted = () => action(action(fixture(), "publish"), "consult");
const ready = (state, actor) => action(state, "documents", actor);
const accept = (state, actor) => action(state, "accept", actor, { revision: state.revision });
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test("one actor's agreement cannot establish a match; both agree to the same immutable snapshot", () => {
  const base = consulted();
  let state = ready(base, "construction");
  state = accept(state, "construction");
  assert.equal(state.agreement, null);
  state = ready(state, "receiving");
  state = accept(state, "receiving");
  assert.equal(state.agreement.sourceCaseId, state.sourceCaseId);
  assert.equal(state.agreement.targetCaseId, state.selectedId);
  assert.deepEqual(state.agreement.terms, state.terms);
  assert.deepEqual(state.agreement.confirmations, { construction: 1, receiving: 1 });
  assert.notEqual(state.agreement.terms, state.terms);
  assert.equal(base.documents.construction, false);
  assert.throws(() => action(state, "terms", "receiving", { terms: { ...state.terms, price: 1000 } }), /成立時の条件/);
  assert.throws(() => accept(state, "receiving"), /成立時の条件/);
  assert.equal("reservationId" in state.agreement, false);
  assert.equal("trips" in state, false);
});

test("receiving can confirm first but must wait for construction", () => {
  let state = ready(consulted(), "receiving");
  state = accept(state, "receiving");
  assert.equal(state.agreement, null);
  state = accept(ready(state, "construction"), "construction");
  assert.ok(state.agreement);
});

test("changing terms clears both confirmations and document reviews; old revisions cannot be accepted", () => {
  let state = ready(ready(consulted(), "construction"), "receiving");
  state = accept(state, "construction");
  state = action(state, "terms", "receiving", { terms: { ...state.terms, volume: 6000 } });
  assert.equal(state.revision, 2);
  assert.deepEqual(state.confirmations, { construction: null, receiving: null });
  assert.deepEqual(state.documents, { construction: false, receiving: false });
  assert.throws(() => action(state, "accept", "construction", { revision: 1 }), /最新の版/);
  assert.throws(() => accept(state, "receiving"), /サンプル資料/);
  state = accept(ready(state, "receiving"), "receiving");
  assert.equal(state.agreement, null);
  state = accept(ready(state, "construction"), "construction");
  assert.equal(state.agreement.revision, 2);
  assert.equal(state.agreement.terms.volume, 6000);
});

test("candidate comparison exposes mismatched capacity and soil; neither may start a consultation", () => {
  const published = action(fixture(), "publish");
  const candidates = matchingCandidatesFor(published);
  assert.ok(candidateChecks(published, candidates[0]).every(check => check.ok));
  assert.equal(candidateChecks(published, candidates[1]).find(check => check.label === "総数量").ok, false);
  assert.equal(candidateChecks(published, candidates[2]).find(check => check.label === "土質").ok, false);
  for (const candidate of candidates.slice(1)) {
    const state = action(published, "select", "construction", { id: candidate.id });
    assert.throws(() => action(state, "consult"), /受入条件と合わない/);
  }
});

test("a mismatch introduced during consultation prevents agreement", () => {
  let state = consulted();
  state = action(state, "terms", "receiving", { terms: { ...state.terms, volume: 9000 } });
  state = ready(state, "receiving");
  assert.throws(() => accept(state, "receiving"), /総数量が受入条件と一致/);
  assert.equal(state.agreement, null);
});

test("invalid quantities, impossible daily limits and invalid dates preserve the prior terms", () => {
  const state = consulted();
  const invalid = [
    { volume: 0 }, { volume: Infinity }, { daily: 0 }, { daily: 10000 },
    { start: "2026-99-01" }, { end: "2026-10-01" }, { price: -1 },
    { end: "2026-02-30" }, { unit: "kg" }, { volume: 6400, daily: 1 },
  ];
  for (const patch of invalid) {
    const terms = { ...state.terms, ...patch };
    assert.ok(validateTerms(terms));
    assert.throws(() => action(state, "terms", "construction", { terms }));
    assert.equal(state.revision, 1);
  }
});

test("role and sequence guards reject unsupported operations and duplicate confirmation", () => {
  assert.throws(() => action(fixture(), "publish", "receiving"), /施工側/);
  assert.throws(() => action(fixture(), "consult"), /施工側で搬出条件/);
  assert.throws(() => action(fixture(), "publish", "driver"), /操作役割/);
  let state = consulted();
  assert.throws(() => action(state, "select", "construction", { id: "MDEMO-RECEIVE-002" }), /相談開始前/);
  assert.throws(() => action(state, "source", "construction", { siteId: state.sourceSiteId, terms: state.terms }), /条件調整/);
  state = ready(state, "construction");
  assert.throws(() => ready(state, "construction"), /確認済み/);
  state = accept(state, "construction");
  assert.throws(() => accept(state, "construction"), /確認済み/);
});

test("storage reload keeps IDs and agreements; stale writes cannot overwrite another actor", () => {
  const local = storage();
  local.setItem(matchingDemoKey, JSON.stringify(consulted()));
  const old = readMatchingJourney(local);
  const next = writeMatchingJourney(local, { type: "documents", actor: "receiving", expectedVersion: old.version, at: "2026-10-13T02:00:00Z" });
  assert.throws(() => writeMatchingJourney(local, { type: "documents", actor: "construction", expectedVersion: old.version }), /別の画面/);
  assert.deepEqual(readMatchingJourney(local), next);
  assert.equal(readMatchingJourney(local).consultationId, old.consultationId);
});

test("a storage failure never returns an updated state or changes other demo records", () => {
  const local = storage();
  local.setItem("ecodump-narita-preview-v1", "existing trips");
  local.setItem(matchingDemoKey, JSON.stringify(consulted()));
  const before = readMatchingJourney(local);
  local.setItem = () => { throw new Error("quota exceeded"); };
  assert.throws(() => writeMatchingJourney(local, { type: "documents", actor: "construction", expectedVersion: before.version }), /quota exceeded/);
  assert.deepEqual(readMatchingJourney(local), before);
  assert.equal(local.getItem("ecodump-narita-preview-v1"), "existing trips");
});

test("corrupted saved data is reported instead of silently discarded", () => {
  const local = storage();
  local.setItem(matchingDemoKey, "{invalid");
  assert.throws(() => readMatchingJourney(local));
  assert.equal(local.getItem(matchingDemoKey), "{invalid");
  local.setItem(matchingDemoKey, JSON.stringify({ schema: 1 }));
  assert.throws(() => readMatchingJourney(local), /読み込めません/);
  const invalidAgreement = consulted();
  invalidAgreement.agreement = { id: "MDEMO-AGREEMENT-001", revision: 1, terms: invalidAgreement.terms };
  local.setItem(matchingDemoKey, JSON.stringify(invalidAgreement));
  assert.throws(() => readMatchingJourney(local), /読み込めません/);
});
