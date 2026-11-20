import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  PackageCheck,
  Pill,
  Plus,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LandingNav } from "./LandingNav";
import { ProductPreview } from "./ProductPreview";
import { Reveal } from "./Reveal";
import styles from "./landing.module.css";

const features = [
  {
    icon: ClipboardList,
    title: "Prescription Management",
    text: "Organize prescriptions, medication instructions, and dispensing workflows.",
  },
  {
    icon: Boxes,
    title: "Medicine Inventory",
    text: "Track products, quantities, batches, and stock movements.",
  },
  {
    icon: Users,
    title: "Patient Records",
    text: "Manage patient profiles and prescription history.",
  },
  {
    icon: ScanLine,
    title: "Medication Labeling",
    text: "Prepare medication labels with supported Sinhala and English instructions.",
  },
  {
    icon: PackageCheck,
    title: "Expiry & Batch Tracking",
    text: "Review batch information and medicine expiry dates.",
  },
  {
    icon: LayoutDashboard,
    title: "Pharmacy Dashboard",
    text: "View operational information in one organized interface.",
  },
];

const workflows = [
  {
    variant: "prescription" as const,
    number: "01",
    eyebrow: "PRESCRIPTIONS, WITHOUT THE CLUTTER",
    title: "A focused space for every prescription.",
    text: "Bring medicine selection, instructions and label review into one considered workflow.",
    items: [
      "Medication search",
      "Instruction selection",
      "Label preview",
      "Prescription history",
    ],
    label: "Prescription Workstation",
  },
  {
    variant: "inventory" as const,
    number: "02",
    eyebrow: "VISIBILITY FROM RECEIPT TO SHELF",
    title: "Know your inventory. See what needs attention.",
    text: "Keep product and batch information connected, with dedicated tools for everyday inventory tasks.",
    items: [
      "Goods receiving",
      "Batch information",
      "Stock adjustments",
      "Expiry monitoring",
    ],
    label: "Inventory Management",
  },
  {
    variant: "patients" as const,
    number: "03",
    eyebrow: "RECORDS THAT STAY CONNECTED",
    title: "Patient information, thoughtfully organized.",
    text: "Find a patient, review their profile and access prescription records without moving between disconnected tools.",
    items: ["Patient search", "Patient profiles", "Prescription records"],
    label: "Patient Management",
  },
];

export function LandingPage() {
  return (
    <div className={styles.landing} id="top">
      <a href="#landing-main" className={styles.skipLink}>
        Skip to content
      </a>
      <LandingNav />
      <main id="landing-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.statusDot} /> Modern Pharmacy Operations
            </div>
            <h1 id="hero-heading">
              Smarter Pharmacy
              <br className={styles.desktopBreak} /> Management.
              <span>
                Simpler Daily
                <br className={styles.desktopBreak} /> Operations.
              </span>
            </h1>
            <p className={styles.heroDescription}>
              Manage prescriptions, medicine inventory, patients, and pharmacy
              workflows from one organized platform.
            </p>
            <div className={styles.heroActions}>
              <Link
                href="/login"
                prefetch={false}
                className={`${styles.button} ${styles.primaryButton}`}
              >
                Staff Login <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#features"
                className={`${styles.button} ${styles.secondaryButton}`}
              >
                Explore Features <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.pilotNote}>
              <LockKeyhole size={13} aria-hidden="true" /> Currently available
              for authorized pilot testing.
            </p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.previewTopLabel}>
              <span className={styles.shortRule} /> A clearer view of your day{" "}
              <span className={styles.privateTag}>
                <LockKeyhole size={10} aria-hidden="true" /> PRIVATE PILOT
              </span>
            </div>
            <ProductPreview />
            <div className={styles.floatingSearch}>
              <span className={styles.floatingIcon}>
                <Pill size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>From medicine search to label review.</strong>
                <span>A connected prescription workspace.</span>
              </div>
              <span className={styles.floatingCheck}>
                <Check size={15} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.visualFootnote}>
              <span /> One workspace. A more organized workflow.
            </div>
          </div>
        </section>
        <div
          className={styles.capabilityStrip}
          aria-label="Workspace highlights"
        >
          <span>
            Built around the work
            <br />
            <strong>you do every day.</strong>
          </span>
          {[
            [ClipboardList, "Prescription workflows"],
            [Boxes, "Inventory visibility"],
            [Users, "Connected records"],
          ].map(([Icon, text]) => {
            const ItemIcon = Icon as typeof Boxes;
            return (
              <span key={String(text)}>
                <ItemIcon size={19} aria-hidden="true" />
                {String(text)}
              </span>
            );
          })}
        </div>
        <section
          id="features"
          className={styles.features}
          aria-labelledby="features-heading"
        >
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>ONE CONNECTED WORKSPACE</span>
            <h2 id="features-heading">
              Everything Your Pharmacy Needs
              <br className={styles.desktopBreak} /> in One Workspace
            </h2>
            <p>
              Less switching between tools. More room to focus on the work in
              front of you.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title}>
                <article className={styles.featureCard}>
                  <div className={styles.featureTop}>
                    <span className={styles.featureIcon}>
                      <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <span className={styles.featureNumber}>0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
        <section
          id="workflows"
          className={styles.workflows}
          aria-labelledby="workflows-heading"
        >
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              THOUGHTFUL TOOLS. FAMILIAR WORKFLOWS.
            </span>
            <h2 id="workflows-heading">
              Designed Around Real
              <br className={styles.desktopBreak} /> Pharmacy Workflows
            </h2>
          </div>
          <div className={styles.workflowRows}>
            {workflows.map((workflow, index) => (
              <Reveal key={workflow.variant}>
                <article
                  className={`${styles.showcaseRow} ${index % 2 ? styles.reversed : ""}`}
                >
                  <div className={styles.showcaseVisual}>
                    <span className={styles.showcaseNumber}>
                      {workflow.number} / {workflow.label}
                    </span>
                    <ProductPreview variant={workflow.variant} compact />
                  </div>
                  <div className={styles.showcaseCopy}>
                    <span className={styles.eyebrow}>{workflow.eyebrow}</span>
                    <h3>{workflow.title}</h3>
                    <p>{workflow.text}</p>
                    <ul>
                      {workflow.items.map((item) => (
                        <li key={item}>
                          <span>
                            <Check size={12} aria-hidden="true" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <a href="#pilot" className={styles.textLink}>
                      About the private pilot{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
        <section
          id="how-it-works"
          className={styles.howItWorks}
          aria-labelledby="how-heading"
        >
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>A SIMPLE WAY TO WORK</span>
            <h2 id="how-heading">From sign-in to a clearer workflow.</h2>
            <p>Familiar tasks. One organized place to work.</p>
          </div>
          <div className={styles.steps}>
            {[
              {
                title: "Sign In",
                text: "Authorized pharmacy staff access their workspace.",
              },
              {
                title: "Manage Operations",
                text: "Work with medicines, patients, inventory, and prescriptions.",
              },
              {
                title: "Review and Record",
                text: "Review workflow information and maintain operational records.",
              },
            ].map(({ title, text }, index) => (
              <article key={title}>
                <div className={styles.stepTop}>
                  <span>0{index + 1}</span>
                  {index < 2 && <ArrowRight size={20} aria-hidden="true" />}
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="security"
          className={styles.security}
          aria-labelledby="security-heading"
        >
          <div className={styles.securityIntro}>
            <span className={styles.securityEmblem}>
              <ShieldCheck size={31} strokeWidth={1.4} aria-hidden="true" />
            </span>
            <span className={styles.eyebrow}>
              CONSIDERED ACCESS. CLEAR BOUNDARIES.
            </span>
            <h2 id="security-heading">
              Built with Access
              <br /> Control in Mind
            </h2>
            <p>
              Designed for authorized pharmacy teams, with access boundaries
              that support a controlled testing process.
            </p>
            <span className={styles.securityNote}>
              Pilot controls remain subject to deployment verification.
            </span>
          </div>
          <div className={styles.securityList}>
            {[
              {
                icon: LockKeyhole,
                title: "Authenticated staff access",
                text: "A dedicated sign-in for authorized team members.",
              },
              {
                icon: Fingerprint,
                title: "Role-based permissions",
                text: "Access to pharmacy tools follows assigned staff roles.",
              },
              {
                icon: ShieldCheck,
                title: "Protected application APIs",
                text: "Application requests retain authentication and permission checks.",
              },
              {
                icon: Boxes,
                title: "Controlled testing environment",
                text: "A dedicated staging profile for synthetic-data evaluation.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span>
                  <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          id="pilot"
          className={styles.pilot}
          aria-labelledby="pilot-heading"
        >
          <div>
            <span className={styles.pilotBadge}>
              <span /> Private Pilot
            </span>
            <h2 id="pilot-heading">A considered next step.</h2>
            <p>
              Currently being prepared for a controlled single-pharmacy pilot.
            </p>
          </div>
          <div className={styles.pilotDetail}>
            <p>
              Authorized testing with synthetic data only. Clinical approval and
              general production availability are not implied.
            </p>
            <p>
              POS catalogue and cart tools are available for evaluation.
              Checkout, payments, invoicing and multi-pharmacy onboarding are
              not operational offerings.
            </p>
          </div>
        </section>
        <section className={styles.finalCta} aria-labelledby="cta-heading">
          <div className={styles.ctaGraphic} aria-hidden="true">
            <Plus size={72} strokeWidth={0.6} />
            <span />
            <span />
            <span />
          </div>
          <span className={styles.eyebrow}>A MORE CONNECTED WORKING DAY</span>
          <h2 id="cta-heading">
            One Workspace for Everyday
            <br className={styles.desktopBreak} /> Pharmacy Operations.
          </h2>
          <p>
            A focused platform for managing pharmacy workflows with greater
            organization and visibility.
          </p>
          <Link
            href="/login"
            prefetch={false}
            className={`${styles.button} ${styles.lightButton}`}
          >
            Authorized Staff Login <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <span className={styles.ctaNote}>
            <LockKeyhole size={12} aria-hidden="true" /> Access is limited to
            authorized staff.
          </span>
        </section>
      </main>
      <footer className={styles.footer}>
        <a href="#top" className={styles.footerBrand}>
          <span className={styles.brandMark}>
            <Plus size={20} aria-hidden="true" />
          </span>
          Pharmacy Management System
        </a>
        <nav aria-label="Footer navigation">
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#pilot">
            Private Pilot <ChevronRight size={12} aria-hidden="true" />
          </a>
        </nav>
        <span>© {new Date().getFullYear()} Pharmacy Management System</span>
      </footer>
    </div>
  );
}
