const pages=['会社情報','ユーザー一覧','車両一覧','代行先一覧','代行登録申請','自社の代行元一覧'];
const names=['会社情報','ユーザー','車両','協力会社','登録申請','元請会社'];
export const receivingMasterPages=pages;
export default function ReceivingSettingsNavigation({page,navigate,children}) {
  return <section className="receiving-master-workspace">
    <nav className="receiving-master-navigation" aria-label="基本台帳・関係会社のメニュー">
      <button className="outline" onClick={()=>navigate('取引先・基本設定')}>取引先・基本設定へ戻る</button>
      <label>表示する項目<select value={page} onChange={e=>navigate(e.target.value)}>{pages.map((p,i)=><option key={p} value={p}>{names[i]}</option>)}</select></label>
    </nav>{children}
  </section>;
}
