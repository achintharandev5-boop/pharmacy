import { UiTestControls } from "@/components/UiTestControls";
import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import { ThemeController } from "@/components/ui/ThemeSwitcher";
import { themeBootstrap } from "@/lib/themeBootstrap";

export const metadata: Metadata = {
  title: { default: "Pharmacy System", template: "%s · Pharmacy System" },
  description: "Prescription labels, dispensing and inventory",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head><script id="pharmacy-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeController />
        <UiTestControls />
        {children}
      </body>
    </html>
  );
}
