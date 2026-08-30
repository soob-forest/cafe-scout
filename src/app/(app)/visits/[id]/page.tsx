import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { VisitDetailBlocks } from "@/features/visits/visit-detail-blocks";
import { VisitBusinessSnapshot, VisitDetailHeader } from "@/features/visits/visit-detail-summary";
import { getVisit } from "@/features/visits/repository";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/visits/${id}`);
  const visit = await getVisit(supabase, id);
  if (!visit) notFound();

  return (
    <main className="page-shell detail-page">
      <Link className="back-link" href="/visits">
        <ArrowLeft size={16} /> 방문 기록
      </Link>
      <VisitDetailHeader visit={visit} />
      <VisitBusinessSnapshot visit={visit} />
      <VisitDetailBlocks visit={visit} />
    </main>
  );
}
