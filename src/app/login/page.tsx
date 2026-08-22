import { Coffee } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { safeReturnTo } from "@/lib/safe-return-to";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/visits");
  }
  return (
    <main className="login-shell">
      <section className="login-copy">
        <Link className="brand brand-light" href="/">
          <span className="brand-mark brand-mark-light">
            <Coffee size={19} />
          </span>{" "}
          CAFE SCOUT
        </Link>
        <p className="eyebrow light">PRIVATE FIELD DESK</p>
        <h1>
          현장 메모를
          <br />
          사업의 언어로.
        </h1>
        <p>사전 등록된 운영자만 관찰 기록에 접근할 수 있습니다.</p>
      </section>
      <section className="login-card">
        <p className="eyebrow">OPERATOR ACCESS</p>
        <h2>다시 만나 반가워요.</h2>
        <p className="login-description">오늘 관찰한 카페의 구조를 기록해 볼까요?</p>
        <LoginForm returnTo={safeReturnTo(params.returnTo)} />
        {!hasSupabaseConfig() && (
          <p className="setup-note">로컬 실행 전 Supabase 환경 변수를 설정해 주세요.</p>
        )}
      </section>
    </main>
  );
}
