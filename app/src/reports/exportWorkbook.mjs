import * as XLSX from "xlsx";

const safeName = (value) => String(value || "帳票").replace(/[\\/:*?"<>|]/g, "_");

export function buildOperationsWorkbook({ title, conditions, summaryRows, detailHeaders, detailRows, generatedAt = new Date() }) {
  const workbook = XLSX.utils.book_new();
  const summary = [
    [title],
    ["生成日時", generatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })],
    ["集計基準", "予定・ドライバー報告・受入確定を別集計。未確定は確定合計に含めず、m³とtは換算しない。"],
    [],
    ["抽出条件", "設定値"],
    ...Object.entries(conditions).map(([key, value]) => [key, value || "すべて"]),
    [],
    ["集計項目", "単位", "値"],
    ...summaryRows,
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summary.forEach((row, index) => {
    const cell = summarySheet[XLSX.utils.encode_cell({r:index,c:2})];
    if (String(row[0]).includes("数量") && cell?.t === "n") cell.z = "#,##0.0";
  });
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 18 }];
  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  detailHeaders.forEach((header, column) => {
    if (!String(header).includes("数量")) return;
    detailRows.forEach((_, index) => {
      const cell = detailSheet[XLSX.utils.encode_cell({r:index+1,c:column})];
      if (cell?.t === "n") cell.z = "#,##0.0";
    });
  });
  detailSheet["!cols"] = detailHeaders.map((header) => ({ wch: Math.max(12, String(header).length * 2 + 2) }));
  XLSX.utils.book_append_sheet(workbook, summarySheet, "集計");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "便別明細");
  return workbook;
}

export function downloadOperationsWorkbook(options) {
  const workbook = buildOperationsWorkbook(options);
  XLSX.writeFile(workbook, `${safeName(options.filename || options.title)}.xlsx`, {
    bookType: "xlsx",
    compression: true,
  });
}
