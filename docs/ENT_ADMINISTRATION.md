# ENT administration

The ENT control beside Name of Days opens an inline panel. Select Eye, Ear, Nose or Throat; Eye and Ear have exclusive Left / Right / Both directions. Continue using the existing Morning, Lunch and Night quantity controls and duration.

Eye and Ear start with editable drop wording. Recognized catalogue administration units (drops, sprays, puffs, mL) are reused; packaging units are ignored. Nose and Throat require staff to configure the singular and plural administration unit. Wording is editable and must include `{qty}`, `{unit}`, `{location}` and `{time}`. The unit and wording are recorded per label. No new product catalogue fields or database migrations are required.

Each positive daily dose generates a sentence. Both means the entered quantity per eye or ear, rendered as “each eye” or “each ear”. Selected Instructions, Label Text, review and print use the shared label builder. ENT replaces the generated oral administration sentence for the daily schedule; other selected tags, quantities, reasons and duration remain. An incomplete ENT unit/template or a schedule without a positive dose quantity blocks review.

The store uses versioned ENT metadata in its existing instruction list to retain the current label switching/reset behavior. The prescription payload separates this metadata into an optional validated `ent` object, preserving the existing limits on ordinary instruction strings. The API saves it in `prescription_items.instructions_json.ent`, together with the existing generated `final_instruction_text`. No raw ENT metadata is printed.

Automated coverage includes panel opening, all sites and directions, Morning/Lunch/Night text, singular/plural units, configured spray wording, printed label rendering, selected instruction text, label switching/reset, validation and API persistence. Existing web regression tests also pass. Physical printer output and browser viewport checks require a running application and have not been verified in this change.


## Sketch scheduling controls

The reference grid includes 4H, 6H, Start Day, Daily, End Day, 8H, Customize Hours and Evening. The existing 5H option is retained. Add Label and Delete Label use their existing handlers.

All frequency controls share the existing mutually exclusive frequency selection and quantity pad. Custom intervals accept whole hours from 1 through 24. Applying hours opens the existing frequency quantity pad; Quantity per dose can reopen it. Presets replace custom frequency and preserve the quantity. Review rejects combining Morning/Lunch/Night doses with a frequency instead of silently deleting a dose.

Start Day and End Day select calendar dates, stored as YYYY-MM-DD and printed explicitly. Either boundary can be unset or cleared. Invalid or reversed dates block review; reversed boundaries are also rejected by the API. Dates do not infer a duration or change the existing days quantity.

Custom hours and dates persist in instructions_json.ent. Frequency and frequency quantity use existing prescription fields. ENT frequency sentences use the configured administration unit. The printed tablet-frequency row is suppressed only for ENT labels; non-ENT formatting remains unchanged.

Verification: 348 web tests and 46 targeted API tests passed. Both TypeScript checks and ENT ESLint checks passed. Browser viewport and physical printer checks remain unverified.
