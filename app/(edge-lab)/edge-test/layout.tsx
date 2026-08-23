import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edge Lab",
  robots: { index: false, follow: false },
};

/**
 * Bare root layout for the edge lab — deliberately imports NOTHING from the
 * main app: no globals.css, no fonts, no template (loader / navbar / cursor /
 * locomotive), no analytics. The point of /edge-test is to reproduce the OLD
 * site's environment (which renders edge-to-edge on the client's device) and
 * add the main site's behaviours back one at a time via query flags until the
 * one that makes Safari box the page in shows itself. Anything imported here
 * would contaminate the baseline.
 */
export default function EdgeLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#470015", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
