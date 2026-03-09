import type { Metadata } from "next";

const SITE_URL = "https://steadystake.org";

export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/dashboard` },
};

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return <>{children}</>;
}
