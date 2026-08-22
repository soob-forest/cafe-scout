"use server";

import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/safe-return-to";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/visits");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "로그인 정보를 확인해 주세요." };
  } catch {
    return { error: "로그인 서비스를 사용할 수 없습니다. 환경 설정을 확인해 주세요." };
  }
  redirect(safeReturnTo(returnTo));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
