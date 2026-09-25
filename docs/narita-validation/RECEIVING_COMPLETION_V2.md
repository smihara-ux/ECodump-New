# 受入側 v2 接続・確認記録

更新: 2026-09-25。対象はローカル隔離環境。正式3者連携試験・実機・DGX・本番は本資料の対象外。

## 現状分類と差分

|分類|対象|
|---|---|
|既存を利用|承認済みサイドバー3ボタン、日付/検索/受入場所別ホーム、原票取得・差戻し・訂正、手動ゲート、操作結果照会|
|修正|予約と便の識別を分離。選択キーはtrip.id、更新・原票アップロードにはtripIdを指定。予定・原票・確定の数量を単位付きで別表示|
|追加|受入専用の共通DB予約・便一覧、予約絞込、返答/例外対応、受入条件編集、日/月・施工会社/工区/土質別の確定集計|
|DB接続・共通担当依存|受入条件履歴、例外一覧、施工会社名は共通API v2契約に従う。未返却値を架空名で補完しない|
|仕様未確定|空き容量の差引規則、物理容量/月処理能力/契約枠の区別、時間を含む配車重複判定。本画面で独断確定しない|
|未接続|GPS、カメラ、QR、OCR、ETC、実通知、所在地/入口/公開範囲の条件編集、総合インフォメーション|

旧 `RECEIVING_SCOPE.md` の「成田seed未作成」「1予約1便」は旧時点の記録。現在の正本は `COMMON_LOCATION.md`、`API_CONTRACT_V2.md`、`app/server/setup.mjs` の naritaIds。独自の受入seedは作成しない。共通SQL/APIは施工・共通担当が管理し、受入担当は上書きしない。

## 接続

- `ReceivingLocationsConnected.jsx`: GET receiving-conditions/context、receiving_condition_update。担当範囲による表示制限とサーバーによる判定。原APIの予約量/実績量を独立表示し、provisionalの空き容量は未算出。
- `ReceivingConnected.jsx`: GET bookings、confirm。返答と例外は `ReceivingExceptions.jsx`。
- `ReceivingExceptions.jsx`: booking_reply、trip_issue、issue_resolve、GET booking history。受入担当にtrip_reassign/dispatchは提供しない。
- `ReceivingEvidence.jsx` / `ReceiptEvidence.jsx`: gate_record/review、receipt_submit/return/confirm/correct、attachment。既存原票と履歴を維持。
- `resultGroups.mjs`: 明細と同じDB応答から単位別に集計。未確認/差戻しは確定数量に含めない。取消未実施便は未提出原票に含めず、親予約の取消後も確定実績は保持。

## 操作方法

1. 下記URLでヘッダーのログインから、共有の検証アカウントを使用する。ログイン前は保存しない画面案。
2. 受入場所管理: 担当場所の土質・単位・営業日・時間・日別枠を確認。変更理由を入力して保存。
3. 搬入予約・受付: 日付/予約/検索で絞り、便詳細から承認または理由付き返答。
4. 到着報告と実車照合を確認して入退場を別記録。荷下ろしはドライバー報告のまま表示する。
5. 原票画像と予定/報告の差を照合。確認または理由付き差戻し。確定後は理由付き訂正。
6. 実績・帳票で単位別・区分別集計を確認。通信結果が不明なら再送せず処理結果を照会する。

## URL

- http://127.0.0.1:5199/?preview=app&role=receiving&page=transport
- http://127.0.0.1:5199/?preview=app&role=receiving&page=receiving-locations
- http://127.0.0.1:5199/?preview=app&role=receiving&page=receiving-reservations

PC・タブレットとも同じURL。認証情報は共通担当が管理するGit管理外の `.local/credentials.json`。資料・URLには秘密情報を含めない。

## 開発確認

確認結果は以下へ追記する。旧工程の試験結果を今回の正式3者連携試験とみなさない。

- `node --test app/tests/receiving-live-model.test.mjs app/tests/receiving-results.test.mjs app/tests/receiving-summary.test.mjs app/tests/receiving-mutation-journal.test.mjs`: 11件成功。数量単位、取消、複数便、結果不明保持、未確認除外。
- `RECEIVING_TEST_API=http://127.0.0.1:6116/api/direct node --test app/server/tests/receiving-v2-read-development.test.mjs`: 1件成功。栃木/茨城の予約・条件分離、原票の他社取得404、再ログイン同じ便取得。業務データ更新を伴わない局所開発確認。
- 共有5199/6103は他担当の稼働中プロセスを上書きしない。新APIの確認用に一時ローカル6116、画面5201を起動（同じ隔離DB、別データではない）。
- 条件保存の追加開発確認: 保存・同じキーの同一結果・操作ID照会・再ログイン再取得・理由付き履歴・古い版409・他社条件更新403の確認が成功。既存条件は同値保存し、実際の営業条件を変えず版と監査履歴だけ追加。
- PC 1440×1000、タブレット1024×900のブラウザー表示を確認。条件編集/保存、履歴、予約詳細、原票画像、会社別集計を操作。2便/実車両1台、未確認9.5m³を確定0m³に含めないことを確認。
- 修正: 既存スケジュールのグリッド行CSSが共通予約表に干渉していたため、受入専用表へ限定して標準テーブル表示へ戻した。ダークテーマ内の白い数量パネルの文字コントラストも修正。
- 画像: `receiving-v2-pc.png`、`receiving-v2-tablet.png`。画面幅による確認であり、実機試験ではない。

## 残作業と依存

1. 共通担当: 営業日・営業時間の予約申請/承認判定への接続と、既存予約への条件変更の影響ルール。現時点は保存・表示のみ。推奨は自動取消せず再確認対象とし、通知の方式は別途決定。
2. 共通仕様承認: 予約・途中実績・取消・訂正を含む受入枠計算。現在は別指標のグラフで表示し、空きは未算出。年間A案は匿名の画面案に維持。
3. 台帳API: 所在地・入口・公開範囲・関連条件の更新契約、受入会社名の読取項目。今回の保存対象は土質・単位・営業日・時間・日別枠。
4. ユーザー画面確認OK後: 正式な施工/受入/ドライバーの3者運用試験、物理端末、GPS等の外部接続。DGX更新は共通環境担当のみ。

確認用の独立したローカルURL:
http://127.0.0.1:5201/?preview=app&role=receiving&page=receiving-locations
共通DBへの接続はログイン後。通常の5199とデータを分離したものではなく、同一の隔離DBを使用する。
- 最終 `npm run build --prefix app`: 成功。受入単体11件 + 受入API開発確認2件成功。正式な3者運用試験は実施していない。
