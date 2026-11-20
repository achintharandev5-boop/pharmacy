# Pharmacy UI accessibility report

Date: 2026-10-31. Checks are scoped to the rendered UI; this is not a formal WCAG certification.

## Implemented and checked

- Semantic HTML, headings, form labels and error descriptions in shared controls and migrated screens.
- Global visible `:focus-visible` treatment; keyboard-operable native inputs, selects, radios, checkboxes and switches.
- Buttons, inputs and selects use 44px standard touch sizing; workstation actions retain their existing larger task-specific sizes.
- Drawer uses native dialog semantics, focus containment, Escape close, inert background and focus restoration. Patient/product overlays use a shared focus trap and restoration behavior.
- Notification and account popovers support keyboard navigation and Escape; icon controls use accessible names.
- Data-table scroll regions have an accessible name and keyboard focus; selected navigation and selected states expose semantic attributes.
- Reduced-motion preference disables animation and smooth scrolling.
- 40 semantic foreground/background token pairs were calculated; all meet the chosen AA text/input thresholds.
- Sinhala wording was not intentionally changed. Protected clinical/library sources and label pixels are separately checked.

## Exceptions and limits

- The repository does not include axe-core or `@axe-core/playwright`; no automated axe scan was available.
- No screen-reader or physical touch-device test was available.
- The final browser pass showed that the existing local Next dev server served the screen but did not respond to React interactions (the theme select and account menu did not hydrate). Focused component tests pass; the full live interaction state remains NOT VERIFIED in that server session. Avoid treating static screenshots as proof of browser accessibility.
- Existing specialized medicine/patient search controls were preserved and tested through their domain tests; they were not replaced by a new generic ARIA combobox implementation.
- Dynamic data pages, auth, and role-denial behavior require approved backend/session fixtures and are NOT VERIFIED against live services.

## Result

Shared controls and screens have keyboard and semantic improvements, and automated contrast checks pass. Remaining end-to-end assistive-technology review is required before claiming complete WCAG 2.2 AA conformance.
