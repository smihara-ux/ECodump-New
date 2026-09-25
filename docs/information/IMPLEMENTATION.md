# 総合インフォメーション：棚卸し・実装・運用提案

2026-09-25。以下は実装時点の記録。DGXの最新配置・権限確認は [DGX_REVIEW_2026-09-25.md](DGX_REVIEW_2026-09-25.md) を参照。本番未更新。

## 棚卸し（実装着手前に確認した内容）

|対象|現状|今回|
|---|---|---|
|ロゴ右の総合インフォメーション|未実装の案内ダイアログ|既存枠内で共通画面へ接続|
|App.jsx の BulletinBoard|現場掲示板のサンプル表、投稿はダイアログのみ|既存画面は保持。総合画面とはデータ統合しない|
|ヘッダー通知・未確認のお知らせ|サンプル表示|メール・Push連携へ流用しない|
|ドライバーお知らせ|便や伝票の状態から表示|今回の一般記事とは分離|
|既存認証・会社所属・担当現場|共通PostgreSQLの profiles/memberships/sites/scopes|そのまま利用|
|記事DB・編集権限|該当する実装なし|追加migrationと専用grantを実装。既存担当への自動付与なし|

確認資料：`docs/receiving-sidebar-qa/README.md`、`docs/admin-restoration-qa/README.md`、`docs/narita-validation/RECEIVING_COMPLETION_V2.md`、`docs/narita-validation/DRIVER_COMPLETION.md`、`docs/ECO_DUMP_三役割構築設計書_2026-09-25.md`、`app/AGENTS.md`。過去資料の「総合インフォメーション未実装」は今回のローカル実装により更新。ただし運営体制の決定や本番導入を意味しない。

## 掲載内容・権限の提案（未確定）

|区分|掲載例（提案）|閲覧境界の実装|編集の提案|
|---|---|---|---|
|運営共通|保守、機能変更、サービス案内|有効な所属・施工/受入担当範囲を持つ利用者|別途指定する運営記事担当|
|会社内|社内連絡、業務手順|対象会社の有効な所属者|会社ごとに明示指定された記事担当|
|現場別|稼働予定、入場注意、現場連絡|対象現場/受入場所の既存担当者|対象現場ごとに明示指定された記事担当|

この分類・掲載例・カテゴリは提案。本番記事は未登録。`setup.mjs` には、運営共通、WINNERS建設の会社内・A工区、栃木モデル受入会社の会社内・受入場所という5件の架空検証記事を追加済み（既存行は上書きしない）。編集権限は `direct.info_grants` に別途明示された範囲のみ有効。初期grantは0件。施工・受入・control_admin等の既存役割から運営記事編集権限を推定しない。権限付与用の画面/APIは未作成。付与担当・承認手順の決定後、共通環境担当が管理する。

未確定：取引先にも現場情報を公開するか、カテゴリの正式名称、どの記事で確認必須にするか、確認期限と未確認者一覧、二者レビュー、緊急連絡手段。推奨は安全・手順変更のみ明示確認、通常案内は閲覧のみ。理由は確認負荷と重要記事の埋没を避けるため。通知の配信先・同意・再送方針も別途決定する。

## 確定要件として実装した範囲

- 共通の一覧・詳細・範囲/カテゴリ/本文検索、公開期間、添付（PDF/PNG/JPEG、各1MB・3件）。
- 下書き→公開設定→取下げ→編集→再公開。公開中の本文変更は不可。各版の本文・添付原本・操作者・理由・日時を保持。
- 公開開始/終了はサーバー時刻で判定。編集者は自分の下書き・期間外記事も管理可能。閲覧者は公開期間内のみ。
- 明示確認を必要とする記事は本人操作で版ごとに確認記録。詳細を開いただけでは確認済みにしない。改訂再公開は再確認対象。
- 添付URLも毎回本人の所属/担当範囲・公開期間を検証。無認証URLは作らない。
- 記事公開は通知処理を呼ばない。応答 `notification:not_sent`、メール/Pushは未接続と表示。
- バージョン競合409、キー再利用時の入力不一致409、冪等キー、結果不明の照会。画面は不明操作の自動再送をしない。
- 施工/受入で同じ共通画面・DB。ロゴ右ボタン選択状態と管理ホームへ戻る操作。既存メニューは削除しない。

## API・DB契約

既存 `Authorization: Bearer` 認証と担当範囲を使用。一般利用者からテーブル直接参照/更新不可（RLS有効、テーブル権限なし）。SECURITY DEFINER関数内で本人境界を検証。

- GET `/api/direct/information`: articles/grants/notification。見えない記事は返さない。一覧の添付はメタデータのみ。
- GET `/api/direct/information/documents/:articleId/:documentId`: 権限内の原本のみ。
- POST `/api/direct/information/actions/:action`: create/edit/publish/withdraw/ack。`Idempotency-Key` UUID必須。入力 id/version/data/reason、作成のみ scope/targetId。記事の公開範囲は編集後も固定。
- GET `/api/direct/information/operations/:key`: 本人の結果 completed/unknown。不明は再送禁止。
- 入力data: title/body/category/start/end/requiresAck/documents。時刻はISO8601。編集UIではUTCと明記、表示は利用環境の時刻。
- 成功: id/version/status/notification。401未認証、403権限、409競合、422入力/状態順序。
- migration: `app/server/migrations/20260925_information.sql`。info_articles/grants/history/ack/operations。既存migrationは変更なし。

## 開発確認

`node --test app/server/tests/information.test.mjs`: 2テスト成功。権限なしの運営投稿拒否、直接DB読取拒否、会社・現場境界、添付拒否、公開期間、下書き/公開/取下げ/訂正履歴、版ごとの確認記録、冪等キー、古い版拒否、操作照会、既存セッションHTTP接続、未認証401。

テスト編集権限・記事は同一DBトランザクション内だけに作成し、最後にROLLBACK。検証ユーザーに永続編集権限は付与していない。正式3者連携・実機・本番確認とは区別する。

ローカルURL：
- 受入 http://127.0.0.1:5203/?preview=app&role=receiving&page=information
- 施工 http://127.0.0.1:5203/?preview=app&role=construction&page=information

API6117 / Vite5203。従来5199サーバーは再起動しない。他担当の起動プロセスを維持。

ブラウザー確認：受入担当で記事一覧・詳細・確認保存・再読込後の確認済みを確認。1280px/1024px表示、ダークテーマのコントラスト修正を確認。編集者UIの実操作は権限付与担当の決定後に確認する（DB側の編集ライフサイクルは上記rollbackテストで検証済み）。ビルド成功。
