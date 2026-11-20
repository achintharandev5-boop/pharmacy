# Pharmacy UI visual regression report

Date: 2026-11-01.

## Screen layouts

Baseline route captures are stored in `docs/ui-modernization/baseline/`. Module screenshots and measurements are stored under `docs/ui-modernization/foundation`, `label`, `pos`, `patients`, `prescriptions`, `products`, and `inventory`. Each applicable page is captured in light and dark at 390×844, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080. Final sweep: **23 routes × 2 themes × 6 viewports = 276 screenshots**. No horizontal overflow or page runtime errors. All 23 routes emitted a 1.5-second `networkidle` timeout warning due to long-lived/local development requests; DOMContentLoaded completed and captures were produced. This is a warning, not a claimed full idle-state test.

The verifier checks horizontal overflow, resolved theme, page background, heading presence, browser runtime errors, and captures screenshots with reduced motion. API data in the local test mode is deliberately unavailable or empty; screenshots are not a representation of live patient or inventory data.

## Labels and print

- The existing print-label component source and clinical print implementation were protected by baseline SHA-256 comparison.
- 28 approved sample scenarios were rendered in each theme and compared against baseline PNGs; all 56 pixel comparisons matched exactly.
- Sample set includes the current and spec preview wordings for visual review; spec wording remains disabled and is not adopted as production behavior.
- Fonts loaded in the browser sample check: Gemunu Libre and Noto Sans Sinhala.
- Dedicated print-media check: 14 labels per theme measured exactly 70 × 50 mm (within 1 CSS px), with white backgrounds and black text in both light and dark; Gemunu Libre and Noto Sans Sinhala both resolved. Evidence screenshots and JSON are in `docs/ui-modernization/print/`. Physical printer output remains NOT VERIFIED.
- Workstation target-size measurement: 11 dosage controls at each of the six required viewports; every measured target is at least 44px. See `docs/ui-modernization/label/workstation-control-sizes.json`.
- Physical thermal printer output: NOT VERIFIED.

No label dimensions, margins, Sinhala text, dosage calculations, label fitting, barcode/QR implementation, or print/save semantics were changed.

## Limitations

The local development server produced a final hydration inconsistency: the page HTML loaded, but an account menu and the native theme selector did not respond to browser events. Component tests and earlier focused drawer checks passed. Results will clearly distinguish CSS visual screenshots from interactive verification; no failed interaction check is hidden.
