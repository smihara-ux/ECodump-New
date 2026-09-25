# 共通API 接続前レビュー（受入側）

2026-09-25、未コミットの他担当変更を含む作業中スナップショット。完成報告ではない。

## 確認した既存資産

- `app/src/lib/supabase.js`：Supabase Authセッション。APIではクライアント申告の役割を信用せず認証済みユーザーを再検証する必要がある。
- `app/supabase/schema.sql`：会社・ユーザー・所属・現場・車両・ドライバー等。既存RLSは組織単位であり担当現場／受入場所の制限を追加する必要がある。
- 受入画面は画面内の試作データ。既存画面すべてがAPI接続済みと表示してはならない。

## 同時作業で追加されている接続候補

1. `app/server/workflow-api.mjs`：SQLite隔離APIと `/api/workflow` クライアント。
2. `app/server/migrations/001_core.sql`・`002_direct_transport.sql`：既存テーブルを再利用するPostgreSQL拡張。担当範囲、RLS、DB内更新関数、冪等結果、監査を含む。

これらは同一API仕様ではない。受入・施工・ドライバーがそれぞれ異なるDBを参照する構成を完成としない。共通の接続先・マイグレーション責任・認証方式を合わせてから接続検証する。

## 10:24時点の確認事項（未解消）

| 対象 | 確認が必要な点 | 完了条件 |
| --- | --- | --- |
| SQLite API | 配車・実績確定でIf-Match値を読み取るだけで現行versionと比較していない | 古いversionを各更新で409にする |
| SQLite API | 同一冪等キー・異なる本文を以前の成功として返す | 操作名・対象・本文の不一致を409にする |
| SQLite API | 担当範囲・DB側の操作権限が不足 | 同じ会社でも担当外の現場／受入場所をAPIとDBで拒否 |
| 共通パネル | 再取得失敗を内部catchした後も「DB保存後の再取得を確認」と表示する | 保存結果と再取得結果を分ける |
| 共通パネル | 結果不明の操作キーを保持せず次のクリックで新しいキーになる | 更新前に意図を保持、照会だけ行い無条件再送しない |
| 共通パネル | 実績を固定7.8m³で確定 | 実績入力、単位、差異理由、確認操作を提供 |
| PostgreSQL | トランザクション関数のnull・numeric特殊値・JSON型検証 | 必須項目欠落・null・NaNをAPIとDBで拒否 |
| PostgreSQL | 同一予約1便のUNIQUE制約 | 今回の1件検証範囲を明記し、将来の複数便拡張を別工程にする |
| PostgreSQL | 認証ロールへの直接SELECTで取引情報が過剰共有されないか | ドライバー／取引相手の取得列も検証 |
| マイグレーション | 既存PostGISスキーマと隔離非空間スキーマの差 | 隔離検証と既存全スキーマへの適用検証を区別 |

## 受入側の確認シナリオ

1. 施工ユーザーが直接予約し、受入担当が再取得する。
2. 受入担当が条件・予定数量・単位を確認し確定。同時確定は一方のみ成功。
3. 配車後、担当ドライバーのみが順番に報告。荷下ろしだけでは受入実績は未確定。
4. 受入担当が実績数量・差異理由を入力して確定。確定前／後の別状態が両社に見える。
5. 再読込、API再起動、DB再取得後も数量・状態・便IDが一致。
6. タイムアウト後に更新を再送せず、同じ操作キーの照会から保存結果を復元。
7. 所属外、担当範囲外、別ドライバー、古いversion、同じキーで違う操作を拒否。

## 参考

- [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)：所有者等のRLS迂回に注意し、非所有者接続で検証する。
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)：サーバー認証の本人確認。
- [node-postgres transactions](https://node-postgres.com/features/transactions)：トランザクションでは同一クライアントを使用する。

## このタスクで実施した検証

- `ECODUMP_RECEIVING_DB_TEST=1 node --test app/tests/receiving-direct-api.test.mjs`：1シナリオ合格。既に起動されていた隔離PostgreSQL API（6102）を使用。直接予約→受入確定→配車→4段階報告→実績確定→両社再取得を確認。同時確定、古いversion、同一キー異内容、担当外API／DB更新拒否、確定後の応答切断と処理結果照会を含む。検証で作った1件と関連行だけを終了時に削除。サーバー再起動後の検証はこのテストでは未実施。
- `node --test app/tests/receiving-mutation-journal.test.mjs`：3件合格。通信結果不明時のキー保持・再送阻止、保存領域エラー時の送信阻止、ユーザー別分離、409と503の区別。
- `npx playwright test tests/ui/receiving-actual-form.spec.mjs`（app内）：2件合格。1440pxと820pxで、数量・単位・差異理由・確認チェック・編集後の再確認・横溢れを確認。フォーム単体のブラウザ検証であり3画面の結合テストではない。

### 追加の未解消事項

PostgreSQL側は003でドライバーの予約生行参照を制限しているが、ドライバー権限のDB接続で `direct.audit.before_data` の `agreement_note` を含む行が参照できることを確認した。APIの一覧で条件合意メモを非表示にしても、監査テーブルを介した参照制限が必要。取引先共有範囲の完了判定には含められない。

### 作成した受入部品と接続状態

- `app/src/receiving/ReceivingActualForm.jsx`：数量・単位・差異理由・確認操作を含む実績確定フォーム。
- `app/src/receiving/mutationJournal.mjs`：更新前の操作ID保持と照会。自動再送機能はない。APIの結果照会レスポンスを呼び出し側で `completed` / `confirmed` へ変換する必要がある。
- 上記2部品は未接続。既存の共通パネルは他担当が変更中のため、このタスクでは上書きしていない。
- 新しい共通APIはこのタスクでは追加していない。事前準備した未使用 `services/transport-api` は、このタスクが作ったものだけを削除した。

次工程はPostgreSQL／SQLite候補の責任範囲と接続先を一本化し、監査情報の共有制限を修正してから受入部品を接続し、PC／タブレットで3役割間の再読込を含めて検証すること。本番・公開環境には反映していない。
