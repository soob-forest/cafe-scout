import Link from "next/link";
import { Coffee, LogOut, Plus } from "lucide-react";
import { logout } from "@/app/login/actions";

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" href="/visits">
          <span className="brand-mark">
            <Coffee size={18} />
          </span>{" "}
          CAFE SCOUT
        </Link>
        <nav className="app-nav" aria-label="주요 메뉴">
          <Link href="/visits">방문 기록</Link>
          <Link className="nav-new" href="/visits/new">
            <Plus size={16} /> 새 기록
          </Link>
        </nav>
        <form action={logout} className="account-control">
          <span>{email}</span>
          <button type="submit" aria-label="로그아웃" title="로그아웃">
            <LogOut size={17} />
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
