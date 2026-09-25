# 直接運搬・3役割共通API連携

## 完成した隔離検証範囲

発生土マッチを経由しない1件の運搬について、施工側の予約作成、受入側の予約確定、施工側の配車、担当ドライバーの到着・出発・荷下ろし完了報告、受入側の実績数量確定、双方の実績再取得までを共通APIとファイルDBで接続した。

ローカル検証は匿名データ専用であり、本番Supabaseや本番データには接続しない。画面上には「隔離検証API・共通DB」と表示する。

## 認証・権限

- 隔離APIでは施工、受入、ドライバー、権限外のテストトークンを使用する。
- 施工側は自社の `site-01` からだけ予約を作成・配車できる。
- 受入側は自社の `location-01` に届いた予約だけ確定し、荷下ろし完了後だけ実績を確定できる。
- ドライバーは `driver-01` に割り当てられた便だけ状態報告できる。
- 取引当事者以外の一覧取得は0件、更新は403となる。
- 本番候補マイグレーションはブラウザからの直接更新権限を与えず、書込みを認可付きAPI/RPCに限定する。

## 更新安全性

- 全更新で `Idempotency-Key` を必須とし、同じキーの二重登録は最初の結果を返す。
- 既存レコード更新では `If-Match` に現在の `version` を必須とする。
- 古い画面からの更新は `409 VERSION_CONFLICT` で拒否する。
- 結果不明時は `GET /api/operations/:operationKey` で照会する。同じ更新の無条件再送は行わない。
- 各更新を監査ログへ追記する。

## データ

隔離DBは会社、ユーザー、役割、現場、受入場所、予約、車両、ドライバー、1便単位の運行、状態報告、受入実績、添付書類メタデータ、処理結果、監査ログを関連付ける。添付ファイル本体のアップロードとウイルス検査は今回の完成対象外。

## API

- `GET /api/workflow`
- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/assign`
- `POST /api/trips/:id/events`
- `POST /api/trips/:id/receipt/confirm`
- `GET /api/operations/:operationKey`

## 検証

- `npm run test:workflow`: API・DBの全工程、再取得、冪等性、競合、権限拒否
- `npm run test:workflow-ui`: 施工→受入→施工→ドライバー→受入→双方実績をブラウザ操作し、再読込後の永続化を確認
- `npm run test:db`: 既存スキーマのRLS・公開鍵境界

## 本番接続前の未対応

- `supabase/migrations/202609250001_direct_transport_workflow.sql` のレビューと隔離Supabaseへの適用
- Supabase Authの実ユーザーと担当範囲データへの置換
- Security Definer RPCまたはEdge APIへのローカルAPI処理の移植
- Storageバケット、添付ファイル検査、署名URL
- 通知、監視、バックアップ、障害時運用

