export function receiptErrors(value) {
  const errors = {};
  if (!value.photo) errors.photo = "原票写真を追加してください。";
  if (!String(value.number || "").trim())
    errors.number = "伝票番号を入力してください。";
  const quantity = Number(value.quantity);
  if (
    String(value.quantity ?? "").trim() === "" ||
    !Number.isFinite(quantity) ||
    quantity < 0.001
  )
    errors.quantity = "原票の数量は0.001以上の数値を入力してください。";
  else if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001)
    errors.quantity = "数量は小数第3位までで入力してください。";
  if (!["m3", "t"].includes(value.unit))
    errors.unit = "原票の単位を選択してください。";
  return errors;
}
export function receiptStep(value) {
  const step = Number(value.step);
  return [1, 2, 3].includes(step)
    ? step
    : value.state === "pending"
      ? 3
      : value.photo
        ? 2
        : 1;
}
