# 受入側 DGX 更新・開発確認

2026-09-30 23:30～23:36 JST。ユーザーの残作業続行指示に基づく専用ステージング更新。本番ではない。

## 配置
- ソース b12c644（アプリ統合 7fa9a12）、固定git archiveからビルド。
- 配置先 `/home/life-id/apps/eco-dump-staging/releases/20260930-b12c644/app`。
- 入口 https://life-id.tailbe6181.ts.net:9462/?preview=app&role=receiving&page=transport
- 配置記録 https://life-id.tailbe6181.ts.net:9462/release.json
- 共通担当の反映開始が確認できなかったため、このチャットで集約反映を引き取る旨と重複禁止を連絡し実行。結果を共通担当へ通知済み。
- 32 migration checksum一致。スキーマ変更なし、bootstrap/seed再実行なし。API/Webのみ更新、DBコンテナ維持。
- 旧版との差：server runtime41ファイルのうちinformation-handler.mjsのみ相違（既存の業務側権限制限）。新APIと画面を同時配置。
- DBバックアップ `/home/life-id/apps/eco-dump-staging/backups/20260930-b12c644/ecodump.dump`。
- SHA256 `676c94ff0bb281ff69905d4b27959e8db69adccbd9e40540518aa77385993ac5`、pg_restore -lで463行の一覧読取成功。
- API health `isolated-postgresql / production:false`、DB healthy、API/Web起動確認。

## 今回の確認
|項目|判定|根拠・限界|
|---|---|---|
|最新版のDGX配置|実装・確認済み|bind mount、release.json、ヘルス、UI実測|
|受入1 日付/実績導線|実装・確認済み|栃木ログイン、2055-01-02指定→実績→便詳細→一覧→ホーム。日付維持|
|受入2 集計|実装・確認済み|A/B2便・実車1台・予定20m³、旧原票未照合9.5m³を確認済み集計に入れない|
|受入3 条件保存|実装・確認済み|既存条件同値保存→再取得→再ログイン、履歴、同じキー二重送信、結果照会、古い版409、担当外403|
|受入3 残量計算|業務仕様の決定待ち|算定条件未設定を維持。推奨日次ルールをユーザーへ提示し回答待ち。旧confirmの予約合計上限判定と複数便/部分受入との整合が必要|
|受入4 詳細/状態|実装・確認済み|到着報告・入場未確認・荷下ろし・旧数量未照合を別表示。モバイルカード、受付/原票の既存フォームを確認|
|受入4 原票写真のDGX権限|実装済み・検証未完了|DGX成田fixtureに添付なし。試験はfixture不足で1件失敗。隔離ローカルの既存合格をDGXでの合格とみなさない|
|受入5 Excel|実装済み・検証未完了|最新版の出力ボタンと画面対象を確認。ファイル内容照合は前回ローカルで実施、DGXでの再ダウンロードとExcel実機開封は未確認|
|PC/モバイル light/dark|実装・確認済み|1440×1000、390×844のスクリーンショット。1024×768も横溢れなし。実機ではない|
|再ログイン/担当範囲|実装・確認済み|栃木2行/茨城2行を場所別に分離、再ログインで同じ予約/便ID。read-relogin.json|

DGX既存の画面確認データ日付は2055-01-02。操作報告時刻は過去の試験実行時刻のまま保持しており、実運行データではない。旧数量を新しい原票確定へ勝手に書き換えていない。
栃木アカウントは narita-receiver-tochigi@sample.invalid。既存の秘密情報ファイルを再利用し、本文にはパスワードを記載しない。

## 切り戻し
DB変更なし。旧リリース `20260925-165545/app` と旧API image `ecodump-staging-api:rollback-20260930` を保持。
必要時は旧imageをecodump-staging-apiへタグ付けし、旧リリースのcompose＋既存.envでapi/webを --no-build --no-deps にて再作成する。DBは継続利用。DB復元が必要な別の障害では、API停止・新規空検証DBにバックアップをpg_restoreしてから接続先を切替。今回復元操作は実行していない。

## 境界
正式3者連携試験・実機確認は、元のユーザー指定通り画面OK後。本番認証/GPS/機器接続は未完了。GitHub Pagesは共有デモ、今回DGX更新とは別。
