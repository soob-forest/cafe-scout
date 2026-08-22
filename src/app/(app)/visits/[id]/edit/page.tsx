import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getVisit, listCafeOptions } from "@/features/visits/repository";
import { visitRecordToInput } from "@/features/visits/defaults";
import { VisitForm } from "@/features/visits/visit-form";

export const dynamic = "force-dynamic";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/visits/${id}/edit`);
  const [visit, cafes] = await Promise.all([getVisit(supabase, id), listCafeOptions(supabase)]);
  if (!visit) notFound();
  return (
    <main className="form-page">
      <VisitForm
        initial={visitRecordToInput(visit)}
        cafes={cafes}
        visitId={id}
        existingPhotos={visit.photos}
      />
    </main>
  );
}
