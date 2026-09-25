# 成田モデル検証の共通管理場所

更新日: 2026-09-25

## 唯一のseedとID

- 再実行可能seed: `app/server/setup.mjs`
- 固定ID: 同ファイルの `naritaIds`
- 検証アカウント: 同ファイルが生成する `app/server/.local/credentials.json`（Git管理外）
- 共通DB: ローカル隔離PostgreSQL `ecodump_direct_validation`
- 自動検証: `app/server/tests/narita-winners-scenario.test.mjs`
- 実行証跡: `docs/narita-validation/api-evidence.json`

施工・受入・ドライバーは、この共通IDを使用し、役割別の独自seedや別運行IDを作らない。

## 担当境界

- 共通API/DB: `app/server/index.mjs`、`app/server/migrations/`、`app/server/setup.mjs`
- 共通接続UI: `app/src/integration/ConnectedApp.jsx`
- ドライバー固有UI: `app/src/driver/`
- 通常プレビューの施工・受入UI: `app/src/App.jsx`、`app/src/receiving/`

## 現在のAPI契約

利用可能: 直接予約、受入確定、配車、4段階運行報告、受入実績、添付、伝票提出・差戻し・確認・訂正、入退場記録、操作ID照会、担当範囲による閲覧拒否。

未接続: 予約条件変更、予約取消、代車・代走履歴、遅延・受入不可・未着の問題報告、GPS履歴共有。一つの予約に複数便を持たせるDB変更も未実施（現行は `direct.trips.booking_id UNIQUE`）。これらを画面だけで保存成功として扱わない。

## 成田モデルIDの用途

`WINNERS建設〈検証用〉`、A/B工区、栃木/茨城の架空受入先、検証車両01〜03、青木太郎・佐藤健・鈴木一郎の固定IDは `naritaIds` を参照する。実在する成田空港工事、採石場、契約条件を示さない。
