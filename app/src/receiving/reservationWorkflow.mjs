// Display guidance only. State changes remain guarded by transitionTrip.
export function reservationStep(t) {
  if (["取消", "受入不可"].includes(t.reservation))
    return {
      panel: "history",
      state: t.reservation,
      owner: "対応終了",
      next: "理由と履歴を確認",
      hint: "この予約は終了しています。新たな運搬は別の予約で確認してください。",
    };
  if (t.receipt === "実績確定" || t.confirmed != null)
    return {
      panel: "receipt",
      state: "受入完了",
      owner: "対応終了",
      next: "確定した数量・履歴を確認",
      hint: "ドライバーの報告と受入側の確認を経て確定した数量です。",
    };
  if (t.reservation === "変更依頼")
    return {
      panel: "conditions",
      state: "予約の変更待ち",
      owner: "施工側",
      next: t.matchAgreementId ? "施工側で予定を変更" : "変更内容で再申請",
      hint: "受入側の変更依頼を確認してから再申請し、改めて予約承認を受けます。",
    };
  if (t.reservation === "申請中")
    return {
      panel: "conditions",
      state: "予約承認待ち",
      owner: "受入側",
      next: t.agreement ? "予約条件を確認して承認" : "条件合意を確認",
      hint: "条件合意と日次の予約承認は別の手続きです。",
    };
  if (t.driverReport || t.reception === "内容確認待ち")
    return {
      panel: "receipt",
      state: t.receipt === "内容確認済み" ? "実績確定待ち" : "荷下ろし報告済み",
      owner: "受入側",
      next:
        t.receipt === "内容確認済み"
          ? "確認した数量を確定"
          : "伝票・実績数量を確認",
      hint: "荷下ろし報告だけでは受入完了になりません。受入側が数量と土質を確認します。",
    };
  if (t.reception === "待機")
    return {
      panel: "reception",
      state: "到着受付済み",
      owner: "受入側",
      next: "受入開始",
      hint: "場内への案内を確認してから受入を開始します。",
    };
  if (t.reception === "受入中")
    return {
      panel: "reception",
      state: "受入中",
      owner: "ドライバー",
      next: "荷下ろし報告を待つ",
      hint: "荷下ろし報告後に、受入側の伝票・数量確認へ進みます。",
    };
  return {
    panel: "reception",
    state: "予約確定・到着前",
    owner: "受入側",
    next: "車両の到着後に受付",
    hint: "予約が確定していても、到着・荷下ろし・受入完了はそれぞれ別に記録します。",
  };
}
export function reservationErrors(t, v, action) {
  const errors = {};
  if (
    ["change", "reject", "cancel", "delay"].includes(action) &&
    !v.reason.trim()
  )
    errors.reason = "理由を入力してください。";
  if (action === "delay" && !v.eta)
    errors.eta = "変更後の到着予定を入力してください。";
  if (action === "resubmit") {
    if (!v.eta) errors.eta = "到着予定を入力してください。";
    if (!Number.isFinite(Number(v.planned)) || Number(v.planned) <= 0)
      errors.planned = "予定数量は0より大きい数値を入力してください。";
  }
  if (action === "review") {
    if (
      String(v.actual).trim() === "" ||
      !Number.isFinite(Number(v.actual)) ||
      Number(v.actual) <= 0
    )
      errors.actual = "実績数量は0より大きい数値を入力してください。";
    if (
      (Number(v.actual) !== Number(t.planned) || v.actualSoil !== t.soil) &&
      !v.reason.trim()
    )
      errors.reason = "数量または土質の差異理由を入力してください。";
  }
  return errors;
}
export function reviewedValuesMatch(t, v) {
  return (
    t.receipt === "内容確認済み" &&
    String(v.actual).trim() !== "" &&
    Number(v.actual) === Number(t.actual) &&
    v.actualSoil === t.actualSoil &&
    v.reason.trim() === (t.differenceReason || "").trim()
  );
}
export function displayReservationHistory(entry) {
  const labels = {
    approve: "予約承認",
    change: "変更依頼",
    resubmit: "再申請",
    reject: "受入不可",
    cancel: "予約取消",
    arrive: "到着受付",
    start: "受入開始",
    "driver-report": "荷下ろし報告",
    review: "受入内容確認",
    confirm: "実績確定",
    delay: "到着予定変更",
  };
  return String(entry).replace(
    /\b(approve|change|resubmit|reject|cancel|arrive|start|driver-report|review|confirm|delay)(?=（試作)/g,
    (key) => labels[key],
  );
}
