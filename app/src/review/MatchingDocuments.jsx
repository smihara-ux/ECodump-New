import { useEffect, useRef, useState } from "react";

export default function MatchingDocuments({ candidate, close }) {
  const dialog = useRef(null), [selected,setSelected] = useState(null);
  const documents = ["土質試験結果","位置図","搬出計画","車両一覧","搬入申請書"];
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog className="review-dialog matching-documents" ref={dialog} onCancel={close} aria-label={`${candidate.destination}の必要書類`}>
    <header><div><h2>必要書類の確認</h2><b>{candidate.destination}</b><p>{candidate.id}</p></div><button onClick={close} aria-label="必要書類を閉じる">×</button></header>
    <p>候補に必要な書類の表示例です。実ファイルは未接続で、提出・審査済みとは判定していません。</p>
    <div className="results-table-wrap"><table className="service-table"><thead><tr><th>書類</th><th>状態</th><th>操作</th></tr></thead><tbody>{documents.map(name=><tr key={name}><td>{name}</td><td>未確認・実ファイル未接続</td><td><button className="outline" aria-expanded={selected===name} onClick={()=>setSelected(selected===name?null:name)}>確認する</button></td></tr>)}</tbody></table></div>
    {selected && <section role="status"><h3>{selected}</h3><p>{candidate.destination}（{candidate.id}）の実ファイルは未接続です。原本の取得・閲覧・提出は行っていません。</p></section>}
    <button className="outline" onClick={close}>候補の確認へ戻る</button>
  </dialog>;
}
