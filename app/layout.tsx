import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseCare AI — Autonomous Healthcare Concierge & Clinic Operations",
  description:
    "Anthropic Claude-inspired editorial healthcare concierge, autonomous clinic operations, and self-healing workflow orchestrator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-canvas text-ink font-sans selection:bg-primary/20 selection:text-ink">
        {children}
      </body>
    </html>
  );
}
