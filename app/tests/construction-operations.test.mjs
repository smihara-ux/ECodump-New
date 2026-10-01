import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { constructionTrips, matchesTripState, summarizeTrips } from "../src/construction/operationsModel.mjs";
import { buildOperationsWorkbook } from "../src/reports/exportWorkbook.mjs";

const plans = Array.from({ length: 6 }, (_, index) => ({
  id: `T-${index + 1}`, day: "当日", departure: "現場A", destination: "受入A",
  vehicle: `車両${index + 1}`, driver: `運転手${index + 1}`, departAt: "08:00", arriveAt: "09:00", material: "第2種",
}));

test("construction progress excludes cancelled trips and separates quantities", () => {
  const rows = constructionTrips(plans, "2026-09-30");
  const summary = summarizeTrips(rows);
  assert.equal(summary.active, 5);
  assert.equal(summary.cancelled, 1);
  assert.equal(rows.filter((row) => matchesTripState(row, "搬出済み・受入未完了")).length, 3);
  assert.deepEqual(summary.quantities.map((row) => row.unit), ["m³", "t"]);
  assert.equal(summary.quantities.find((row) => row.unit === "m³").remaining, 14);
});

test("Excel workbook contains real summary and trip-detail sheets", () => {
  const workbook = buildOperationsWorkbook({
    title: "搬出実績", conditions: { 期間: "2026-09-30" },
    summaryRows: [["対象便数", "便", 2]], detailHeaders: ["便番号", "予定数量"], detailRows: [["T-1", 7], ["T-2", 8]],
  });
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const parsed = XLSX.read(bytes);
  assert.deepEqual(parsed.SheetNames, ["集計", "便別明細"]);
  assert.equal(XLSX.utils.sheet_to_json(parsed.Sheets["便別明細"], { header: 1 }).length, 3);
});

test("completed short delivery is variance, never an unfinished plan",()=>{const q=summarizeTrips([{booking:"有効",unit:"m³",planned:10,reported:9.5,confirmed:9.5}]).quantities[0];assert.equal(q.remaining,0);assert.equal(q.variance,-0.5);});

test("cancellation removes future plans but retains recorded confirmed quantities",()=>{const q=summarizeTrips([{booking:"取消",unit:"m³",planned:10,confirmed:9.5}]).quantities[0];assert.equal(q.planned,0);assert.equal(q.remaining,0);assert.equal(q.confirmed,9.5);});
