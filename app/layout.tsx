import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p";
import "./globals.css";

export const metadata: Metadata = {
  title: "TALLY – 8-BIT DRINK TRACKER",
  description:
    "Create a room, invite friends, and track who drank the most. An 8-bit arcade drink counter.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
