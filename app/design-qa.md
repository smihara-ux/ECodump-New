# Design QA

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
