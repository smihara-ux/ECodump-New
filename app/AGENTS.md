# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The prototype must include working, separately rendered screens for every primary sidebar item. Keep all customer, worker, user, vehicle, address, phone, and project data anonymous.

## Durable visual direction

- Preserve every existing UX flow, route, control, label, table field, modal, search/filter behavior, and responsive interaction unless the user explicitly requests a UX change.
- Keep the overall layout and information density close to the current prototype; visual changes should feel like a restrained refresh rather than a new product.
- Use the supplied ECO DUMP logo consistently. Base the visual system on deep petroleum green, white, lime accents, and amber for warnings, with high-contrast readable tables.
- Sidebar visual target selected on 2026-08-25: compact operations navigation with framed outline icons, lime section headings and a pale-lime active row. Keep route destinations and interactions unchanged while using the display groups 現場業務・運行業務・基本台帳・関係会社 and the concise item labels shown in the selected mock.
- Product direction superseded on 2026-08-26: the selected source of truth is the ECO DUMP Transport Control Tower mock (`exec-b3f5e2fd-5bf4-4a90-8f3a-459727a01085.png`). The product must look independently designed at first glance: horizontal command bar, map-and-timeline home, dark industrial control-room palette, and a function launcher instead of the Buildee-like persistent sidebar. Preserve all established destination screens and core workflows through the launcher; modest navigation changes are explicitly acceptable.
- Navigation direction superseded on 2026-08-27: desktop uses the selected persistent left operations sidebar, tablets default to its compact icon rail, and phones use the same navigation as an off-canvas drawer. Keep the ECO DUMP control-room palette and existing routes/UX intact.
- Component direction selected on 2026-08-28: use the large lime primary buttons and framed utility icon buttons from the approved field-tablet mock. Provide persistent light/dark themes, minimum 44px touch targets, and preserve the same UX across Windows, macOS, iPhone, iPad, Android, and general tablet widths.
