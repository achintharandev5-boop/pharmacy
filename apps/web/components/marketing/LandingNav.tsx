"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, Menu, Plus, X } from "lucide-react";
import styles from "./landing.module.css";

const links = [
  ["Features", "#features"],
  ["How It Works", "#how-it-works"],
  ["Security", "#security"],
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) close();
      }}
    >
      <div className={styles.navInner}>
        <a
          href="#top"
          className={styles.wordmark}
          aria-label="Pharmacy Management System home"
        >
          <span className={styles.brandMark}>
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>
            Pharmacy<span className={styles.brandSub}>Management System</span>
          </span>
        </a>
        <nav className={styles.desktopNav} aria-label="Landing page navigation">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <Link className={`${styles.button} ${styles.navLogin}`} href="/login" prefetch={false}>
          Staff Login <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <button
          ref={toggle}
          className={styles.menuToggle}
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="landing-mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X aria-hidden="true" size={22} />
          ) : (
            <Menu aria-hidden="true" size={22} />
          )}
        </button>
      </div>
      {open && (
        <nav
          id="landing-mobile-navigation"
          className={styles.mobileNav}
          aria-label="Mobile landing page navigation"
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <Link href="/login" prefetch={false} onClick={() => setOpen(false)}>
            Staff Login <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      )}
    </header>
  );
}
