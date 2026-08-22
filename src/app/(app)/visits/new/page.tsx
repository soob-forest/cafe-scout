import { requireUser } from "@/lib/auth";
import { listCafeOptions } from "@/features/visits/repository";
import { defaultVisitInput } from "@/features/visits/defaults";
import { VisitForm } from "@/features/visits/visit-form";

export const dynamic = "force-dynamic";

export default async function NewVisitPage() {
  const { supabase } = await requireUser("/visits/new");
  const cafes = await listCafeOptions(supabase);
  return (
    <main className="form-page">
      <VisitForm initial={defaultVisitInput()} cafes={cafes} />
    </main>
  );
}
