# PHARMACY LABEL SAAS — COMPLETE SYSTEM UI/UX MODERNIZATION
## MASTER CODEX IMPLEMENTATION PROMPT — LIGHT + DARK DESIGN SYSTEM

### YOUR ROLE

Act as a Principal Product Designer, Senior UI/UX Architect, Design Systems Engineer, Senior Next.js/React Developer, Accessibility Specialist, and Software QA Lead.

Your assignment is to redesign the **entire Pharmacy Label SaaS application** into a premium, modern, enterprise-grade pharmacy management platform.

The goal is a consistent, polished interface inspired by the three supplied visual references, while maintaining the speed, reliability, clinical accuracy, and usability required in a real pharmacy.

**This is a UI/UX modernization project, not a business-logic rewrite.**

Implement the redesign in carefully controlled phases. Do not merely produce a design proposal: inspect the existing repository, create the design system, implement the UI, test it, and document the results.

---

# 1. PROJECT CONTEXT

Project location:

`C:\Users\Achintha\Documents\Pharmacy-label-sass\pharmacy-label`

Existing technology includes:

- Next.js and React.
- TypeScript.
- Existing application styling and component architecture.
- NestJS backend.
- PostgreSQL/Supabase.
- Pharmacy-specific printing workflows.
- Role-based access controls.

Inspect the actual repository to verify framework versions, dependencies, routing, design tokens, component libraries, and module structure before making changes.

Do not assume the current architecture matches older audit reports.

### Review existing documentation

Read the available relevant reports, including:

- `PHARMACY_MASTER_FEATURE_COMPLETION_PLAN.md`
- `PHARMACY_FEATURE_DEVELOPMENT_PROGRESS.md`
- `PHARMACY_MODULE_IMPLEMENTATION_REPORT.md`
- `PHARMACY_FULL_SYSTEM_INTEGRATION_REPORT.md`
- `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md`
- `PHARMACY_ADMIN_SETTINGS_COMPLETION_REPORT.md`
- `PHARMACY_POS_MILESTONE_1_5_REPORT.md`
- `PHARMACY_POS_REMAINING_WORK.md`

Read the latest relevant reports and inspect source code when documentation disagrees with implementation.

---

# 2. DESIGN REFERENCES

Use the three user-provided screenshots as visual inspiration.

## Reference 1 — Premium Dark SaaS

Extract these characteristics:

- Deep charcoal backgrounds.
- Elegant layered cards.
- Subtle illuminated borders.
- Refined controls.
- High-quality typography.
- Soft depth and shadow.
- Carefully restrained accent colors.

Do not copy the financial dashboard's charts or content into unrelated pharmacy pages.

## Reference 2 — Modern Light SaaS

Extract:

- Clean off-white surfaces.
- Soft neutral backgrounds.
- Spacious layouts.
- Rounded cards.
- Minimal visual clutter.
- Clear navigation.
- Strong information hierarchy.
- Subtle pastel surfaces only where useful.

## Reference 3 — Premium Dark Analytics

Extract:

- Minimal black and graphite styling.
- Compact navigation.
- Well-structured dashboards.
- Modern data visualization.
- Clear metrics.
- Consistent card spacing.
- Polished interactive states.

## Final visual identity

Combine the references into one unified design language:

**Modern Minimal Enterprise SaaS**

Characteristics:

- Premium.
- Clean.
- Professional.
- Neutral.
- Accessible.
- Touchscreen-friendly.
- Consistent.
- Fast.
- Suitable for clinical operations.

Do not use excessive gradients, glassmorphism, neon effects, decorative charts, or animations that slow down pharmacy workflows.

---

# 3. SELECTED DESIGN DECISIONS

These decisions are final for this redesign.

### Theme

Support:

1. Light.
2. Dark.
3. System.

Both light and dark themes must be first-class designs.

Do not implement dark mode by simply inverting colors.

### Accent palette

Use a neutral black/graphite visual identity with restrained blue accents.

Avoid introducing purple, orange, green, or other colors as competing brand colors.

Semantic colors may still be used where they convey meaning:

- Green: success.
- Red: destructive action or error.
- Amber: warning.
- Blue: primary action and information.

### Navigation

Use a hybrid layout:

- Sidebar navigation for dashboard and administrative modules.
- Full-screen, task-focused layout for Label Workstation.
- Full-screen, task-focused layout for POS.
- Responsive mobile navigation.

### Scope

Redesign every existing application module.

Do not leave old-style pages mixed with new-style pages.

Do not invent new business functionality simply to make a page appear complete.

---

# 4. PHASE 0 — BASELINE AUDIT AND REPOSITORY SAFETY

Before modifying files:

1. Inspect Git status and current branch.
2. Identify uncommitted changes.
3. Identify concurrent Codex/Claude sessions.
4. Inspect application routes.
5. Identify all pages and layouts.
6. Identify shared UI components.
7. Identify existing design tokens.
8. Identify hardcoded colors and spacing.
9. Inspect theme support.
10. Inspect responsiveness.
11. Inspect accessibility.
12. Identify printing-related styles.
13. Identify the current automated test baseline.
14. Record current screenshots for major pages.

Create:

`PHARMACY_UI_MODERNIZATION_BASELINE.md`

Include a complete route inventory with each route's:

- Module.
- Existing layout.
- Current theme behavior.
- Shared components.
- UI inconsistencies.
- Accessibility concerns.
- Regression risks.
- Planned redesign phase.

### Critical safety requirements

Do not overwrite another development session's changes.

Do not reset the working tree.

Do not commit or push automatically.

Do not deploy.

Do not modify remote databases.

Do not change migrations.

If another agent is editing the same component, stop that file's work and report the conflict.

Preserve existing functionality.

---

# 5. DESIGN SYSTEM FOUNDATION

Build a centralized, reusable design system.

Prefer the existing styling framework and component library.

Do not introduce a second competing component library unless technically justified.

Use semantic design tokens rather than hardcoded colors scattered throughout the codebase.

## 5.1 Light Theme Tokens

Use these values as the initial design direction, adjusting contrast where required.

| Token | Value |
|---|---|
| Background | `#F7F8FA` |
| Surface | `#FFFFFF` |
| Surface secondary | `#F1F3F6` |
| Elevated surface | `#FFFFFF` |
| Primary text | `#17191F` |
| Secondary text | `#626875` |
| Muted text | `#78808E` |
| Border | `#E3E6EC` |
| Strong border | `#CDD3DE` |
| Primary accent | `#2563EB` |
| Primary hover | `#1D4ED8` |
| Primary subtle | `#EFF6FF` |
| Success | `#07865B` |
| Warning | `#B96A08` |
| Danger | `#DC2626` |

## 5.2 Dark Theme Tokens

| Token | Value |
|---|---|
| Background | `#0D0F14` |
| Surface | `#171A21` |
| Surface secondary | `#20242D` |
| Elevated surface | `#252A34` |
| Primary text | `#F5F7FA` |
| Secondary text | `#B1B8C5` |
| Muted text | `#8B95A5` |
| Border | `#343A46` |
| Strong border | `#4A5363` |
| Primary accent | `#60A5FA` |
| Primary hover | `#93C5FD` |
| Primary subtle | `#172B49` |
| Success | `#34D399` |
| Warning | `#FBBF24` |
| Danger | `#FB7185` |

These are starting palette values, not permission to ignore accessibility contrast.

Ensure semantic color combinations meet WCAG requirements.

## 5.3 Semantic Tokens

Create reusable tokens for:

- Page background.
- Card background.
- Elevated surface.
- Primary text.
- Secondary text.
- Disabled text.
- Input background.
- Input border.
- Hover background.
- Selected background.
- Focus ring.
- Error background.
- Success background.
- Warning background.
- Sidebar background.
- Navigation active state.
- Table row hover.
- Modal backdrop.
- Tooltip background.
- Chart colors.
- Scrollbars.

All components must consume semantic tokens.

Avoid direct light/dark conditionals throughout individual components when CSS variables can handle them.

## 5.4 Typography

Use a consistent modern sans-serif family already available in the project, or adopt an appropriate locally supported family.

Suggested typography:

- Page title: 28–32 px.
- Section heading: 20–24 px.
- Card heading: 16–18 px.
- Body: 14–16 px.
- Form labels: 13–14 px.
- Supporting text: 12–14 px.
- Important workstation quantities: 28–40 px.

Use consistent weights and line heights.

Maintain proper rendering for Sinhala text.

Do not change Sinhala clinical strings.

## 5.5 Spacing

Use a consistent spacing scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48`

Use it for:

- Card padding.
- Grid gaps.
- Section spacing.
- Form spacing.
- Navigation spacing.
- Modal spacing.

Avoid arbitrary spacing values without a documented reason.

## 5.6 Borders and Radius

Suggested:

- Inputs: 10–12 px.
- Buttons: 10–12 px.
- Cards: 14–16 px.
- Dialogs: 18–20 px.
- Badges: 6–8 px.

Use subtle borders.

Avoid thick outlines except for focus, selection, warning, and destructive states.

## 5.7 Shadows

Use a restrained elevation scale.

Light mode:

- Soft card shadow.
- Elevated dropdown shadow.
- Modal shadow.

Dark mode:

- Prefer surface contrast and borders.
- Avoid excessive glow.

---

# 6. REUSABLE COMPONENT LIBRARY

Create or standardize reusable components for the entire application.

## Core components

- AppButton.
- IconButton.
- TextInput.
- SearchInput.
- NumberInput.
- Select.
- Combobox.
- Checkbox.
- RadioGroup.
- ToggleSwitch.
- DatePicker.
- TimePicker.
- Textarea.
- FormField.
- FormSection.
- Card.
- MetricCard.
- StatusBadge.
- Alert.
- Toast.
- Tooltip.
- Dialog.
- ConfirmationDialog.
- Drawer.
- Tabs.
- Table.
- DataTable.
- Pagination.
- EmptyState.
- LoadingSkeleton.
- ErrorState.
- PageHeader.
- SectionHeader.
- Breadcrumbs.
- SearchToolbar.
- FilterBar.
- ThemeSwitcher.

Reuse and improve existing components before creating duplicates.

## Component variants

Buttons:

- Primary.
- Secondary.
- Outline.
- Ghost.
- Destructive.
- Success.
- Icon-only.

Sizes:

- Small.
- Medium.
- Large.
- Touch.

States:

- Default.
- Hover.
- Focus.
- Active.
- Selected.
- Disabled.
- Loading.
- Error.

Every component must work in both themes.

## Touch controls

For workstation and POS:

- Target at least 44 × 44 px.
- Prefer 56–64 px for high-frequency actions.
- Provide adequate spacing.
- Support keyboard access.
- Provide accessible names for icon-only controls.

Do not make essential controls dependent on hover.

---

# 7. THEME ENGINE

Implement a reliable three-mode theme system.

### Modes

- Light.
- Dark.
- System.

### Requirements

1. Theme selection available in the application header or user menu.
2. Persist preference locally or through an existing approved user-preferences mechanism.
3. System mode follows operating-system preference.
4. Theme changes apply immediately.
5. Avoid hydration mismatches.
6. Avoid a visible flash of the wrong theme.
7. Support theme-aware charts.
8. Support theme-aware modals and dropdowns.
9. Support theme-aware loading states.
10. Preserve correct printing behavior.

Do not add a database migration solely to store theme preferences.

### Print protection

Printed pharmacy labels must never inherit dark theme colors.

Use dedicated print styles that preserve the existing approved label output.

Dark mode must not change:

- Label background.
- Printed text color.
- Print dimensions.
- Margins.
- Font sizing.
- Sinhala text rendering.
- Barcode or QR output where present.

---

# 8. APPLICATION NAVIGATION ARCHITECTURE

## Admin and Management Layout

Create a modern sidebar with:

- Dashboard.
- Label Workstation.
- POS.
- Patients.
- Prescriptions.
- Products.
- Inventory.
- Reports.
- Admin.

Show only routes permitted by the user's role.

Do not expose inaccessible navigation to cashiers.

Do not rely on hidden links for authorization.

### Sidebar behavior

Desktop:

- Expanded state.
- Collapsed icon-only state.
- Active route indicator.
- Tooltips when collapsed.

Tablet:

- Compact navigation.
- Collapsible drawer.

Mobile:

- Accessible navigation drawer.

### Topbar

Include:

- Page title.
- Breadcrumbs where useful.
- Search where relevant.
- Theme selector.
- User menu.
- Logout.

Do not clutter the topbar with unnecessary controls.

## Workstation Layout

Use a full-screen, task-focused interface.

Avoid sidebar interference with dosage entry and printing.

## POS Layout

Use a full-screen checkout-oriented interface.

Keep product search, cart and customer selection immediately accessible.

---

# 9. PHASE 1 — DASHBOARD REDESIGN

Redesign the dashboard inspired by the uploaded light and dark SaaS references.

## Requirements

Create a clean overview with existing real API-backed metrics.

Potential sections, only where supported by existing APIs:

- Today's prescriptions.
- Label activity.
- Product counts.
- Inventory status.
- Low-stock alerts.
- Expiring batches.
- Recent activity.
- Prescription trends.
- Inventory movement trends.

Use:

- Premium metric cards.
- Modern charts.
- Clear typography.
- Consistent spacing.
- Responsive layouts.

Do not invent data.

Do not display fake percentages or trends.

Do not create decorative charts without meaningful data.

### Chart design

Light mode:

- Neutral background.
- Blue primary series.
- Muted supporting colors.

Dark mode:

- Graphite surfaces.
- Accessible series colors.
- Subtle grid lines.

Preserve existing metric definitions and date filters.

---

# 10. PHASE 2 — LABEL WORKSTATION REDESIGN

This is a high-priority clinical workflow.

Do not treat it like an ordinary dashboard.

## Layout

Use a full-screen, touch-optimized workstation.

### Top panel

Preserve:

- Patient / Mobile.
- Medicine search.
- Alternative product.
- Product quantity.
- Home.

Improve:

- Input hierarchy.
- Spacing.
- Focus states.
- Search results.
- Responsive behavior.

### Left feature panel

Use the approved current workstation features.

Design:

- Large, easy-to-tap buttons.
- Consistent icon sizing.
- Clear selected states.
- High readability.
- Efficient grid layout.
- Minimal visual clutter.

Do not arbitrarily change the ordering of features.

Do not introduce extra workflow steps.

### Right dosage panel

Preserve:

- Morning.
- Lunch.
- Night.
- Quantity controls.
- X/Y selector.
- GIVE.
- TAKE.
- BEFORE.
- AFTER.

Use large dosage controls and a clear visual hierarchy.

Maintain semantic distinctions between time periods without using excessive decorative colors.

### Bottom panel

Preserve:

- Expiry.
- Label navigation.
- DONE.
- Review.
- Printing actions.

Keep the most important actions accessible.

### ENT

Remove the ENT button from the visible workstation UI.

Preserve historical ENT data and printing compatibility.

### Clinical safeguards

Do not change:

- Dosage calculations.
- Instruction sequencing.
- Sinhala translations.
- STAT behavior.
- Weekly and daily logic.
- Day-range behavior.
- Reasons behavior.
- Expiry date behavior.
- Print-only.
- Print & Save.
- Prescription history.
- Existing validation.

### Label printing

Preserve exact 70 × 50 mm output.

Create visual regression tests comparing label output before and after redesign.

---

# 11. PHASE 3 — POS REDESIGN

Redesign the existing POS interface using the same design system.

## Desktop layout

- Product search.
- Barcode scanning.
- Product results.
- Customer selection.
- Cart.
- Quantity controls.
- Stock warnings.
- Totals.
- Checkout status.

## Touchscreen

- Large buttons.
- Clear product results.
- Reliable scan focus.
- Large cart controls.
- No unnecessary dialogs.
- Fast keyboard navigation.

## Dark mode

Ensure all POS elements are readable:

- Product prices.
- Quantity.
- Warnings.
- Selected products.
- Cart rows.
- Disabled actions.

## Critical restrictions

Do not implement missing checkout functionality.

Do not enable payments.

Do not issue invoices.

Do not deduct stock.

Do not invent tax or rounding rules.

Preserve existing barcode, cart, role and patient lookup behavior.

If checkout is still awaiting accountant approval, keep it disabled.

---

# 12. PHASE 4 — PATIENTS MODULE

Redesign:

- Patient list.
- Patient search.
- Patient registration.
- Patient details.
- Patient editing.
- Related history screens.

Use:

- Clean data tables.
- Server-side pagination.
- Modern search.
- Responsive forms.
- Clear validation.
- Accessible dialogs.

Preserve:

- Patient edit rules.
- Duplicate mobile warnings.
- Allergy validation.
- Historical printed names.
- Existing role restrictions.
- Data minimization.

Do not change patient retention or deletion rules.

---

# 13. PHASE 5 — PRESCRIPTIONS MODULE

Redesign:

- Prescription list.
- Prescription details.
- Prescription history.
- Search and filters.
- Status displays.
- Reprint controls.
- Existing actions.

Use a clear hierarchy suitable for pharmacists.

Preserve:

- Historical prescription data.
- Clinical wording.
- Reprint behavior.
- Existing permissions.
- Prescription lifecycle.

Do not introduce voiding or stock reversal without approved rules.

---

# 14. PHASE 6 — PRODUCTS MODULE

Redesign:

- Product list.
- Product details.
- Product creation.
- Product editing.
- Barcode information.
- Product types.
- Search and filtering.

Use modern tables and forms.

Preserve:

- Product classification.
- Barcode behavior.
- Existing pricing fields.
- Product validation.
- Clinical product-type behavior.

Do not modify product records as part of the redesign.

---

# 15. PHASE 7 — INVENTORY MODULE

Redesign:

- Inventory overview.
- Stock batches.
- Receiving stock.
- Stock adjustments.
- Suppliers.
- Expiry monitoring.
- Low-stock alerts.
- Inventory history.

Use:

- Clear status badges.
- Modern tables.
- Consistent forms.
- Filterable lists.
- Accessible confirmation dialogs.

Preserve:

- Batch quantities.
- Expiry calculations.
- Quarantine rules.
- Stock movement logic.
- Existing adjustment authorization.

Do not automatically switch from legacy dispensing to batch-level stock deduction.

---

# 16. PHASE 8 — REPORTING AND ANALYTICS

Redesign all existing reports.

Use:

- Modern filter controls.
- Date-range selectors.
- Responsive charts.
- Summary cards.
- Data tables.
- Export controls where already implemented.

Do not invent missing reports.

Do not fabricate sales or prescription metrics.

Preserve existing report calculations.

---

# 17. PHASE 9 — ADMIN AND SETTINGS

Redesign:

- Pharmacy profile.
- Printer settings.
- Label settings.
- Inventory settings.
- System settings.
- Audit logs where implemented.
- User management where implemented.

Use a clear settings layout with section navigation.

Preserve existing authorization.

### Pending settings

Keep unresolved settings read-only:

- Q-S1: Pharmacy details used on labels.
- Q-S3: Inventory alert settings.
- Q-S4: Email and registration details requiring schema changes.

Do not make controls editable unless the underlying behavior is approved and implemented.

Preserve optimistic concurrency handling for settings updates.

---

# 18. PHASE 10 — AUTHENTICATION

Redesign:

- Login.
- Password recovery where implemented.
- Session-expired screens.
- Unauthorized screens.
- Error screens.
- Loading states.

Use the same light/dark design language.

Do not change authentication logic.

Do not weaken role checks.

Do not introduce insecure demo authentication.

---

# 19. ACCESSIBILITY REQUIREMENTS

Target WCAG 2.2 AA where applicable.

Requirements:

- Adequate contrast.
- Visible keyboard focus.
- Semantic HTML.
- Proper labels.
- Accessible error messages.
- Screen-reader names.
- Keyboard-operable dialogs.
- Escape-to-close behavior where appropriate.
- Logical tab order.
- No keyboard traps.
- Reduced-motion support.
- Sufficient touch targets.
- Accessible selected states.
- Meaningful loading announcements.

Do not use color as the only way to communicate status.

Verify Sinhala text remains readable.

---

# 20. RESPONSIVE DESIGN

Test at minimum:

- 390 × 844.
- 768 × 1024.
- 1024 × 768.
- 1366 × 768.
- 1440 × 900.
- 1920 × 1080.

### Desktop

Use balanced grid layouts.

Avoid unnecessary whitespace.

### Tablet

Support touch interaction.

Keep forms and data tables usable.

### Mobile

Use responsive stacking, drawers and appropriate scrolling.

Do not hide essential controls.

For complex tables, provide usable horizontal scrolling or an accessible mobile alternative.

Do not force full desktop layouts into narrow screens.

---

# 21. ANIMATIONS AND INTERACTIONS

Use restrained transitions.

Suggested durations:

- Hover: 120–160 ms.
- Dropdown: 150–200 ms.
- Dialog: 180–220 ms.
- Sidebar: 180–240 ms.

Respect `prefers-reduced-motion`.

Avoid:

- Large entrance animations.
- Excessive scaling.
- Flashing effects.
- Distracting gradients.
- Animations that delay dispensing tasks.

---

# 22. REGRESSION SAFEGUARDS

Before and after each phase, verify the relevant existing behavior.

## Clinical regression

Test:

- Dosage selection.
- Daily instructions.
- Weekly instructions.
- STAT.
- 5H / 6H / 8H.
- Morning / Lunch / Night.
- GIVE / TAKE.
- BEFORE / AFTER.
- Expiry.
- Reasons.
- Label navigation.
- Print-only.
- Print & Save.

## Printing regression

Verify:

- 70 × 50 mm paper.
- Correct Sinhala rendering.
- Correct margins.
- Correct typography.
- Correct dosage text.
- Correct pharmacy details.
- Historical label output.
- Light-theme printing.
- Dark-theme printing.

Dark mode must never produce dark-background labels.

## Security regression

Verify:

- Cashier permissions.
- Staff permissions.
- Pharmacist permissions.
- Admin permissions.
- Missing-role denial.
- Unauthorized route handling.
- Session expiration.

## POS regression

Verify:

- Product search.
- Barcode scans.
- Cart.
- Stock warnings.
- Customer lookup.
- Disabled checkout.
- Cart cleanup on logout.

---

# 23. TESTING STRATEGY

Run tests phase by phase.

### Automated checks

- TypeScript.
- ESLint.
- Unit tests.
- Component tests.
- Relevant API regression tests.
- Production build.
- `git diff --check`.

### Browser tests

Use Playwright or the existing browser-testing framework where available.

Capture screenshots in both light and dark themes.

Check:

- Visual consistency.
- Overflow.
- Alignment.
- Focus states.
- Dialogs.
- Dropdowns.
- Tables.
- Touch targets.
- Responsive layouts.

### Existing test issues

Previous reports identified:

- Load-sensitive tests.
- A POS duplicate-search unhandled error.
- Occasional concurrent test timeouts.

Do not suppress failures.

Run heavy test suites sequentially where necessary.

Distinguish:

- New regressions.
- Existing failures.
- Environment limitations.
- Unverified database behavior.

### Database restrictions

Do not use remote Supabase.

Do not apply migrations.

Do not access real patient data.

Use approved disposable test environments only.

If database integration is unavailable, mark it NOT VERIFIED.

---

# 24. IMPLEMENTATION ORDER

Follow this sequence.

## Foundation

1. Repository audit.
2. Design tokens.
3. Theme engine.
4. Shared component library.
5. App shell and navigation.

## Operational modules

6. Label Workstation.
7. POS.
8. Patients.
9. Prescriptions.
10. Products.
11. Inventory.

## Management modules

12. Dashboard.
13. Reporting.
14. Admin Settings.
15. Audit Logs.
16. User Management.
17. Authentication.

## Finalization

18. Full visual consistency audit.
19. Accessibility audit.
20. Light/dark theme regression.
21. Printing regression.
22. Cross-module integration tests.
23. Final documentation.

You may reorder independent modules if repository dependencies justify it, but document the reason.

---

# 25. DEFINITION OF DONE FOR EACH PHASE

A phase is complete only when:

1. Its scoped pages are redesigned.
2. Both themes are implemented.
3. Shared design components are reused.
4. Responsive layouts are verified.
5. Keyboard accessibility is checked.
6. Existing functionality is preserved.
7. Relevant automated tests pass.
8. Screenshots are captured where possible.
9. No unrelated module was unintentionally changed.
10. Known limitations are documented.

Do not declare an entire module complete if only its UI has been modernized.

Track UI completion separately from backend and business-feature completion.

---

# 26. DOCUMENTATION

Create:

- `PHARMACY_UI_MODERNIZATION_BASELINE.md`
- `PHARMACY_DESIGN_SYSTEM_SPEC.md`
- `PHARMACY_LIGHT_DARK_THEME_REPORT.md`
- `PHARMACY_UI_COMPONENT_LIBRARY_REPORT.md`
- `PHARMACY_MODULE_UI_REDESIGN_PROGRESS.md`
- `PHARMACY_UI_ACCESSIBILITY_REPORT.md`
- `PHARMACY_UI_VISUAL_REGRESSION_REPORT.md`
- `PHARMACY_UI_FINAL_MODERNIZATION_REPORT.md`

For every phase, document:

- Pages changed.
- Components created.
- Components reused.
- Files modified.
- Theme support.
- Responsive verification.
- Accessibility results.
- Test results.
- Screenshots.
- Known issues.
- Remaining work.

Maintain a module-by-module progress matrix.

---

# 27. STRICT DEVELOPMENT RULES

DO NOT:

- Change clinical calculations.
- Change Sinhala clinical wording.
- Change prescription business logic.
- Change label dimensions.
- Change print/save semantics.
- Change inventory deductions.
- Enable POS checkout.
- Invent financial rules.
- Change authentication rules.
- Weaken authorization.
- Modify database schemas.
- Apply migrations.
- Access remote databases.
- Commit or push.
- Deploy.
- Overwrite concurrent development work.
- Replace existing features with mock screens.
- Introduce fake dashboard data.
- Mark untested behavior as verified.

DO:

- Reuse existing components.
- Centralize design tokens.
- Keep light/dark themes consistent.
- Preserve business functionality.
- Verify each phase.
- Document unresolved issues.
- Keep the UI practical for pharmacy staff.

---

# 28. FINAL ACCEPTANCE CRITERIA

The complete redesign is successful when:

- Every existing page follows the same visual language.
- Light, Dark and System themes work throughout the application.
- No major hardcoded theme colors remain outside documented exceptions.
- Sidebar and full-screen layouts are consistent.
- Label Workstation remains fast and touch-friendly.
- POS remains functional within its approved scope.
- Tables, forms, modals and navigation use shared components.
- All user roles see appropriate navigation.
- Accessibility checks pass or remaining exceptions are documented.
- Responsive layouts work across the required screen sizes.
- Existing clinical tests pass.
- Existing printing tests pass.
- No changes are made to approved Sinhala wording.
- Printed labels remain exactly 70 × 50 mm.
- No unauthorized backend or database changes occur.
- All implementation reports are completed.

---

# 29. EXECUTION INSTRUCTIONS

Start by inspecting the repository and producing the baseline audit.

Then implement the foundation:

1. Semantic design tokens.
2. Light/dark/system theme engine.
3. Reusable component foundations.
4. Hybrid navigation shell.

Run verification after the foundation.

Continue through the module phases only when the previous phase is verified and no concurrent file conflicts exist.

Do not rush the entire redesign into one uncontrolled change.

Do not stop after generating mockups or design documents. Implement the actual frontend changes in the repository.

At each phase, report:

- What changed.
- What passed.
- What failed.
- What remains.
- Which phase is next.

**Final goal: Transform the existing Pharmacy Label SaaS into a premium, cohesive, modern light-and-dark enterprise pharmacy platform, without changing its clinical functionality, business rules or printing behavior.**