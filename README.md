# ECO DUMP

施工側・受入側・ドライバーをつなぐ、発生土の予約・配車・運行・伝票管理アプリです。

**最新の実装整理：[全画面・共通基盤の実装状況（2026-09-25）](docs/IMPLEMENTATION_INDEX.md)**

## 画面と実装

| 画面 | 主な機能 | ソース |
| --- | --- | --- |
| 施工側 | 搬出管理、予約、配車、運行、現場・車両、実績 | [共通画面](app/src/App.jsx)・[業務API接続](app/src/business/) |
| 受入側 | 受入管理、予約受付、場所・条件、入退場、原票・数量確定 | [受入画面](app/src/receiving/) |
| ドライバー | 本人便、運行報告、伝票提出・差戻し、通知 | [Mobile UI](app/src/driver/)・[API接続UI](app/src/integration/) |
| 発生土マッチ | 案件検索、相談、条件提示・合意、予約への引継ぎ | [マッチング](app/src/matching/) |
| 総合インフォメーション | 運営管理専用。業務側ボタン無効・API拒否 | [保持している実装](app/src/information/) |

## 確認環境

- [GitHub Pagesデモ](https://smihara-ux.github.io/ECodump-New/)：匿名サンプルの静的画面。共有API・DBは稼働しません。
- ローカル／DGXステージング：隔離PostgreSQLと共通APIによる検証環境。正式認証・本番運用とは別です。
- 成田空港をモチーフとする検証データは架空の案件・人物・受入場所です。実際の契約を示しません。

## ローカル起動

```bash
cd app
npm ci
npm run dev
```

施工：`/?preview=app&role=construction&page=transport`、受入：`/?preview=app&role=receiving&page=transport`、ドライバーのサンプル：`/?app=driver`。

共通APIの準備は[共通API検証記録](docs/SHARED_API_VALIDATION_2026-09-25.md)と[サーバー案内](app/server/README.md)を参照してください。API接続ドライバーは `/?data=isolated&role=driver`。認証情報・ローカルDBはGitに含めません。

## 検証と配置

```bash
cd app
npm run build
npm run test:sites
npm run db:check
```

`main`へのpushで[GitHub Pages workflow](.github/workflows/pages.yml)が静的デモを更新します。DGXは別の配置工程です。[DGXステージング手順](app/deploy/staging/README.md)を参照してください。

画面確認・実機確認・正式3者試験・外部連携・本番公開の完了は、それぞれ分けて管理します。
