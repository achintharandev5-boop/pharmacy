# Pharmacist Operational and Clinical Sign-off

**Status:** decision checklist only; no clinical policy is assumed or approved by this document. Complete with the responsible pharmacist and retain under the pharmacy’s controlled record process.

## Pharmacy and release being reviewed

- Pharmacy / branch: ______________________________
- Responsible pharmacist / registration reference (if applicable): ______________________________
- Software build / commit: ______________________________
- Staging project identifier (no credentials): ______________________________
- Review date and timezone: ______________________________
- Owner / stock controller: ______________________________

For each item mark **APPROVED**, **REJECTED**, or **NOT APPLICABLE**, record the rationale, evidence reference, date and initials. Blank is **NOT APPROVED**.

## A. Label wording and readability

- [ ] Sinhala dosage/instruction wording is clinically correct and understandable for the intended patients.
- [ ] English dosage/instruction wording is clinically correct and consistent with the approved Sinhala text.
- [ ] Mixed-language content, medicine identity, strength/form, patient identity, directions and duration have a pharmacist-approved ordering.
- [ ] STAT/follow-up wording and all instruction combinations have been reviewed; no phrase implies a different dose/frequency.
- [ ] Minimum acceptable text size, contrast, line spacing and abbreviations are defined.
- [ ] Busy/long-label overflow block is understood; staff response when blocked is documented; no unsafe clipping or unapproved split-label behavior.
- [ ] Reprint and save-without-print semantics are clear; a browser dialog is not described as confirmed physical printing.
- [ ] Printed label matches saved prescription identity, medicine, quantity, directions and expiry.

Approved wording/template version: ____________________  Test evidence reference: ____________________

## B. Medicine quantity and prescription validation

- [ ] A medicine item cannot be reviewed/saved/printed without an explicitly entered positive quantity.
- [ ] Quantity unit is defined for each supported form (e.g., tablet, capsule, mL, pack); pack conversion is not inferred.
- [ ] Dose per administration, frequency, duration and total quantity relationship has been reviewed for the workflow; the application does not substitute clinical judgment.
- [ ] Required patient/prescriber/prescription details and validation rules are documented for the pharmacy’s approved practice.
- [ ] Incomplete, expired, duplicate, invalid or insufficient-stock prescriptions have a defined refusal/escalation process.
- [ ] Prescription-only and restricted-medicine approval requirements are defined by the responsible pharmacist and applicable policy.
- [ ] Staff role permitted to create/complete dispensing is specified; all real user accounts are assigned and tested.
- [ ] Partial fills, repeat dispensing and cancellation/correction behavior are documented.

Approved prescription policy reference: ____________________  Role matrix reference: ____________________

## C. Expiry, batch and stock allocation

- [ ] FEFO policy and the interpretation of an expiry date (including timezone/day boundary) are approved.
- [ ] Expired, quarantined, damaged and otherwise ineligible stock is never allocated.
- [ ] Undated/opening/unbatched quantities have an explicit policy; no quantity is presumed to be a valid opening balance.
- [ ] Physical counts and batch discrepancy dispositions are reviewed and signed by pharmacist and owner/controller.
- [ ] Product aggregate, batch available and movement ledger reconciliation results are understood; unresolved discrepancies are not hidden.
- [ ] The pharmacist approves testing transactional dispensing in the specified **staging** environment only after evidence review.
- [ ] Production dispensing-mode cutover requires separate approval and is not granted by this checklist.

Reconciliation packet reference: ____________________  FEFO decision/version: ____________________

## D. Dispensing and returns/quarantine workflow

- [ ] Staff workflow distinguishes prescription saved, dispensing completed, label dialog invoked and physical label confirmed by operator.
- [ ] Dispensing, correction, void/cancel and duplicate retry are auditable and have an escalation route.
- [ ] Patient-returned medicines are held/quarantined pending inspection and are not automatically sellable/restocked.
- [ ] Supplier returns, damaged stock, expired stock, quarantine/release and disposal are distinct actions with reason and actor.
- [ ] Only an authorized pharmacist/role may release quarantined stock, under a documented procedure; expired stock cannot be released by bypassing policy.
- [ ] Physical printer acceptance covers the exact pharmacy workstation, printer, driver and label roll; all safety cases pass.

SOP / return procedure reference: ____________________  Printer evidence reference: ____________________

## E. Decision

- Overall clinical workflow: **APPROVED / APPROVED WITH CONDITIONS / REJECTED / NOT REVIEWED**
- Conditions / exclusions: ______________________________________________________________
- Approved environment only: ____________________
- Responsible pharmacist signature: ____________________ Date: __________
- Pharmacy owner acknowledgement: ____________________ Date: __________

This sign-off does not certify legal compliance, production readiness, stock accuracy beyond the attached evidence, or approval of an unlisted workflow.
