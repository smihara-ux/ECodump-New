# ECO DUMP Login Design QA

- source visual truth path: `/Users/miharasoushi/.codex/generated_images/01a018db-3d69-7351-89dc-5ff9a68562d9/exec-bc96f861-f418-4f91-892d-fc062662701a.png`
- implementation screenshot path: `/private/tmp/ecodump-login-final.jpg`
- combined comparison evidence: `/private/tmp/ecodump-login-comparison.jpg`
- viewport: in-app browser, 852 × 778 CSS px (responsive tablet state)
- pixels and density: source 1672 × 941 px; implementation 852 × 778 px; deviceScaleFactor 1; source was normalized to 852 px wide in the combined comparison
- state: signed out, dark theme, empty form; light theme and validation states also inspected

## Full-view comparison evidence

The combined comparison verifies the same dark-green control-center art direction, branded map surface, lime primary action, bordered authentication card, theme control, form hierarchy, and supporting authentication actions. At the available 852 px viewport the implementation intentionally stacks the map hero above the form; at widths above 980 px the implemented grid changes to the source's left-map/right-form composition.

## Focused region evidence

The login form was inspected separately in dark and light themes. Company ID, email, and password fields now share the same full width and foreground/background contrast. The Safari intrinsic-width issue on the autofocus company field was reproduced, fixed with explicit logical sizing and an explicit text input type, then verified at 502 px for all three controls.

## Required fidelity surfaces

- Fonts and typography: Japanese system-font stack, strong title hierarchy, readable small copy, and stable wrapping verified.
- Spacing and layout rhythm: desktop two-column structure and responsive tablet/mobile stacking implemented; form controls use consistent 14 px rhythm and equal widths.
- Colors and visual tokens: deep green, muted border, white foreground, lime primary action, orange/lime route semantics, and light-theme contrast verified.
- Image quality and asset fidelity: existing ECO DUMP logo and control-map raster assets are used; no placeholder or CSS-drawn brand asset substitutes.
- Copy and content: selected mockup's title, product proposition, field labels, alternate actions, legend, and security status are present.

## Primary interactions tested

- Required-field and format validation
- Company ID, email, and password entry
- Password visibility toggle
- Login-state retention checkbox
- Successful login transition to 現場一覧
- Dark/light theme switching
- Secondary authentication action feedback
- Logout action implemented in the authenticated header

## Console check

No runtime errors were emitted after a full reload of the final implementation. A historical React dependency-array warning was present only during hot-module replacement while editing and did not recur after reload.

## Comparison history

1. P1: company ID field rendered at intrinsic width with a white background in Safari while the other fields remained full width. Fixed by adding `type="text"`, explicit physical/logical sizing, and browser-state color locks. Post-fix evidence: all fields measured 502 px and use `rgb(3, 37, 34)` in dark mode.
2. P2: browser title still named the underlying application page while signed out. Fixed by switching the title to `ECO DUMP | ログイン` until authentication succeeds.

## Findings

No actionable P0, P1, or P2 differences remain. The responsive stacking at 852 px is an intentional adaptation rather than desktop design drift.

## Follow-up polish

- P3: real identity-provider endpoints and server-side session handling remain backend integration work; the current implementation provides a complete frontend demonstration flow.

final result: passed


## 2026-09-28 — approved Deep Green Connection replacement

Source: selected `exec-b2ac97ae-70bb-43f0-bed2-d54eba948b7f.png`, reattached as `codex-clipboard-52aae7d2-4dab-437a-a1cb-7996417e222f.png`.
Implementation: `http://127.0.0.1:5203/?entry=1`. Desktop 1440×960 CSS px; mobile 390×844 CSS px. Captures at 1×. Source content cropped from the presentation board, excluding browser/device chrome; desktop normalized to1093×730, mobile390×844 for comparison. The generated board's device labels do not exactly match its content aspect ratio; match app-owned content, not its chrome.

Evidence: [desktop](docs/entry-green-2026-09-28/desktop.png), [mobile](docs/entry-green-2026-09-28/mobile.png), [desktop comparison](docs/entry-green-2026-09-28/desktop-comparison.jpg), [mobile comparison](docs/entry-green-2026-09-28/mobile-comparison.jpg).

Iteration 1 blocked: P2 mobile header 40px taller than reference pushed demo entry too low; P2 desktop form text was small and started too low. Corrected header to210px, enlarged desktop typography, aligned form start to96px. Recaptured and compared in paired images. One immediate post-resize desktop capture was stale mobile geometry and was discarded/replaced after verifying innerWidth1440/innerHeight960.

Iteration 2:
- Typography: native Japanese sans, bold two-line headline with lime emphasis. Labels18px desktop/15px mobile, inputs16px; no clipping. Exact rasterized source glyphs vary by platform, acceptable P3.
- Layout: 59/41 desktop split; compact mobile hero above full form, no horizontal overflow at390px. Added small footer guide/theme controls preserve existing functionality.
- Colors: petroleum green, lime and pale white match source; dark theme also inspected for readable fields/placeholders.
- Images: original supplied logo retained; new generated text-free forest/interchange asset matches subject, palette and focal direction. Exact road/truck geometry is intentionally regenerated (P3), not claimed to be actual tracking.
- Copy: approved headline and supporting line preserved. Login/register/demo disclosure and honest no-persistence notes remain actual accessible text, not raster UI.
- Interaction: register role selection, required text inputs and confirmation; return to login; theme toggle; mobile demo expansion and driver transition checked. No new auth/DB/email behavior.
- Controls: minimum48px primary/input/tab dimensions; visible focus outline; image decorative alt; mobile font avoids input zoom.

No remaining P0/P1/P2 visual findings. This verifies browser rendering, not physical-device or production-auth acceptance.

final result: passed
