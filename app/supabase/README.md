# ECO DUMP Supabase接続

## 現在の状態

フロントエンドは環境変数がない場合に匿名デモデータで動きます。環境変数を設定すると、同じ画面構造のままSupabaseへ接続できる準備がされています。

## 接続手順

1. Supabaseプロジェクトを作成する。
2. SQL Editorで`schema.sql`を確認して実行する。
3. `.env.example`を`.env.local`へコピーし、Project URLとpublishable keyを設定する。
4. Authで最初の管理ユーザーを作成し、`organizations`、`profiles`、`memberships`へ管理者レコードを登録する。
5. `npm run db:check`で公開クライアントにservice role keyが混入していないことを確認する。
6. 現場・車両・運転手・運行データを匿名データから段階的に移行する。

## セキュリティ方針

- ブラウザにはpublishable keyだけを置く。
- `service_role`またはsecret keyをフロントエンドへ置かない。
- 公開スキーマの全テーブルでRLSを有効にする。
- 会社所属を`memberships`で判定し、組織をまたぐ参照を禁止する。
- 車両位置は追記中心とし、画面には組織内のレコードだけを配信する。
- 監査ログはクライアントから書き換えられない。

## 未実施

実Supabaseプロジェクトへの適用、Authユーザー作成、PostGIS実データ、Storageバケット、Edge Functions、バックアップ設定は接続先と運用責任者の決定後に行います。

