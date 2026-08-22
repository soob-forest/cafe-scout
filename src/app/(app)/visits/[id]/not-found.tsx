import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function VisitNotFound() {
  return (
    <main className="page-shell">
      <section className="empty-state">
        <span>404</span>
        <h1>방문 기록을 찾을 수 없습니다.</h1>
        <p>삭제되었거나 접근 권한이 없는 기록입니다.</p>
        <Link className="primary-button" href="/visits">
          <ArrowLeft size={16} /> 목록으로
        </Link>
      </section>
    </main>
  );
}
