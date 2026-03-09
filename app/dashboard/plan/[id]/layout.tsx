import type { Metadata } from "next";

const SITE_URL = "https://steadystake.org";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    alternates: { canonical: `${SITE_URL}/dashboard/plan/${id}` },
  };
}

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
