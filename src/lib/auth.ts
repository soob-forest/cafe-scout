import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(returnTo = "/visits") {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return { supabase, user };
}
