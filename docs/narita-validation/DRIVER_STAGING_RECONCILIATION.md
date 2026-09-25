# ドライバー最新版とDGX配置版の照合

確認日：2026-09-25（日本時間）。担当範囲：ドライバーUIと接続部分。正式3者試験・実機試験・本番公開は未実施。

## 配置版の実確認
- Web実マウント：`/home/life-id/apps/eco-dump-staging/releases/20260925-162902/app/dist/client`。配置版名は2026-09-25 16:29:02 JST。
- APIコンテナ作成日時：2026-09-25 16:27:51 JST。Composeラベルは`20260925-162736`。リリース名はWebと違うが、実行中API本体・各handler・32 migrationの計36ファイルはローカルとSHA256一致。
- 修正前のdriver/integration/配置migration/index計51ファイルもSHA256一致。「5202だけにありDGXにない」という状態ではなかった。
- 実DB `public.schema_migrations` の32件を読み取り、全件のチェックサムがローカル追加migrationと一致。今回のdriver修正にはDB変更なし。
- `/api/direct/health` は `isolated-postgresql`, `production:false`。DGXログイン、割当・報告履歴・受入確定数量の取得を確認。
- 証跡：`driver-staging-source-comparison.json`。初期照合と、その後のローカル修正を別項目として記録。
- 共通資料の旧「1予約1運行」「外部運送会社未対応」「15migration」、deploy READMEの旧1504配置先は過去時点の記述。共通環境担当へ現状との不整合修正を依頼した。

## 機能別判定
|項目|判定|根拠・境界|
|---|---|---|
|本人・所属会社・車番・便番号・行先・時刻|OK|DGXで青木/モデル運送/車両01、栃木・茨城の3便を取得・表示|
|次の便・完了便・未処理|OK（DGX fixture追加待ち）|localの未着手便/伝票確認待ちを確認。DGX既存2055-01-02の青木3便は全て実績確定済み|
|配車変更の差分表示・旧担当の送信拒否|修正必要→local修正済み、DGX集約待ち|未確認差分が再読み込みで消える問題を修正。APIの旧担当・旧版拒否は既存開発試験PASS。サーバーの確認記録は追加していない|
|現場到着・出発・受入到着・荷下ろし|OK|4段階表示と入場/退場/受入確定の分離。localで次ボタン、DGXで保存済み4報告を確認|
|問題報告・対応状況|OK（DGX送信は今回未試験）|source/API/migration一致。local保存済み担当確認と対応待ちを再取得。DGX確定便では追加送信を無効化|
|報告日時訂正と履歴|OK（確定前）|時刻・理由・変更履歴の既存実装一致。前回local開発試験で保存と投影を検証|
|状態巻戻し・実績確定後の訂正|仕様決定待ち|現行は操作不可。管理者承認制と実績への影響確認を推奨。権限を独断拡張しない|
|写真+手入力・下書き・差戻し・再提出|OK（DGX操作用fixture待ち）|既存atomic提出APIと原票保護、ユーザー/便別IndexedDB。前回local開発試験PASS。DGX既存確定便は提出不可|
|予定/伝票/受入確定数量|OK|自動換算なし、予定10と確定9.5を分離、未確定は数値を補わない|
|履歴・お知らせ|OK|DGX本人3便の履歴・実績通知、local対応待ち・下書き導線。Push未接続を明示|
|二重送信・古い版・結果不明照会|OK（開発試験根拠）|API/DB同一、前回local試験PASS。今回DGXで通信障害や二重更新は起こしていない|
|保存先の表示|修正必要→local修正済み、DGX集約待ち|DGXでも「ローカル」と出る文言を「接続先の隔離PostgreSQL」へ変更|
|スマホ/iPhone枠|OK|DGX390×844、本文幅346=scroll幅、下部ボタン高さ59px。local320×740で本文276=scroll幅、入力/ボタンはみ出しなし|
|GPS共有/OCR/ETC/Push/HEIC|未接続|GPSは許可時の端末内表示のみ。原票JPEG/PNG 2MB以下、HEIC変換なし。未接続を成功表示しない|

## 今回の修正と引き継ぎ
1. `app/src/integration/ConnectedApp.jsx`：配車変更の基準を最後に確認した内容に保持し、ユーザー別localStorageへ保存。明示確認まで報告/伝票提出を停止。保存不可時は確認完了にしない。保存先の誤解を招く文言を修正。
2. `app/src/driver/connectedModel.mjs`：未確認の差分を再取得・再読み込み後も再構築する処理。
3. `app/tests/driver-connected-model.test.mjs`：未確認保持、確認後解除、担当外除外の回帰試験。

共通環境担当「ECO DUMP New1施工側」に上記3ファイルとhash、検証結果を送付。独自のDGX書込み、コンテナ再起動、DB migration適用は行っていない。現時点の修正版はlocalにあり、DGX反映完了は共通担当の固定版配置後に再照合する。

## 開発確認
- 今回：Node単体試験4件PASS、`npm run build` PASS、`git diff --check` PASS。
- 今回：DGX検証アカウントログイン、2055-01-02の割当/詳細/履歴/お知らせをread-only確認。390px iPhone枠の画像 `driver-dgx-iphone-review.png`。
- 今回：local再読み込み後の本人割当、未着手便の4段階操作/問題対応待ち/伝票入力、320pxと390px幅を確認。
- 前回のlocal隔離API開発試験結果は `DRIVER_COMPLETION.md` と `driver-v2-development-evidence.json`。今回のDGX正式試験結果と混同しない。
- DGXは既存の3便を巻戻さない。新規報告・差戻し確認向けの別fixture便を共通担当へ依頼済み。配置コードが同じでも、localとDGXのDB・写真・端末下書きは別物。

## 確認URL・ログイン
- DGX実API/DB：[ドライバー・検証日付付き](https://life-id.tailbe6181.ts.net:9462/?data=isolated&role=driver&date=2055-01-02)
- local実API/DB：[ドライバー修正版](http://127.0.0.1:5202/?data=isolated&role=driver&date=2026-09-25)
- DGX既存画面試作：[UIプレビュー](https://life-id.tailbe6181.ts.net:9462/?app=driver)（実保存確認には使わない）
- 共通入口：[ステージング](https://life-id.tailbe6181.ts.net:9462/staging)

DGXはTailscale接続が必要。青木の検証アカウント名は`narita-driver-aoki`、画面内氏名は青木太郎〈架空〉。認証情報は非公開の`app/server/.local/dgx-staging/LOGIN.md`から確認する。localの認証情報と混同しない。公開資料にパスワードを記載しない。

DGX日付は2055-01-02、local日付は2026-09-25。未来日付は固定検証fixtureであり、実運行予定ではない。日付付きURLを使うと初期表示の空一覧を避けられる。

## 次工程と残課題
- 優先1：共通環境担当による今回3ファイルの固定版集約・配置、および未着手/差戻し便の準備。反映後にdriver hash/UIを再確認する。
- 優先1：共通担当が全5画面URL、配置時刻/版、バックアップと復元手順を一本化。driver単独で全担当の完了は宣言しない。
- 優先2：確定後訂正/状態巻戻し権限、退任後の過去担当履歴閲覧範囲は仕様決定。現在APIの担当範囲を拡大しない。
- 画面OK後：正式3者試験、iPhone Safari撮影・ロック・GPS・圏外復帰。現段階のブラウザ確認は実機試験ではない。
