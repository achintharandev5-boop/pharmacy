# Pharmacy design system specification

Status: foundation prepared; verification results are tracked separately. Scope: frontend presentation only.

## Identity and tokens

Neutral graphite/white surfaces with restrained blue actions. `app/theme.css` owns semantic values; the existing Tailwind 4 semantic utility names remain compatible. `page` is the card/control surface (existing API); `canvas` is the page background. Separate surface, surface-2 and elevated levels provide depth without gradients. Light canvas #F7F8FA; dark canvas #0D0F14; light card #FFFFFF; dark card #171A21. Primary #2563EB / #60A5FA. Each solid semantic action has its own `on-*` foreground, so dark buttons do not use white on pale blue/green/red.

Semantic groups: canvas/page/elevated; fg/muted/subtle/disabled; input/input-border; hover/selected/focus; primary/success/warning/danger/info soft and border companions; sidebar/nav-active/row-hover; backdrop/tooltip; chart-1/chart-2/chart-grid; scrollbar. Accent is neutral, not purple branding. Muted text and input-border values are adjusted from the suggested palette for contrast. Contrast calculations and browser checks belong in the accessibility report.

Typography: existing system sans family; no network font introduced. Sinhala `.sinhala-text` declaration and clinical strings remain unchanged. Page headings 28–32px, card headings 16px, body 14–16px. Workstation quantities retain their existing clinically usable sizing.

Spacing: 4,8,12,16,20,24,32,40,48px. Existing physical label dimensions and dense workstation geometry are protected exceptions. Controls 12px radius, cards 16px, modal 20px, badge 8px. Card shadows restrained; dark surfaces use borders/contrast. Existing reduced-motion global rule retained.

## Component strategy

Extend existing components. Button remains the public API for AppButton; Input for TextInput/NumberInput/date/time through native type; StatTile for MetricCard; ConfirmDialog for ConfirmationDialog; Skeleton for LoadingSkeleton. No second component library. Shared Drawer and ThemeSwitcher are additions. Existing search comboboxes retain their domain behaviour. Only add interactive primitives when an existing application surface needs them; do not create unused parallel implementations.

Buttons: primary/secondary/outline/ghost/danger/danger-soft/success; sizes 36/44/48/56px. Loading sets aria-busy and disables submission. IconButton requires an accessible label. Existing error/empty/loading/table/pagination components retain their behaviour and consume semantic tokens. Native select remains keyboard-operable. Dialog traps focus and restores opener. Native dialog-based Drawer adds focus containment and background inertness.

## Theme engine

Preference key `pharmacy-theme`, values light/dark/system. Static inline bootstrap in root head resolves before body paint. A client controller listens for OS and cross-tab changes. useSyncExternalStore provides deterministic server snapshots and hydration-safe controls. Storage failures preserve in-session switching. No database persistence, auth change or migration.

## Printing

PrintableLabel, layout fitting, calculations, Sinhala text and the existing @page 70mm 50mm remain protected. Screen theme tokens never change approved print layout. Print media explicitly uses light color-scheme, white background, black text. Sample-label PNG comparison must match baseline under both themes; physical printer remains NOT VERIFIED.
