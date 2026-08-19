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

final result: passed
