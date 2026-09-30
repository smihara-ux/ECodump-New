# 受入－1〜5 実装・開発確認（2026-09-30）

## 対象と環境
受入管理、搬入予約・受付、受入実績。発生土マッチの確認で代替していない。
既存ReceivingHome / ReceivingConnected / ReceivingEvidence / ReceiptEvidence、現場別集計、原票API、日次条件APIを再利用した。
ローカルVite 5204 → 共通API 6116 → 隔離PostgreSQL ecodump_direct_validation。既存会社・予約・便IDを使用。新規DBマイグレーションなし。
共有作業ツリーの施工・ドライバー変更は上書きせず、帳票の共通writerは施工担当の src/reports/exportWorkbook.mjs を利用。
DGX更新・本番公開・正式3者連携試験・実機試験は実施していない。担当内の開発確認であり、ユーザー承認済みではない。

## 確認URLとログイン
- ホーム：http://127.0.0.1:5204/?preview=app&role=receiving&page=transport
- 受付：http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-reservations
- 実績：http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-results
- 受入条件：http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-locations

未ログインは共有デモ（DB未保存）。「ログインして保存を利用」で既存検証アカウントを使用すると同じ画面内で実API接続。
今回の画面確認アカウントは narita-receiver-tochigi@sample.invalid、確認日付は2026-09-25。
茨城担当のAPI確認は narita-receiver-ibaraki@sample.invalid。パスワードは公開資料に記載しない。ローカル既存資格情報を再利用。
共有デモの確認は2026-09-30と2026-10-01。上記URLはこのMac上のローカル確認用でありDGX配置版ではない。

## 項目別
|項目|実装箇所|操作手順|結果|
|---|---|---|---|
|受入1 日付と実績入口|DateControls.jsx / viewState.js / ReceivingWorkspace.jsx / ReceivingConnected.jsx / App.jsx|ホームで前日・今日・翌日・カレンダー、受入場所を選択→受入実績を見る→戻る|共有デモで翌日・ヤードBを引継ぎ。API画面で9/25を引継ぎ。実績からホームを経由して戻るとスクロール732.5pxを復元。|
|受入2 進捗と残予定|receivingSummary.mjs / liveModel.mjs / HomeDrilldown.jsx|件数・単位別残予定を押し対象便を確認|有効予定、未到着、待機、受入中、受入完了、取消、未確認伝票を分離。荷下ろし後9.5m³は確認待ち、確定0。取消の予定を残予定へ入れない。|
|受入3 枠と残量|ReceivingLocationsConnected.jsx / ReceivingWorkspace.jsx|ホーム「受入枠と残量」→条件設定、場所・確認日を選択|「算定条件未設定」を表示。既存日次枠・土質・単位・営業時間・曜日と変更履歴を使用。算定・予約制御は仕様決定待ち。|
|受入4 便一覧・詳細|TripList.jsx / transportReport.mjs / ReceivingConnected.jsx / receiving.css|便一覧から「受付・原票・運行詳細」→一覧に戻る|到着予定順、車番・運送会社・ドライバー、到着報告・受付・荷下ろし・予定/報告/確定・伝票状態を表示。PC表、1024pxタブレット、390px縦カードを確認。既存の原票9.5m³、差異-0.5、原本写真まで到達。|
|受入5 Excel|transportReport.mjs / 共通exportWorkbook.mjs / ReceivingConnected.jsx / ReceivingWorkspace.jsx|期間・場所・搬出元などを指定→Excel出力|実体xlsx、集計・便別明細の2シート。画面に渡す同一配列で出力。共有デモ1行・実API2行のブラウザ保存ファイルを読み直して一致確認。既存試作CSVも維持。|

## 数量・状態の規則
- 残予定量＝取消/受入不可を除く未確定便の予定数量。予定−実績の差異や空き容量とは別。
- 到着報告は待機、受入担当の確認済み入場記録が受付。荷下ろし報告は数量確定にしない。
- 確定数量は receiptRecord.status=confirmed かつ actual が存在する値のみ。旧実績・未確認・差戻し中を除外。
- 取消後も保存済み確定実績を保持。訂正後の確定値を集計し、原票・履歴は既存DBに保持。
- m³とtは別集計、換算なし。同一車両の複数便は異なる便ID。未配車予約は便ID欄で予約IDを表示し「未配車」と記載。Excelの対象行数は便行と未配車予約行を含むため、実車両台数と区別。
- 日付は便に指定日時がある場合その日本時間の日付、未配車は予約日。
- Excelには抽出期間、生成日時、集計規則、予定/報告/確定の単位、取消、訂正履歴件数を記載。受入側へ配車変更権限を追加していない。

## 開発確認
### 画面
- 共有デモ：翌日→受入場所B→実績で2026-10-01、1便、予定8m³。戻って同じ日付・場所。
- 実API：栃木担当・9/25、A/B工区2便・実車両1台。予定20m³、確認待ち9.5m³、確定0m³。
- 便詳細：原本写真、予定10m³、報告9.5m³、未確定、到着/荷下ろし報告、入場未確認を確認。
- 件数クリック：未確認伝票2便の既存詳細パネル、運送会社・ドライバー・原票タブへの導線を確認。
- 表の既存gridスタイル干渉を発見し、表表示を隔離。スマートフォンのgrid最小幅によるはみ出しを修正。カード幅370px/画面390pxを確認。
- 画面を離れて戻る際のスクロール位置732.5pxを実測して一致。
- Excel：Downloadsに保存された2ファイルを読み直し。共有デモT-007の1行、APIのA/B工区2行、APIの数量[10,9.5,未確定]と[10,未提出,未確定]が画面と一致。
- ブラウザ自動化のdownload待ち通知はタイムアウトしたが、実ファイルの保存・XLSX読込を別途確認できた。
- 実機（iPad/iPhone/Android）、Microsoft Excelアプリでの開封は未確認。

### ロジック・保存・権限
- ビルド成功。
- receiving-model / summary / live-model / results / report / mutation-journal：18テスト成功。
- 新規レポート試験：到着→受付→荷下ろし→数量確定の分離、取消除外、残予定20、確認待ち9.5、確定9.5、同一車両複数便、訂正9.4、取消後確定実績、単位別計算。生成XLSXの再読込と行数を確認。
- receiving-v2-read-development：2テスト成功。栃木/茨城の場所・予約分離、他方原票404、再ログイン後同じID、日次条件保存/再取得/履歴/同じキーの二重送信/操作結果照会/古い版409/担当外403。
- receiving-evidenceをローカル6116向けに実行：6テスト成功。独自開発便（2052-02-22）を追加し、原票提出→差戻し→再提出、明示照合を要する確定、同時確認拒否、訂正前後・担当・日時、応答喪失の照会、入退場・重複検知、APIおよびDBのRLS、添付権限を検証。成田画面確認用の9/25便は更新していない。
- 再実行用の既存evidenceテストに RECEIVING_TEST_API / RECEIVING_TEST_FIXTURE の指定を追加。テスト便は隔離DBに保持。fixtureは ../receiving-evidence-qa/receiving-1-5-development-fixture.json。

## 仕様決定待ち・依存事項
受入3は「未設定表示・既存設定への導線」まで実装済み。容量管理が完成したとは扱わない。
1. 日次枠を予約数量で占有する時点（申請/承認）と解除時点。
2. 部分受入時の未消化予約の扱い、確定実績への置換。予約と実績の二重控除は禁止。
3. 取消・期間変更・確定後訂正時の増減、土質/単位別の枠共有。
4. 契約枠・物理容量の定義と期間、同時予約時のAPI側排他・拒否方針。
5. 営業日・時間を予約承認で自動制御する既存APIは未接続。変更保存・履歴は接続済み。

推奨案は、日次枠を単位・土質別の承認済み未消化予約＋置換された確定数量で管理し、同一便を二度控除しない方式。これは未承認の提案であり画面独自計算を実装していない。
運送会社は既存vehicleCompanyを再利用でき、共通API追加は不要。
共通環境担当によるDGX集約・反映は未実施。現在のDGX URLにこの差分があるとは報告しない。
