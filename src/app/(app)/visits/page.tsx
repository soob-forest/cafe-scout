import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listVisits } from "@/features/visits/repository";
import { CompareSelector } from "@/features/visits/compare-selector";

export const dynamic = "force-dynamic";

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ cleanup?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireUser("/visits");
  const visits = await listVisits(supabase);
  return (
    <main className="page-shell">
      {params.cleanup === "pending" && (
        <div className="notice warning" role="status">
          <strong>기록은 삭제되었습니다.</strong> 일부 사진 object 정리가 지연되었습니다. 운영 점검에서 고아
          사진 정리를 실행해 주세요.
        </div>
      )}
      <header className="page-heading">
        <div>
          <p className="eyebrow">FIELD ARCHIVE</p>
          <h1>방문 기록</h1>
          <p>관찰한 매장의 구조와 사업성 추정을 한눈에 살펴보세요.</p>
        </div>
        <Link className="primary-button" href="/visits/new">
          <Plus size={17} /> 새 기록
        </Link>
      </header>
      {visits.length ? (
        <CompareSelector visits={visits} />
      ) : (
        <section className="empty-state">
          <span>01</span>
          <h2>첫 카페를 관찰해 보세요.</h2>
          <p>좌석과 고객 상황을 기록하면 예상 매출을 바로 계산합니다.</p>
          <Link className="primary-button" href="/visits/new">
            첫 기록 만들기
          </Link>
        </section>
      )}
    </main>
  );
}
