import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, ShieldCheck } from "lucide-react";
import { readReviewContext, writeReviewContext } from "./reviewContext.mjs";

const contextKey = "ecodump-review-site-table";
export default function ReviewSiteTable({ records, selectedField, renderDetails }) {
  const [expandedId, setExpandedId] = useState(() => readReviewContext(contextKey, {}).expandedId || null);
  const [copyStatus, setCopyStatus] = useState(null);
  const scroll = useRef(null);
  useEffect(() => {
    if (selectedField !== "すべて" && records.length === 1) setExpandedId(records[0].id);
  }, [selectedField]);
  useEffect(() => {
    writeReviewContext(contextKey, {...readReviewContext(contextKey, {}), expandedId});
  }, [expandedId]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = readReviewContext(contextKey, {}).scrollLeft || 0;
  }, []);
  function toggle(record) {
    setExpandedId(expandedId === record.id ? null : record.id);
    // Details use the work-area width; opening a row resets horizontal offset.
    if (scroll.current) scroll.current.scrollLeft = 0;
  }
  async function copyId(record) {
    try { await navigator.clipboard.writeText(String(record.id)); setCopyStatus(`現場ID ${record.id} をコピーしました`); }
    catch { setCopyStatus(`コピーできませんでした。現場ID：${record.id}`); }
  }
  return <section className="review-site-table-section" aria-labelledby="review-site-list-title">
    <h2 id="review-site-list-title" className="review-site-list-title">現場一覧 <small>{records.length}現場</small></h2>
    <p className="review-site-table-hint">現場を選ぶと、この一覧の中で詳細と搬出予定を確認できます。</p>
    {copyStatus && <p role="status">{copyStatus}</p>}
    <div className="review-site-table-scroll" ref={scroll} tabIndex={0} role="region" aria-label="現場一覧。表は横にスクロールできます"
      onScroll={e => writeReviewContext(contextKey, {...readReviewContext(contextKey, {}), scrollLeft:e.currentTarget.scrollLeft})}>
      <table className="review-site-table">
        <colgroup>{["company","branch","name","address","date","date","status"].map((name,i)=><col key={i} className={`review-site-col-${name}`}/>)}</colgroup>
        <thead><tr>{["元請名","支店名","現場名","住所","着工日","竣工日","ステータス"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{records.map(record => <Fragment key={record.id}>
          <tr className={`review-site-row ${expandedId === record.id ? "selected" : ""}`} data-field-id={record.id}>
            <td data-label="元請名">{record.company}</td>
            <td data-label="支店名">{record.branch}</td>
            <td data-label="現場名">
              <strong>{record.field}</strong>
              <div className="review-site-meta"><span>ID：{record.id}</span><button type="button" aria-label={`現場ID ${record.id} をコピー`} onClick={()=>copyId(record)}><Copy size={14}/></button><span><ShieldCheck size={14}/> CCUS</span></div>
              <button className="outline review-site-open" type="button" aria-expanded={expandedId === record.id} aria-controls={`review-site-detail-${record.id}`} onClick={()=>toggle(record)}>
                {expandedId === record.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                {expandedId === record.id ? "詳細を閉じる" : "現場詳細を開く"}
              </button>
            </td>
            <td data-label="住所">{record.address}</td>
            <td data-label="着工日"><time>{record.start}</time></td>
            <td data-label="竣工日"><time>{record.end}</time></td>
            <td data-label="ステータス"><span className="review-site-status">{record.status || "稼働中"}</span></td>
          </tr>
          {expandedId === record.id && <tr className="review-site-detail-row"><td colSpan={7}>
            <div id={`review-site-detail-${record.id}`} className="review-site-inline-detail" role="region" aria-label={`${record.field}の詳細`}>
              {renderDetails(record)}
            </div>
          </td></tr>}
        </Fragment>)}</tbody>
      </table>
    </div>
    {!records.length && <p className="empty-state">該当する現場はありません。日付または絞り込み条件を変更してください。</p>}
  </section>;
}
