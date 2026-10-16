import { DEMO_DRIVER } from "./driverModel.js";
import { updateDemoTrip } from "../demo/store.jsx";
import { useEffect, useRef, useState } from "react";
import { draftStore, readPhoto } from "./documents/draftStore.mjs";
import { receiptErrors, receiptStep } from "./receiptForm.mjs";
export default function DemoReceipt({ trip }) {
  const key = `demo-receipt:${DEMO_DRIVER}:${trip.date}:${trip.id}`,
    queue = useRef(Promise.resolve()),
    current = useRef(null),
    pendingWrites = useRef(0),
    form = useRef(null);
  const [d, setD] = useState(null),
    [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState({}),
    [saving, setSaving] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let active = true;
    draftStore(key)
      .then((v) => {
        if (active) {
          const value = v || {
            quantity: "",
            unit: trip.unit === "t" ? "t" : "m3",
            number: "",
            photo: null,
            history: [],
            state: "draft",
            reason: "",
            step: 1,
          };
          current.current = value;
          setD(value);
        }
      })
      .catch(() => setError("端末下書きを読み込めません。"));
    return () => {
      active = false;
    };
  }, [key]);
  function save(p) {
    const previous = current.current,
      value = { ...previous, ...p };
    current.current = value;
    setD(value);
    pendingWrites.current++;
    setSaving(true);
    const task = queue.current
      .catch(() => {})
      .then(() => draftStore(key, value));
    queue.current = task;
    return task
      .then(() => true)
      .catch((e) => {
        if (current.current === value && p.state === "pending") {
          const restored = {
            ...value,
            state: previous.state,
            history: previous.history,
          };
          current.current = restored;
          setD(restored);
        }
        setError(
          `端末下書きを保存できませんでした：${e.message}。画面を閉じる前に内容を確認してください。`,
        );
        return false;
      })
      .finally(() => {
        pendingWrites.current--;
        setSaving(pendingWrites.current > 0);
      });
  }
  function change(name, value) {
    setError("");
    setFieldErrors((e) => ({ ...e, [name]: "" }));
    save({ [name]: value, state: "draft" });
  }
  async function photo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    setFieldErrors((v) => ({ ...v, photo: "" }));
    try {
      await save({ photo: await readPhoto(file), state: "draft" });
    } catch (err) {
      setFieldErrors((v) => ({ ...v, photo: err.message }));
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }
  async function moveStep(step) {
    const saved = await save({ step });
    if (saved)
      requestAnimationFrame(() => {
        const container = form.current?.closest(".driver-content"),
          target = form.current?.querySelector(".receipt-steps");
        if (container && target)
          container.scrollTo({
            top:
              container.scrollTop +
              target.getBoundingClientRect().top -
              container.getBoundingClientRect().top,
          });
      });
  }
  function advance(step) {
    setError("");
    const errors = receiptErrors(current.current);
    const visible =
      step === 2
        ? Object.fromEntries(
            Object.entries(errors).filter(([key]) => key === "photo"),
          )
        : errors;
    setFieldErrors(visible);
    if (Object.keys(visible).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    moveStep(step);
  }
  async function submit() {
    const value = current.current,
      errors = receiptErrors(value);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      await moveStep(errors.photo ? 1 : 2);
      return;
    }
    setSubmitting(true);
    setError("");
    const ok = await save({
      state: "pending",
      step: 3,
      history: [
        ...value.history,
        {
          at: new Date().toISOString(),
          quantity: value.quantity,
          unit: value.unit,
          number: value.number,
          photo: value.photo,
          reason: value.reason,
        },
      ],
    });
    if (ok) {
      try {
        updateDemoTrip(
          trip.id,
          {
            reported: Number(value.quantity),
            reportedUnit: value.unit === "m3" ? "m³" : "t",
            slip: "確認待ち",
            ticketId: value.number,
          },
          trip.assignmentVersion,
        );
      } catch (e) {
        setError(
          `端末には保存しましたが、共有デモへの反映はできませんでした：${e.message}。内容を確認してください。`,
        );
      }
    }
    setSubmitting(false);
  }
  if (!d) return <p>{error || "伝票下書きを読込中…"}</p>;
  const step = receiptStep(d),
    busy = saving || photoBusy || submitting;
  return (
    <section
      className="detail-section demo-receipt"
      id="demo-receipt"
      ref={form}
    >
      <h2>伝票・端末内デモ</h2>
      <p>
        便 {trip.id} / {trip.registration}
      </p>
      <p>
        API未接続。写真・入力・提出後の表示例はこの端末内のみで、管理者へは送信しません。確認待ちの仮状態だけを同じブラウザの管理画面と共有します。
      </p>
      <p role="status">
        {saving
          ? "端末下書き保存中"
          : {
              draft: "未送信・端末下書き",
              pending: "確認待ちの表示例（未送信）",
              returned: "差戻しの表示例（未送信）",
            }[d.state]}
      </p>
      {d.state === "returned" && (
        <p>差戻し理由（表示例）：原票数量を再確認してください。</p>
      )}
      <p className="receipt-receiving-status">
        受入実績：
        {trip.confirmed == null
          ? "受入側の確認待ち"
          : `${trip.confirmed} ${trip.unit}（デモ）`}
        。原票の報告値と受入側の確認値は別です。
      </p>
      <ol className="receipt-steps" aria-label="伝票入力の手順">
        {["写真", "数量入力", "内容確認"].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {step === 1 && (
        <div className="receipt-step">
          <h3>1. 原票写真を追加</h3>
          <label>
            <span>原票写真（JPEG・PNG 2MB以下）</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={photoBusy}
              aria-invalid={!!fieldErrors.photo}
              aria-describedby="receipt-photo-help"
              onChange={photo}
            />
          </label>
          <p id="receipt-photo-help">
            文字と数量が読める写真を選択してください。自動読取は未接続です。
          </p>
          {fieldErrors.photo && (
            <p className="receipt-field-error" role="alert">
              {fieldErrors.photo}
            </p>
          )}
          {d.photo && (
            <>
              <img
                className="receipt-photo"
                src={`data:${d.photo.mime};base64,${d.photo.base64}`}
                alt="端末内の原票写真"
              />
              <small>{d.photo.filename}</small>
            </>
          )}
          <div className="receipt-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => advance(2)}
            >
              数量入力へ
            </button>
          </div>
          {!d.photo && <p>原票写真を追加すると次へ進めます。</p>}
        </div>
      )}
      {step === 2 && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            advance(3);
          }}
          className="receipt-step"
        >
          <h3>2. 原票の内容を入力</h3>
          <label>
            <span>伝票番号</span>
            <input
              required
              aria-label="伝票番号"
              value={d.number}
              aria-invalid={!!fieldErrors.number}
              onChange={(e) => change("number", e.target.value)}
            />
            {fieldErrors.number && (
              <small className="receipt-field-error">
                {fieldErrors.number}
              </small>
            )}
          </label>
          <label>
            <span>原票の数量</span>
            <input
              required
              aria-label="原票の数量"
              type="number"
              inputMode="decimal"
              min="0.001"
              step="0.001"
              value={d.quantity}
              aria-invalid={!!fieldErrors.quantity}
              onChange={(e) => change("quantity", e.target.value)}
            />
            {fieldErrors.quantity && (
              <small className="receipt-field-error">
                {fieldErrors.quantity}
              </small>
            )}
          </label>
          <label>
            <span>原票の単位</span>
            <select
              value={d.unit}
              onChange={(e) => change("unit", e.target.value)}
            >
              <option value="m3">m³</option>
              <option value="t">t</option>
            </select>
          </label>
          <label>
            <span>修正・確認メモ</span>
            <input
              value={d.reason}
              onChange={(e) => change("reason", e.target.value)}
            />
          </label>
          <p>
            予定 {trip.quantity} {trip.unit} ／ 受入確定数量：
            {trip.confirmed == null
              ? "未確定"
              : `${trip.confirmed} ${trip.unit}（デモ）`}
            。単位の自動換算なし。
          </p>
          {(d.unit === "m3" ? "m³" : "t") !== trip.unit && (
            <p className="receipt-field-error">
              予定と原票の単位が異なります。数量は自動換算せず、原票の単位で保持します。
            </p>
          )}
          <div className="receipt-actions">
            <button className="primary" disabled={busy}>
              提出前の内容を見る
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => moveStep(1)}
            >
              写真へ戻る
            </button>
          </div>
        </form>
      )}
      {step === 3 && (
        <div className="receipt-step">
          <h3>3. 提出前確認（端末内デモ）</h3>
          {d.photo && (
            <img
              className="receipt-photo"
              src={`data:${d.photo.mime};base64,${d.photo.base64}`}
              alt="確認する原票写真"
            />
          )}
          <dl>
            <dt>便・運搬先</dt>
            <dd>
              {trip.id}
              <br />
              {trip.from} → {trip.to}
            </dd>
            <dt>伝票番号</dt>
            <dd>{d.number}</dd>
            <dt>原票の数量</dt>
            <dd>
              {d.quantity} {d.unit === "m3" ? "m³" : "t"}
            </dd>
            <dt>確認メモ</dt>
            <dd>{d.reason || "なし"}</dd>
          </dl>
          <p>
            受入側の確認を待つための表示です。荷下ろし報告・受入実績の確定は別の操作です。
          </p>
          <div className="receipt-actions">
            {d.state !== "pending" && (
              <button className="primary" disabled={busy} onClick={submit}>
                確認待ちの表示例を端末に保存（送信しない）
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => moveStep(2)}
            >
              入力内容を修正する
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => moveStep(1)}
            >
              写真を確認・変更する
            </button>
          </div>
        </div>
      )}
      {d.state === "pending" && (
        <details>
          <summary>差戻しの動作を試す</summary>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => save({ state: "returned", step: 2 })}
          >
            差戻しの表示例に切り替える
          </button>
        </details>
      )}
      <details>
        <summary>端末内の確認履歴 {d.history.length}件</summary>
        {d.history.map((h, i) => (
          <p key={i}>
            第{i + 1}版 / {new Date(h.at).toLocaleString("ja-JP")} /{" "}
            {h.quantity} {h.unit} / {h.reason || "初回確認"}（未送信）
          </p>
        ))}
      </details>
    </section>
  );
}

export function DemoReceiptSummary({ tripId, date, confirmed, unit }) {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    let active = true;
    draftStore(`demo-receipt:${DEMO_DRIVER}:${date}:${tripId}`)
      .then((v) => {
        if (active) setD(v || null);
      })
      .catch(() => {
        if (active) setD(null);
      });
    return () => {
      active = false;
    };
  }, [tripId, date]);
  return (
    <>
      <small>
        本人入力：
        {d?.quantity
          ? `${d.quantity} ${d.unit === "m3" ? "m³" : "t"}`
          : "未入力"}
        （端末内・未送信）
      </small>
      <small>
        伝票：
        {d === undefined
          ? "読込中"
          : !d
            ? "未提出"
            : d.state === "pending"
              ? d.history.length > 1
                ? "再提出後確認待ちの表示例"
                : "確認待ちの表示例"
              : d.state === "returned"
                ? "差戻しの表示例"
                : "下書き"}{" "}
        ／ 受入確定：
        {confirmed == null ? "未確定" : `${confirmed} ${unit}（共有デモ）`}
      </small>
    </>
  );
}
