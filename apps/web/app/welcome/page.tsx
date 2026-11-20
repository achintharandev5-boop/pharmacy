import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

const description =
  "An organized workspace for prescriptions, inventory, patient records and pharmacy workflows. Currently being prepared for a controlled single-pharmacy pilot.";

export const metadata: Metadata = {
  title: "Pharmacy Management System — An Organized Working Day",
  description,
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    title: "Pharmacy Management System",
    description,
    type: "website",
    locale: "en_US",
  },
};

/** Retains the existing proxy and provider access controls. No application data is fetched. */
export default function WelcomePage() {
  return (
    <>
      <link
        rel="preload"
        href="/fonts/InterVariable.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <LandingPage />
    </>
  );
}
