import {
  ArrowDownUp,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import styles from "./landing.module.css";

export type PreviewVariant =
  "dashboard" | "prescription" | "inventory" | "patients";

const labels = {
  dashboard: "Workspace overview",
  prescription: "Prescription workstation",
  inventory: "Medicine inventory",
  patients: "Patient records",
};

function TestLabel() {
  return (
    <div className={styles.testLabel}>
      <span className={styles.testStamp}>TEST LABEL · PREVIEW ONLY</span>
      <strong>TEST · Medicine A</strong>
      <span>TEST PATIENT</span>
      <div className={styles.labelLines}>
        <span />
        <span />
        <span />
      </div>
      <small>Sinhala &amp; English instructions</small>
    </div>
  );
}

/** Isolated editorial UI, based on existing module names. No API, data or clinical text. */
export function ProductPreview({
  variant = "dashboard",
  compact = false,
}: {
  variant?: PreviewVariant;
  compact?: boolean;
}) {
  return (
    <figure
      className={`${styles.productFrame} ${compact ? styles.compactFrame : ""}`}
      aria-label={`Illustrative ${labels[variant].toLowerCase()}; synthetic content only`}
    >
      <div className={styles.windowBar}>
        <span className={styles.windowDots}>
          <i />
          <i />
          <i />
        </span>
        <span>
          <ShieldCheck size={11} aria-hidden="true" /> Pharmacy workspace
        </span>
        <span className={styles.demoPill}>ILLUSTRATIVE</span>
      </div>
      <div className={styles.appBody}>
        <aside className={styles.appRail} aria-hidden="true">
          <div className={styles.railLogo}>
            <Plus size={20} strokeWidth={3} />
          </div>
          {[LayoutDashboard, ClipboardList, Package, Users, Boxes].map(
            (Icon, index) => (
              <span
                className={
                  index ===
                  { dashboard: 0, prescription: 1, inventory: 2, patients: 3 }[
                    variant
                  ]
                    ? styles.railActive
                    : ""
                }
                key={index}
              >
                <Icon size={17} strokeWidth={1.7} />
              </span>
            ),
          )}
          <span className={styles.railBottom}>
            <SlidersHorizontal size={16} />
          </span>
        </aside>
        <div className={styles.appCanvas}>
          <div className={styles.appTop}>
            <span>
              Workspace{" "}
              <span className={styles.breadcrumb}>/ {labels[variant]}</span>
            </span>
            <Bell size={14} aria-hidden="true" />
            <span className={styles.avatar}>TS</span>
          </div>
          <div className={styles.appContent}>
            <div className={styles.previewHeading}>
              <div>
                <span className={styles.previewEyebrow}>
                  YOUR PHARMACY, ORGANIZED
                </span>
                <p className={styles.previewTitle}>{labels[variant]}</p>
              </div>
              <span className={styles.smallBadge}>
                <span /> Test workspace
              </span>
            </div>
            {variant === "dashboard" ? (
              <>
                <div className={styles.overviewCards}>
                  {[
                    [ClipboardList, "Prescriptions", "Review workspace"],
                    [Boxes, "Inventory", "Batch overview"],
                    [Users, "Patients", "Patient records"],
                  ].map(([Icon, title, subtitle]) => {
                    const TileIcon = Icon as typeof Boxes;
                    return (
                      <div className={styles.overviewCard} key={String(title)}>
                        <TileIcon size={16} aria-hidden="true" />
                        <strong>{String(title)}</strong>
                        <span>{String(subtitle)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.dashboardPanels}>
                  <div className={styles.stockPanel}>
                    <div className={styles.panelTitle}>
                      Inventory at a glance{" "}
                      <ArrowDownUp size={13} aria-hidden="true" />
                    </div>
                    <div className={styles.chart} aria-hidden="true">
                      {[35, 60, 48, 80, 62, 92, 74, 100, 65, 87].map(
                        (height, index) => (
                          <span key={index} style={{ height: `${height}%` }} />
                        ),
                      )}
                    </div>
                    <span className={styles.chartCaption}>
                      Illustrative stock view · not live quantities
                    </span>
                  </div>
                  <div className={styles.workflowPanel}>
                    <span className={styles.panelTitle}>
                      Prescription workflow
                    </span>
                    {[
                      "Find a medicine",
                      "Prepare instructions",
                      "Review label preview",
                    ].map((text, index) => (
                      <div className={styles.workflowItem} key={text}>
                        <span>
                          {index === 2 ? (
                            <FileText size={13} />
                          ) : (
                            <Check size={13} />
                          )}
                        </span>
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.stockNotice}>
                  <span className={styles.alertDot} />
                  <div>
                    <strong>Keep the next step in sight</strong>
                    <span>
                      Review stock alerts, batches and expiry information.
                    </span>
                  </div>
                  <ArrowRight size={14} aria-hidden="true" />
                </div>
              </>
            ) : variant === "prescription" ? (
              <>
                <div className={styles.searchMock}>
                  <Search size={14} aria-hidden="true" /> Search medicine or
                  barcode<span>⌘ K</span>
                </div>
                <div className={styles.prescriptionGrid}>
                  <div>
                    <div className={styles.mockField}>
                      <span>Selected medicine</span>
                      <strong>
                        TEST · Medicine A{" "}
                        <ChevronDown size={12} aria-hidden="true" />
                      </strong>
                    </div>
                    <div className={styles.panelTitle}>
                      Instruction workspace
                    </div>
                    <div className={styles.instructionTiles}>
                      {[
                        "Morning",
                        "Daily",
                        "With food",
                        "Duration",
                        "Reasons",
                        "Expiry",
                      ].map((text, index) => (
                        <span
                          className={index === 0 ? styles.selectedTile : ""}
                          key={text}
                        >
                          {text}
                        </span>
                      ))}
                    </div>
                    <div className={styles.reviewMock}>
                      <CircleCheck size={14} aria-hidden="true" /> Review before
                      recording
                    </div>
                  </div>
                  <TestLabel />
                </div>
              </>
            ) : variant === "inventory" ? (
              <>
                <div className={styles.searchMock}>
                  <Search size={14} aria-hidden="true" /> Search the medicine
                  catalogue
                  <SlidersHorizontal size={13} aria-hidden="true" />
                </div>
                <div className={styles.mockTabs}>
                  <span className={styles.activeMockTab}>Products</span>
                  <span>Batches</span>
                  <span>Movements</span>
                </div>
                <div className={styles.inventoryTable}>
                  <div className={styles.tableHead}>
                    <span>MEDICINE</span>
                    <span>BATCH</span>
                    <span>REVIEW</span>
                  </div>
                  {["A", "B", "C"].map((letter, index) => (
                    <div className={styles.tableRow} key={letter}>
                      <span>
                        <span className={styles.medicineIcon}>
                          <Package size={15} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>TEST · Medicine {letter}</strong>
                          <small>Synthetic product</small>
                        </span>
                      </span>
                      <span>TEST-{letter}</span>
                      <span
                        className={
                          index === 1 ? styles.amberTag : styles.greenTag
                        }
                      >
                        {index === 1 ? "Expiry" : "Batch"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.tableFooter}>
                  Synthetic catalogue · no operational stock figures
                </div>
              </>
            ) : (
              <>
                <div className={styles.searchMock}>
                  <Search size={14} aria-hidden="true" /> Find a patient record
                  <SlidersHorizontal size={13} aria-hidden="true" />
                </div>
                <div className={styles.patientCard}>
                  <span className={styles.patientAvatar}>
                    <Users size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>TEST PATIENT</strong>
                    <span>Illustrative patient profile</span>
                  </div>
                  <span className={styles.greenTag}>TEST DATA</span>
                </div>
                <div className={styles.patientSections}>
                  <div>
                    <FileText size={18} aria-hidden="true" />
                    <strong>Prescription records</strong>
                    <span>A connected view of previous records.</span>
                  </div>
                  <div>
                    <ClipboardList size={18} aria-hidden="true" />
                    <strong>Patient details</strong>
                    <span>Profile information in one place.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <figcaption className={styles.previewCaption}>
        Illustrative interface. Synthetic content only; no live patient or
        pharmacy data.
      </figcaption>
    </figure>
  );
}
