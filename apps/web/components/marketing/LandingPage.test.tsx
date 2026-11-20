import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";
import { LandingNav } from "./LandingNav";
import { ProductPreview } from "./ProductPreview";
import WelcomePage, { metadata } from "@/app/welcome/page";

afterEach(() => vi.restoreAllMocks());

describe("private pilot landing page", () => {
  it("renders one primary heading and every requested product section without fetching data", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(<WelcomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const id of [
      "features",
      "workflows",
      "how-it-works",
      "security",
      "pilot",
    ]) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
    for (const title of [
      "Prescription Management",
      "Medicine Inventory",
      "Patient Records",
      "Medication Labeling",
      "Expiry & Batch Tracking",
      "Pharmacy Dashboard",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("links all staff CTAs to the existing login and all section links to real targets", () => {
    render(<LandingPage />);
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#"))
        expect(document.getElementById(href.slice(1))).toBeInTheDocument();
      else expect(href).toBe("/login");
    }
    expect(
      screen.getByRole("link", { name: "Authorized Staff Login" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.queryByRole("link", { name: /sign up|register|contact|privacy/i }),
    ).toBeNull();
  });

  it("states pilot limitations and does not claim clinical or SaaS availability", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(
        "Currently being prepared for a controlled single-pharmacy pilot.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Clinical approval and general production availability are not implied/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Checkout, payments, invoicing and multi-pharmacy onboarding are not operational offerings/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /HIPAA|ISO.certified|GDPR.compliant|trusted by|99\.9%/i,
      ),
    ).toBeNull();
  });

  it("marks product previews as illustrative and uses synthetic identities", () => {
    const { container } = render(<ProductPreview variant="prescription" />);
    expect(screen.getByRole("figure")).toHaveAccessibleName(
      /Illustrative.*synthetic content only/,
    );
    expect(screen.getByText("TEST PATIENT")).toBeInTheDocument();
    expect(screen.getByText("TEST LABEL · PREVIEW ONLY")).toBeInTheDocument();
    expect(container.querySelectorAll("input, button")).toHaveLength(0);
  });

  it("prevents indexing without introducing invented legal links or canonical hosts", () => {
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(metadata.openGraph).toMatchObject({ type: "website" });
    expect(metadata.alternates).toBeUndefined();
  });
});

describe("mobile landing navigation", () => {
  it("opens, closes after selecting a section, and exposes its state", () => {
    render(<LandingNav />);
    const open = screen.getByRole("button", { name: "Open navigation" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(open);
    const nav = screen.getByRole("navigation", {
      name: "Mobile landing page navigation",
    });
    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(nav).getByRole("link", { name: "Features" }));
    expect(
      screen.queryByRole("navigation", {
        name: "Mobile landing page navigation",
      }),
    ).toBeNull();
  });

  it("closes with Escape and returns keyboard focus to the toggle", () => {
    render(<LandingNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const nav = screen.getByRole("navigation", {
      name: "Mobile landing page navigation",
    });
    const featureLink = within(nav).getByRole("link", { name: "Features" });
    featureLink.focus();
    fireEvent.keyDown(featureLink, { key: "Escape" });
    expect(
      screen.queryByRole("navigation", {
        name: "Mobile landing page navigation",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveFocus();
  });
});
