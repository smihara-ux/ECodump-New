# 受入側・完了判定と統合引継ぎ

確認日：2026-09-30。担当内の開発確認であり、ユーザー承認・DGX反映・本番認証完成・実機検証を意味しない。

|項目ID|既存機能|今回の変更|判定|根拠|確認URL|残課題|
|---|---|---|---|---|---|---|
|受入1|日付入力、ホーム、実績、場所絞込|共通の前日/今日/翌日/カレンダー、実績入口、日付/場所/検索/位置保持|実装・確認済み|共有デモ翌日/ヤードB引継ぎ、API9/25引継ぎ、戻り位置732.5px一致|[ホーム](http://127.0.0.1:5204/?preview=app&role=receiving&page=transport)|公開版での同じ操作は統合担当の公開後確認|
|受入2|現場別集計、原票照合状態|有効予定・未到着・待機・受入中・完了・取消・未確認伝票、残予定量を分離|実装・確認済み|取消を除外する集計試験。画面では予定20、原票確認待ち9.5、確定0m³。件数から既存便パネルを表示|[ホーム](http://127.0.0.1:5204/?preview=app&role=receiving&page=transport)|残予定量は空き容量ではない|
|受入3a|日次条件の取得/変更/履歴|算定条件未設定、枠の種類と未決点、設定入口|実装・確認済み|既存条件の同値保存→再取得→再ログイン、履歴・冪等・409・担当外403の開発試験|[条件](http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-locations)|営業時間による自動承認制御は未接続|
|受入3b|予約量/確定量の独立表示|残量を推測せず算定停止|業務仕様の決定待ち|日次枠の消化時点、部分受入、取消、訂正、同時予約、契約枠/物理容量が未確定|[条件](http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-locations)|受入可能残量・新規予約可能量のAPI計算は未実装。推奨案はREPORT.md|
|受入4|受付・入退場・原票・数量確定、担当範囲|到着順の便表/モバイルカード、会社/車番/運転手/時刻/数量/伝票状態|実装・確認済み|既存vehicleCompany使用。10m³/原票9.5m³/未確定、原本画像・同じ便IDの詳細を確認。隔離DBで原票/入退場/権限試験|[受付](http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-reservations)|実GPS未接続。実機試験は未実施|
|受入5|試作CSV、確定実績集計|共通writerの実体XLSX、集計/便別明細、期間・場所・搬出元フィルター|実装・確認済み|ブラウザ保存したデモ1行/API2行を読み直し、数量・単位・未確定と一致。訂正/取消のExcel試験。CSV維持|[実績](http://127.0.0.1:5204/?preview=app&role=receiving&page=receiving-results)|Microsoft Excel実機開封未確認|
|共有公開|既存GitHub Pages入口とデモ|統合担当へ受入差分を引継ぎ|実装済み・検証未完了|この担当は公開処理を実行していない|[既存Pages](https://smihara-ux.github.io/ECodump-New/)|統合担当が3画面照合→origin/main→Pages公開→入口/ログイン/デモ3役割/入口復帰を確認|

## 画面とAPI確認を分離
- **共有デモ**：DB保存なし。翌日の日付・場所引継ぎ、1便のExcelダウンロードを確認。
- **実API画面**：栃木担当 narita-receiver-tochigi@sample.invalid、2026-09-25。A/B工区2便・車両1台。入力/原票/受付は共通APIの同じ予約・便を参照。パスワード非掲載。
- **表示**：PCライト home.jpg、PCダーク pc-dark.jpg、モバイル390pxライト mobile-light.jpg、ダーク mobile-dark.jpg。タブレット1024px results-tablet.jpg。モバイルはブラウザの幅変更による確認で、実機ではない。
- **保存/拒否**：隔離PostgreSQLのみ。原票差戻し・再提出・数量確定・訂正・再取得、重複、競合、結果不明の照会、他社予約/原票/APIとRLS拒否を確認。成田の画面確認用便の数量は変更していない。
- **テスト**：受入ロジック18件、条件/読取/再ログイン2件、原票/入退場/競合/権限6件成功。XLSXは拡張子だけの変更ではなくZIP形式の実体ファイルを再読込。
- **正式試験**：3者通しの受入試験、実機、本番認証、DGX配置は今回未実施。

## 同一データ契約
実APIは施工・受入・ドライバー共通の /api/direct/bookings と既存IDを使用。booking.idは予約、trip.idは便。便指定日時の日本日付を使う。
予定=trip.plannedQuantity、報告=receiptRecord.quantity、確定=原票confirmedかつactual.quantity。m³/tは別集計。ドライバー到着、受付の確認済み入場、荷下ろし報告、受入確定は別状態。
共有デモのID・操作結果をAPIの成功証拠として扱わない。

## 統合対象
受入担当の限定コミット：この文書と同じコミット（SHAは統合担当へのメッセージに記載）。
- app/src/receiving/{DateControls.jsx,TripList.jsx,viewState.js,HomeDrilldown.jsx,ReceivingConnected.jsx,ReceivingLocationsConnected.jsx,ReceivingWorkspace.jsx,liveModel.mjs,receiving.css,receivingSummary.mjs}
- app/src/reports/transportReport.mjs
- app/tests/receiving-report.test.mjs
- app/server/tests/receiving-evidence.test.mjs（試験URLとfixture保存先の環境変数対応）
- docs/receiving-1-5-2026-09-30/ と docs/receiving-evidence-qa/receiving-1-5-development-fixture.json

**共通依存（この担当ではコミットしない）**
- app/src/reports/exportWorkbook.mjs、xlsx依存/package-lock：施工担当管理。
- App.jsx：ReceivingConnectedに navigate={navigate} を渡す1行を共通App変更に含める。
- app/AGENTS.md：末尾Receiving 1–5 refinementの1行。
- app/tests/ui/receiving.spec.mjs：他担当による翌日ボタンの期待値変更を含めない。
他担当のステージ済み内容を取り込まず限定コミットする。統合担当の完了報告があるまではPages共有完了としない。
