# DGX受入側：ユーザー画面確認の点検

2026-09-25。正式3者連携テスト、本番公開、外部通知は未実施。

## 配置照合（点検開始時）

DGX稼働Webのbind先：`/home/life-id/apps/eco-dump-staging/releases/20260925-162902/app`。
Web開始：2026-09-25 16:29:23 JST。APIイメージ `sha256:c7bf8507e272e8c18e431e1cacc444d180c54c615b77bd33af3b5cd03930f871`。

- src・server直下mjs・migration 計105ファイルがローカルとSHA256一致。ローカルのみのファイル0。
- 実行中APIコンテナ内のserver/migrationもローカルと一致。
- DB適用済み32件のmigration checksumも全一致。
- 根拠：deployed-source-hashes.json、running-api-hashes.txt、deployment-db-record.txt。
- バックアップ20260925-162148のSHA256は配置記録と一致。新規DBへの実復元リハーサルは未実施。今回受入修正にはDB変更なし。独自DGX更新は行わず共通環境担当へ4ファイルを集約。

|担当|点検開始版への反映|根拠・限界|
|---|---|---|
|ドライバー|反映済み|問題報告・日時訂正・履歴・配車変更のUI/APIソース一致。5202案内は担当ローカル確認時点の報告。実機試験ではない|
|総合インフォメーション|反映済み|UI/handler/migration一致。投稿/公開/取下げ/版確認の実装あり。編集grantは別管理。DGX反映待ちの報告は後の共通配置で解消|
|施工/共通|反映済み|複数便・外部所属・委託配車の追加migration適用済み。正式運用の委託管理は未決|
|受入|反映済み＋今回の表示修正を追加|原票・差戻し・数量確認の実装あり。旧2055データには原票がないため新機能の表示検証用には不足|

## 項目別点検

|項目|判定|確認内容|
|---|---|---|
|上部3ボタンと縦メニュー|OK|既存ロゴ右に3ボタン。縦のマッチ重複なし。労務安全・調整会議なし|
|栃木/茨城担当範囲|OK|DGXの両アカウントGETで自社受入場所の予約/条件のみ。所属会社名は既存contextで取得できる|
|受入会社名|修正必要→ローカル修正済み|取得済みcontextのorganization_nameを場所IDで関連付け。架空名補完なし|
|土質・単位・営業日・時間|OK|DGXで第2種建設発生土、m³、月〜土、08:00〜17:00、日別300m³検証枠を表示|
|容量・受入枠|仕様決定待ち|予約と確定実績を別指標として表示。空き未算出。未決の差引き・換算を行わない|
|予約/便詳細|OK|会社、A/B工区、日時、数量、便番号、車番、青木、条件。予約単位フィルターと便行を分離|
|予約状態|OK（共通状態の限界あり）|requested/confirmed/change_requested/cancelled/rejected。change_requestedは変更依頼と再承認待ちを共用。両者を個別状態に分けるかは共通仕様で決定|
|到着・入場・荷下ろし・退場|OK（表示/既存試験）|独立項目と手動入退場フォーム。到着報告だけでは入場確定しない。カメラ/QR/GPS未接続|
|遅延・未着・受入不可|OK（コード/既存試験）|理由・対応フォームを分離。受入不可は通常完了にしない。DGXの正式な状態更新試験は未実施|
|原票画像/差戻し/訂正履歴|修正必要（確認データ）|実装・ソースは配置済み。指定2055-01-02便には原票がなく、旧実績のみ。共通担当に表示用原票付きfixtureを依頼|
|10m³/9.5m³|OK＋表示修正|旧実績9.5と予定10は別。ただし原票照合済みではないため注記を追加|
|数量・台数集計|OK＋表示修正|未照合旧実績を確認済みへ混ぜない。単位別・区分ごと台数。明細の旧実績との違いを明記|
|読込中・空データ|OK|DGXで取得中表示、日付による空表示を確認|
|通信/権限エラー|コード・単体確認済み|エラーと再取得/操作結果照会。今回DGXで強制切断や正式競合試験は行っていない|
|検証環境ラベル|修正必要→ローカル修正済み|DGXで「ローカル」と出る文言を「検証環境」へ変更|

## 修正ファイル（既存機能/権限/集計式は維持）

1. app/src/business/BusinessSession.jsx：接続先の誤表記を修正。
2. app/src/receiving/ReceivingLocationsConnected.jsx：受入会社名を共通contextから取得。
3. app/src/receiving/ReceivingConnected.jsx：旧実績の未照合注記、集計対象の説明。
4. app/src/receiving/ReceiptEvidence.jsx：原票照合済み数量と旧実績を明確化。

受入単体11件成功、ビルド成功。追加migrationなし。画面確認用DBデータは共通担当が管理し、旧実績や他担当データを上書きしない。

## 暫定仕様と決定事項

|論点|現在の動作|未決・推奨案|
|---|---|---|
|受入可能量|日別枠を設定/保存。予約量と確定実績は別表示。空きは未算出|物理容量/処理能力/契約枠の意味と部分完了の消費を決める。予約の残量と確定量を二重控除しないルールを共通APIで定義する|
|予約自体の重要変更|change_requestedへ戻し再承認。過去実績を保持|変更依頼と再承認待ちを別状態にするか決定|
|受入場所の条件変更|条件・理由・版・履歴を保存。既存予約を一括再承認待ちにしない。営業条件の自動承認判定は未接続|影響する将来予約を再確認対象にする案。自動取消・通知は行わない|
|実績確定後の訂正|既存受入担当範囲で原票照合、理由、版と履歴を伴い訂正可能|訂正を責任者専用にするか、締め日/二者承認の要否を決める。今回新しい権限を付与していない|

## 画面URLとログイン

入口 https://life-id.tailbe6181.ts.net:9462/staging （Tailscale接続が必要）

既存画面内でDBを確認する場合は `?preview=app&role=receiving&page=transport` を開き、上部「ログインして保存を利用」からDGX用検証アカウントでログインする。ログイン前はサンプル・未保存、ログイン後は同じデザインで共通DBへ切り替わる。地図/GPS等はログイン後も未接続。

- 施工：`/?preview=app&role=construction&page=transport`
- 受入ホーム：`/?preview=app&role=receiving&page=transport`
- 受入場所：`/?preview=app&role=receiving&page=receiving-locations`
- 予約受付：`/?preview=app&role=receiving&page=receiving-reservations&date=2055-01-02`
- 原票/集計：`/?preview=app&role=receiving&page=receiving-results&date=2055-01-02`
- ドライバーDB：`/?data=isolated&role=driver`。UI試作は `/?app=driver`。
- マッチ：`/?preview=app&role=construction&page=matching` / `/?preview=app&role=receiving&page=matching`
- 総合：`/?preview=app&role=construction&page=information` / `/?preview=app&role=receiving&page=information`

ホストは上記DGX HTTPSと同じ。受入アカウントは narita-receiver-tochigi@sample.invalid / narita-receiver-ibaraki@sample.invalid。施工は narita-construction@sample.invalid、ドライバーは共通LOGIN.md記載の青木/佐藤/鈴木アカウント。パスワードはGit対象外 `app/server/.local/dgx-staging/LOGIN.md` を参照。公開資料に秘密情報を記載しない。ローカル用パスワードとは区別する。

## 修正版のDGX再確認

共通担当が `20260925-164830` へ集約。Web開始 2026-09-25 16:48:50 JST。固定アーカイブSHA256 `575e44826dfa252551a34f00d5b5a2fcf2b2b325e8a3f03a89c014488ab188ba`。再照合105ファイルはローカルと一致（OSの `._` メタデータはソース比較対象外）。今回の受入4ファイルは反映済み。

DGX再読込後に「検証環境」表記、栃木モデル受入会社名、実績集計の対象説明を実画面で確認。820×1180で条件編集フォームを開き、横溢れなし（document.scrollWidth=820）。保存操作は行わず閉じた。新たな業務レコードは作成していない。検索結果0件と取得中表示、console error 0を確認。写真付き原票画面の確認用fixtureは共通担当へ依頼中。

受入枠の表示注意：共通APIの予約量はconfirmed/change_requested予約数量、実績量は保存済みactuals（旧方式を含む）。実績帳票の「確認済み数量」は原票照合済みに限定するため、両指標が異なる場合がある。どちらも空き容量の計算には使っていない。

## 最終照合版（この記録を優先）

- リリース：`20260925-165053`
- Web配置開始：**2026-09-25 16:51:13 JST**（稼働コンテナから確認）
- 固定アーカイブSHA256：`6937d7847ccbd8adca460be178d0eb0d38371f6ad6907979f7e142e5ba529ad4`
- src/server/migration 105ファイル：修正後ローカルと全一致。final-source-hashes.jsonを更新。
- 受入4ファイルに加えドライバー最新修正も集約済み。受入のPC/タブレット証跡を取得した164830と受入対象ファイルは同一。
- DB32件は変更なし。今回は追加migrationなし。既存バックアップと復元手順の確認のみで、独自DB更新・復元は行っていない。

**ユーザー画面確認に進める範囲**：ナビゲーション、担当場所/営業条件、旧実績を含む予約・便詳細、数量区分・集計表示、マッチ、総合インフォメーションの閲覧。ログイン済みの既存画面は共通DBを参照する。

**未完了**：成田モデルの原票付き・差戻し・未完了便の画面操作用fixture。現行2055-01-02だけでは原票提出/差戻しの一連表示を確認できないため、共通担当が指定する追加fixtureを待つ。これを「正式3者連携テスト済み」「全操作の画面確認完了」とは扱わない。受入可能量の意味、条件変更による既存予約への影響、確定後の訂正承認者は仕様決定待ち。
