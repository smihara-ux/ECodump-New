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
