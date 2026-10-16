import test from "node:test";
import assert from "node:assert/strict";
import { summarizeVehicles, matchesTripState, summarizeTrips } from "../src/construction/operationsModel.mjs";

const rows = [
  { id: "A-1", vehicleId: "A", booking: "有効", confirmed: 0, departed: "08:00" },
  { id: "A-2", vehicleId: "A", booking: "有効", confirmed: null },
  { id: "B-1", vehicleId: "B", booking: "有効", confirmed: null },
  { id: "draft", vehicleId: "", booking: "有効", confirmed: null },
  { id: "B-cancel", vehicleId: "B", booking: "取消", confirmed: null },
  { id: "draft-cancel", vehicleId: "", booking: "取消", confirmed: null },
  { id: "reject", vehicleId: "C", booking: "取消", reservation: "受入不可", confirmed: null },
];

test("the same vehicle in two rotations counts once per state, while extended counts retain both rotations", () => {
  assert.deepEqual(summarizeVehicles(rows), [
    { key: "有効予定", label: "予定台数", actual: 2, extended: 4, unassigned: 1 },
    { key: "受入完了", label: "受入完了台数", actual: 1, extended: 1, unassigned: 0 },
    { key: "受入待ち", label: "受入待ち台数", actual: 2, extended: 3, unassigned: 1 },
    { key: "取消", label: "取消台数", actual: 1, extended: 2, unassigned: 1 },
  ]);
  for (const metric of summarizeVehicles(rows)) assert.equal(rows.filter(row=>matchesTripState(row,metric.key)).length,metric.extended);
});

test("unassigned rotations never invent vehicle IDs and rejected reservations are not cancellations", () => {
  assert.equal(summarizeVehicles(rows).find(row=>row.key==="取消").extended,2);
  assert.equal(matchesTripState(rows.at(-1),"取消"),false);
  assert.equal(matchesTripState(rows.at(-1),"受入待ち"),false);
  assert.deepEqual(summarizeVehicles([]).map(row=>[row.actual,row.extended,row.unassigned]),Array(4).fill([0,0,0]));
});

test("a confirmed zero quantity is complete and must not stay in waiting or exported pending", () => {
  assert.equal(matchesTripState(rows[0],"受入完了"),true);
  assert.equal(matchesTripState(rows[0],"受入待ち"),false);
  assert.equal(matchesTripState(rows[0],"搬出済み・受入未完了"),false);
  assert.equal(summarizeTrips([rows[0]]).received,1);
});
