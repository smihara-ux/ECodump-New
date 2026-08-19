# Design QA

## 2026-08-19 — Mobile and tablet responsive pass

- Scope: master pages plus 労務安全, 入退場管理, and 調整会議 service screens.
- Breakpoint: compact drawer/tablet layout through 1100px; desktop rail above 1100px.
- iPhone 390×844: full-width content, single-column filters and field cards, off-canvas navigation.
- Android 412×915: horizontally scrollable service tabs and data tables with readable headers.
- iPad portrait 768×1024: full-width service dashboard, drawer navigation, touch-sized actions.
- Tablet landscape 1024×768: drawer navigation prevents the fixed rail and data grid from overflowing the viewport.

**E2E evidence**

- PASS: document width equals viewport width at 390, 412, 768, and 1024 CSS pixels.
- PASS: mobile navigation opens, exposes the complete menu, navigates to 会社情報, and closes afterward.
- PASS: search input uses the full available width at 390px; field rows reflow into labeled cards.
- PASS: service navigation remains reachable by horizontal swipe and wide data tables have contained horizontal scrolling.
- PASS: `npm run build` and `npm run test:sites` passed.

final result: passed

## 2026-08-19 — Labor Safety table and document-type correction

- Issue evidence: `スクリーンショット 2026-08-19 17.40.16.png` and `17.40.25.png`; white table headings, overlapping columns, and indistinguishable document pages.
- Source truth: authenticated Greenfile pages `/greenfile/shinkianquete/list` and `/greenfile/other_forms/confirm_template/list`, captured at 1280×720 as `/tmp/source-labor-survey.png` and `/tmp/source-labor-other.png`.
- Implementation evidence: `labor-survey-fixed.png` and `labor-other-documents-fixed.png` at 1280×720; combined source/implementation evidence `/tmp/labor-survey-comparison.png`.

**Comparison history**

- P0: global master-table grid styles leaked into all `.gf-table` elements, producing white headings and overlapping fixed tracks. Fixed with scoped table/table-row-group/table-row/table-cell display rules and explicit dark header text.
- P1: 元請会社新規入場者調査票 and その他の安全書類 shared the same generic component and columns. Fixed with distinct purpose descriptions, column schemas, sections, and interactions.
- P2: narrow 操作 cells wrapped 確認 vertically. Fixed with 48px minimum action width and nowrap.
- Expected difference: source company, worker, construction, and contact data remain anonymous.

**Verified functional differences**

- 元請指定調査票: company, first-tier contractor, work content, term, last update; separate self-submission and lower-company confirmation sections.
- その他の安全書類: company, first-tier contractor, term; separate confirmation/submission and template-download tabs.

**E2E evidence**

- PASS: all nine Labor Safety pages opened with their matching heading.
- PASS: every expected header including 受付日, 会社名, 作業内容, 工期, 出力状況, and 予約日時／予約者 is present.
- PASS: all `.gf-table th` computed colors are non-white and all measured header heights are positive/non-collapsed.
- PASS: table action buttons are at least 48px wide and do not wrap.
- PASS: template tab switch and download confirmation modal work.
- PASS: browser console warnings/errors: 0; `npm run build` passed.

final result: passed

## 2026-08-19 — Common menu navigation correction

- Source: `/var/folders/zx/z6w4l3357x141fgmt90whs5h0000gn/T/TemporaryItems/NSIRD_screencaptureui_IkHSMv/スクリーンショット 2026-08-19 17.38.52.png` (486×274 px, @2x crop).
- Implementation: `common-menu-fixed.png` (1280×720 full viewport); focused comparison `/tmp/common-menu-comparison.png` normalizes both menu crops to 243×137 CSS px.
- P1 fixed: 共通メニュー was nested inside the 現場掲示板 button, combining two separate rows and their active state.
- P2 fixed after first comparison: removed a 60px gap between 帳票印刷 and 共通メニュー; both header and destination now form consecutive 40px rows.
- PASS: 共通メニュー is a non-interactive section heading; 現場掲示板 is an independent button with its own blue active rail.
- PASS: all 16 Gatekeeper/Conference menu destinations were clicked and showed the matching page heading.
- PASS: browser console warnings/errors: 0; `npm run build` passed.

final result: passed

## 2026-08-19 — Three service buttons and product screens

- Source icon truth: `/var/folders/zx/z6w4l3357x141fgmt90whs5h0000gn/T/TemporaryItems/NSIRD_screencaptureui_Tx0H85/スクリーンショット 2026-08-19 17.16.04.png` (280×108 px).
- Source product truth: authenticated Buildee captures `/tmp/gatekeeper-dashboard-source.png` and `/tmp/conference-dashboard-source.png` at 1280×720.
- Implementation evidence: `field-service-icons.png`, `gatekeeper-dashboard.png`, and `conference-dashboard.png`, all 1280×720.
- State: anonymous sample field, service dashboard default state.
- Full-view comparison: `/tmp/gatekeeper-comparison.png`, source and implementation at equal 1280×720 density.
- Focused comparison: the supplied three-icon strip is used directly at its measured display size, with three independent accessible link hit areas.

**Comparison history**

- P1: red service previously ended at a permission placeholder. Fixed after authenticated source access became available; implemented dashboard, attendance records, worker-device status, and bulletin board.
- P1: green service had no destination. Fixed by implementing all twelve source-discovered Conference menu destinations.
- P2: generated/library service glyphs did not match the supplied visual. Fixed by using the exact user-supplied raster strip instead of approximating its artwork.
- P2: service pages retained the master-page header. Fixed with product-specific 40px toolbar, yellow announcement strip, 210px feature rail, and source-matched content grid.
- Expected difference: customer names, worker names, addresses, telephone numbers, and construction records are intentionally anonymous. Layout, controls, labels, status patterns, and navigation are retained.

**E2E evidence**

- PASS: all three row icons navigate to 労務安全, 入退場管理, and 調整会議.
- PASS: all four Gatekeeper menu pages opened and showed their matching heading.
- PASS: all twelve Conference menu pages opened and showed their matching heading.
- PASS: worker face-photo toggle, worker detail modal, service search controls, and site-plan edit modal.
- PASS: existing nine Greenfile/Labor Safety destinations remain available.
- PASS: browser console contained no warnings or errors; `npm run build` passed.

**Findings**

- No remaining actionable P0/P1/P2 mismatch in the captured default service dashboards. Private production content is intentionally excluded.

final result: passed

## 2026-08-19 — Field list screenshot fidelity pass

- Source visual truth: `/var/folders/zx/z6w4l3357x141fgmt90whs5h0000gn/T/TemporaryItems/NSIRD_screencaptureui_omV6gb/スクリーンショット 2026-08-19 17.12.09.png` (3024×1964 px, macOS/Chrome frame included).
- Implementation evidence: `field-list-reference-match.png` (1280×720 px, app content only).
- Normalization: source app region cropped at y=242 to 3024×1572 and downsampled to 1280×665; implementation compared at the same 1280×665 top-region crop. CSS density treated as source @2x and implementation @1x.
- State: default 現場確認 / 現場一覧, 23 anonymous records, no modal.
- Full-view evidence: `/tmp/ecodump-field-comparison.png` placed normalized source and implementation side by side. Major regions now align: 210px sidebar, 44px header, 45px search strip, 60px action strip, 24px table header, 61px records.
- Focused evidence: header/search controls, sidebar group rhythm, field metadata, and three service icons were readable in the normalized comparison; no separate crop was necessary.

**Comparison history**

- P1: implementation search controls occupied two rows. Fixed by using one 45px flex row matching the screenshot.
- P1: a custom サービス sidebar group changed the screenshot's information architecture. Removed; service access now lives on the row icons as in the source.
- P2: table column proportions and typography were too small. Fixed column tracks, 15px controls/headers, 14px cells, and 23-row count.
- P2: field metadata and services were plain ECO text. Replaced with CCUS metadata and three colored, accessible service-icon controls using the existing icon library.
- Expected difference: source customer/company/site data and trademark artwork are intentionally not copied; anonymous fixtures and library icons preserve privacy while matching geometry, color, density, and affordance.

**Interactions tested**

- Search input, explicit search, clear, detailed-search modal, row selection, pagination visibility, and service-control presence.
- `npm run build` passed. No build/runtime error was observed during the verified field-list flow.

**Findings**

- No remaining actionable P0/P1/P2 visual mismatch after normalization. Product-specific logo artwork and real customer content remain intentionally substituted.

final result: passed

## 2026-08-19 — Greenfile / Gatekeeper deep E2E

- PASS: Greenfile reference was inspected while authenticated; private company/worker values were not transferred. The implementation uses anonymous fixtures only.
- PASS: All nine service routes were opened in the browser: document status, three safety-document flows, contractor reports, contractor search, worker search/sending education, correction replies, and batch export.
- PASS: Search drawer open/close/search, six document-category tabs, comment panel/reply, document action dialogs, and batch-export reservation were exercised.
- PASS: Dense worker-search columns and health/insurance filters remain horizontally accessible at desktop and narrow widths.
- PASS: Gatekeeper source currently returns the exact Buildee permission error. The accessible error state and both navigation actions are represented; protected dashboard contents were not invented.
- Evidence: `deep-greenfile-dashboard.jpg`, `deep-greenfile-worker-search.jpg`, `gatekeeper-permission.jpg`.
- Build: `npm run build` passed.

- Source visual truth: `../reference/buildee-fields-desktop.png`（ローカル参照のみ、Git対象外）
- Implementation screenshot: `implementation-desktop-final.png`
- Mobile implementation screenshot: `implementation-mobile-final.png`
- Full-view comparison: `../reference/design-qa-comparison.jpg`（ローカル参照のみ、Git対象外）
- Viewport: desktop 1052 × 933 CSS px; mobile 390 × 844 CSS px
- Pixel dimensions: desktop source 1052 × 933; desktop implementation 1052 × 933; mobile source 390 × 844; mobile implementation 390 × 844
- Density normalization: 1× source and implementation; no scaling required
- State: authenticated field list, sidebar expanded, detail-search modal closed

## Findings

- No actionable P0/P1/P2 differences remain.
- Typography uses the same Japanese system-font stack and comparable weights, sizes, and line heights.
- Sidebar width, header/search heights, table header, 61px table-row rhythm, borders, and spacing match the source composition.
- Core colors map to the observed dark navigation, blue actions, yellow help action, pale-gray toolbar, and white table.
- Source customer/project content was intentionally replaced with anonymous sample content. ECODUMP branding replaces the source product mark.
- Icons use a consistent open-source icon set rather than copied proprietary glyph assets.

## Comparison history

1. P1: first implementation stretched the table header vertically. Fixed by using an explicit 24px grid header and 61px grid rows. Post-fix evidence: `implementation-desktop-final.png` and the full-view comparison.
2. P2: initial viewport did not match the source. Fixed by capturing both at 1052 × 933. Post-fix evidence: full-view comparison.

## Interaction checks

- Search filters rows and updates result count.
- Clear restores the list.
- Detail-search modal opens and closes.
- Sidebar collapses to 58px on desktop and can be restored.
- Row selection and ID-copy feedback work.
- Help modal opens and closes.
- Mobile layout maintains the source's fixed sidebar and horizontally clipped dense table behavior.
- Browser console checked: no errors or warnings.

## Focused-region comparison

Focused checks covered the header/search toolbar, left navigation, table header/first rows, and pagination. These regions were readable at 1× in the full-view composite, so separate crops were not required.

## Follow-up polish

- P3: source-specific proprietary icons and trademark assets are intentionally not copied.

## Multi-page E2E expansion

- Source captures: `../reference/company-info.jpg`, `users-list.jpg`, `workers-list.jpg`, `vehicles-list.jpg`, `agents-list.jpg`, `agency-requests.jpg`, and `principal-list.jpg` (local-only, excluded from Git).
- Combined all-page comparison: `../reference/all-pages-qa.jpg` (local-only, excluded from Git).
- Implementation evidence: `e2e-0-現場一覧.jpg` through `e2e-8-自社の代行元一覧.jpg`.
- Mobile evidence: `e2e-all-pages-mobile.jpg`, 390 × 844 CSS px at 1×.

All nine primary sidebar destinations were opened through the rendered navigation on desktop and mobile. Page headings, active navigation state, page-specific tables/forms, empty states, and pagination rendered successfully.

Additional interaction checks passed:

- Company-information tabs.
- User search and result-count update.
- Page-specific detailed-search modal.
- Vehicle/machinery category tabs.
- Agency-registration confirmation modal.
- Detail/confirmation modal close behavior.

Browser console was rechecked after fixing duplicate table-header keys: no errors or warnings.

Intentional differences: all identifying source data and source trademarks are replaced by anonymous ECODUMP content; irreversible or external write actions are represented as safe local confirmation flows.

final result: passed

## Deep interaction pass

- Company tabs now have separate content models rather than a shared placeholder:
  - Headquarters: editable company fields and save state.
  - CCUS: basic IDs, linked-user table, administrator table, and edit/add dialogs.
  - Labor safety: representative, construction-license, health/pension/employment insurance, workers-compensation, retirement mutual-aid, and foreign-worker sections.
  - Branches: permission-dependent empty state and administrator-application dialog.
- User management now supports draft filters, explicit search execution, branch/type selection, reset, a validated new-user form, local registration, detail view, CSV feedback, administrator application, and password-reset workflow dialog.
- Evidence: `deep-company-ccus.jpg` and `deep-user-create.jpg`.
- E2E checks: company edit/save, all four company tabs, CCUS edit dialog, labor-safety edit/save, branch application, user creation/validation/registration, search result update, and CSV action all passed.
- Fresh-browser console check: no errors or warnings.

final result: passed
# 2026-08-19 — 共通メニュー概要ページ

- 「共通メニュー」を区分見出しだけでなく、クリック可能な独立ページとして追加。
- 共通メニュー内に「現場掲示板」カードを設置し、掲示板ページへ遷移可能にした。
- 労務安全・入退場管理・調整会議の3サービスで同じ導線を実装。
- E2E: 3サービスすべてで「共通メニュー → 現場掲示板」の表示・遷移を確認。
- ブラウザの console warning / error: 0件。
- `npm run build`: 成功。

final result: passed
# 2026-08-19 — 全画面再監査・公開確認

- 基本ナビゲーション9ページ、会社情報4タブを実ブラウザで確認。
- 労務安全11ページ、入退場管理5ページ、調整会議13ページを全件表示確認。
- ユーザー／作業員氏名検索が装飾要素内の氏名を検索できない問題を修正。
- 修正後、「サンプルユーザー 1」の検索結果が1件になることを確認。
- 可視文字の意図しないクリッピング: 0件。console warning / error: 0件。
- GitHub Pages公開URLでトップ、3サービス、共通メニューの操作を確認。
- `npm run build`、`npm run test:sites`（4件）: 成功。

final result: passed
