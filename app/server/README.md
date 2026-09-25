# 直接運搬の隔離検証API

起動・認証境界・マイグレーション・テスト結果は [共通API検証記録](../../docs/SHARED_API_VALIDATION_2026-09-25.md) を参照。

`setup.mjs` は専用PostgreSQLを準備し、`index.mjs` は127.0.0.1:6102でAPIを起動する。検証画面はViteの `vite.integration.config.mjs`（5202）を使用する。

`.local` はローカルデータ・認証情報。Gitに追加しない。適用済みマイグレーションはchecksumで管理するため編集しない。並行作業のworkflow/matching実装を削除しない。
