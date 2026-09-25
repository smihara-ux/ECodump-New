# ECO DUMP 共通運行 API 契約 v2（隔離検証環境）

更新日: 2026-09-25  
対象: 施工側・受入側・ドライバー画面  
環境区分: ローカルの隔離 PostgreSQL。DGX・本番には未反映。

## 1. 正本と関係

- `organizations` が会社、`memberships` が所属、`direct.scopes` が担当現場・受入場所を表す。
- `sites` は搬出現場・工区と受入場所の共通資産台帳。受入場所だけ `receiving_locations` / `receiving_conditions` を持つ。
- `bookings` は搬出予約、`trips` は1便。1予約は複数便を持てる。
- `vehicles` と `drivers` は別台帳。外部運送会社の資産は施工会社所属へ置き換えず、`carrier_permissions` で利用許可する。
- `trip_events` は到着・出発・受入到着・荷下ろし報告、`actuals` は受入確定数量、`attachments` / `receipt_records` は原票と確認状態を表す。
- 予定数量、便予定数量、ドライバー報告、受入確定数量は別の値であり、暗黙換算しない。`t` と `m3` は合算しない。

秘密情報を含まない固定検証 ID は `app/server/setup.mjs` の `naritaIds` が正本。認証情報はリポジトリ外の `.local/credentials.json` のみで扱う。

## 2. 状態

| 対象 | 状態 |
|---|---|
| 予約 | `requested` / `confirmed` / `change_requested` / `rejected` / `cancelled` / `partially_completed` |
| 便 | `assigned` / `site_arrived` / `in_transit` / `receiver_arrived` / `unloaded` / `cancelled` / `refused` |
| 原票 | `pending` / `returned` / `confirmed` |

条件合意、予約承認、配車、運行完了、受入数量確定は別状態。予約取消時も既存の便実績・原票を削除しない。一部実績後は `partially_completed` とする。

## 3. 共通更新規約

- `Authorization: Bearer ...` と UUID の `Idempotency-Key` が必須。
- 更新対象の `expectedVersion` が必須。便操作では便の version、予約操作では予約の version を送る。
- 同じキー・同じ内容は同じ結果を返す。同じキー・異なる内容は `409`。
- 応答不明時は自動再送せず `GET /api/direct/operations/{key}` で `applied` / `not_applied` を照会する。
- 変更系は `reason` を必須にし、`direct.audit` に変更前後・担当者・日時を記録する。
- 権限は画面の表示ではなく、RLS と SECURITY DEFINER 関数内で会社・担当資産・担当便ごとに再検証する。

主なエラー: `400` 形式不正、`401` 未認証、`403` 権限外、`409` 版競合・冪等キー競合・重複割当、`422` 業務条件不正、`503` 結果を照会すべき一時失敗。

## 4. 参照 API

- `GET /api/direct/context`: ログイン利用者、担当範囲、現場、受入場所、車両、運転手。外部所属は `external: true` と会社名を返す。
- `GET /api/direct/bookings`: 権限内予約。互換性のため現時点は1便1行で、複数便では同じ予約IDが繰り返される。画面の選択キーは `trip.id` とする。
- `GET /api/direct/bookings/{bookingId}/history`: 権限内の変更履歴。
- `GET /api/direct/receiving-conditions?date=YYYY-MM-DD`: 営業日・時間・土質・単位・日上限、予約量、受入確定量。`calculationStatus=provisional` の間は確定空き容量として表示しない。
- `GET /api/direct/receiving-conditions/{locationId}/history`: 条件変更の担当者、理由、変更前後、日時。受入担当範囲だけ取得可能。
- `GET /api/direct/driver-document-fields?bookingId=...&tripId=...`: 担当便の原票読取項目。
- `GET /api/direct/attachments/{id}`: 原票と同じ業務範囲だけ取得可能。

## 5. 更新 API

すべて `POST /api/direct/actions/{action}`。

| action | 主な入力 | 結果・制約 |
|---|---|---|
| `create` | `id, siteId, locationId, plannedAt, quantity, unit, soil, agreementNote` | 新規予約申請 |
| `confirm` | `bookingId, expectedVersion, agree` | 受入側が承認。変更承認待ちの再承認にも使用 |
| `booking_change` | `bookingId, expectedVersion, locationId, plannedAt, quantity, soil, unit, reason` | 重要条件変更後は `change_requested` |
| `booking_reply` | `bookingId, expectedVersion, decision, reason` | 受入側の `change_requested` / `rejected` |
| `booking_cancel` | `bookingId, expectedVersion, reason` | 未開始便を取消。実績済みなら `partially_completed` |
| `trip_add` | `bookingId, expectedVersion, vehicleId, driverId, plannedAt, quantity, reason` | 予約に便追加。委託許可、重複、予約数量を検証 |
| `trip_reassign` | `bookingId, tripId, expectedVersion, vehicleId, driverId, reason` | 代車・代走。旧担当の送信権限を即時失効 |
| `trip_cancel` | `bookingId, tripId, expectedVersion, reason` | 対象便だけ取消 |
| `report` | `bookingId, tripId, expectedVersion, state, reportedAt` | 現担当ドライバーが順序付き状態報告 |
| `trip_issue` | `bookingId, tripId, expectedVersion, kind, reason` | `delay/not_arrived/refused/vehicle_trouble/receiving_unavailable/assignment_mismatch/other` |
| `issue_resolve` | `bookingId, tripId, issueId, expectedVersion, reason` | 対応事項を解決 |
| `report_correct` | `bookingId, tripId, eventId, expectedVersion, reportedAt, reason` | 原報告を監査履歴へ残して訂正 |
| `actual` | `bookingId, tripId, expectedVersion, quantity, unit, differenceReason` | 荷下ろし後、受入側だけが確定 |
| `receiving_condition_update` | `locationId, expectedVersion, timezone, businessDays, opensAt, closesAt, soil, unit, dailyLimit, reason` | 受入担当範囲だけ更新。版競合は409、理由付き履歴を保持 |

原票の提出・差戻し・再提出・確認・訂正は既存 `driver-document-submit` と `receipt_*` / `attachment` を使い、必ず `tripId` と版を保持する。

## 6. 現時点の未確定事項

- 受入枠から予約・完了・取消・訂正をどう差し引くかは未確定。推奨は予約確定量と受入確定量を別指標で表示し、運用ルール承認後にだけ「空き」を確定値化すること。
- 営業日・営業時間を保存する機能は接続済みだが、予約申請・承認時の時間枠判定への接続は未確定。推奨は既存承認を自動取消せず、重要条件変更後に影響予約を再確認対象として通知すること。
- 重複判定の時間幅は現実装の近接時間ルール。現場間移動時間を含む運用ルールの承認が必要。
- `m3` と `t` の換算係数は土質・計測根拠がないため未実装。推奨は換算せず別集計を維持すること。
- GPS、ETC、OCR自動確定、プッシュ通知は未接続。手入力・原票添付・状態報告と明示し、接続済み表示にしない。
- DGXステージング更新、正式3者連携試験、実機試験、本番公開は画面確認後の別工程。
