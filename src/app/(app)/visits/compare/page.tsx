import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { formatCompactKrw, formatKrw, formatSeoulDate } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getCompareVisits, RepositoryError } from "@/features/visits/repository";
import type { VisitRecord } from "@/features/visits/types";

export const dynamic = "force-dynamic";

const idsSchema = z
  .array(z.string().uuid())
  .min(2)
  .max(3)
  .refine((ids) => new Set(ids).size === ids.length);

type Cell = { main: string; secondary?: string };
type Row = { label: string; cell: (visit: VisitRecord) => Cell };

function salesCell(base: number | null, low: number | null, high: number | null): Cell {
  if (base === null) return { main: "-" };
  return { main: formatCompactKrw(base), secondary: `${formatKrw(low)} — ${formatKrw(high)}` };
}

const rows: Row[] = [
  {
    label: "좌석",
    cell: (visit) => ({ main: visit.snapshot?.seat_count ? `${visit.snapshot.seat_count}석` : "-" }),
  },
  { label: "객단가", cell: (visit) => ({ main: formatKrw(visit.snapshot?.estimated_average_spend) }) },
  {
    label: "점유율",
    cell: (visit) => ({
      main:
        visit.snapshot?.occupancy_rate === null || visit.snapshot?.occupancy_rate === undefined
          ? "-"
          : `${visit.snapshot.occupancy_rate}%`,
    }),
  },
  {
    label: "체류시간",
    cell: (visit) => ({
      main: visit.snapshot?.average_stay_minutes ? `${visit.snapshot.average_stay_minutes}분` : "-",
    }),
  },
  {
    label: "일매출",
    cell: (visit) =>
      salesCell(
        visit.snapshot?.estimated_daily_sales_base ?? null,
        visit.snapshot?.estimated_daily_sales_low ?? null,
        visit.snapshot?.estimated_daily_sales_high ?? null,
      ),
  },
  {
    label: "월매출",
    cell: (visit) =>
      salesCell(
        visit.snapshot?.estimated_monthly_sales_base ?? null,
        visit.snapshot?.estimated_monthly_sales_low ?? null,
        visit.snapshot?.estimated_monthly_sales_high ?? null,
      ),
  },
  { label: "공간 평점", cell: (visit) => ({ main: visit.space_rating ? `${visit.space_rating} / 5` : "-" }) },
  { label: "메뉴 평점", cell: (visit) => ({ main: visit.menu_rating ? `${visit.menu_rating} / 5` : "-" }) },
];

function InvalidCompare({ message }: { message: string }) {
  return (
    <main className="page-shell">
      <Link className="back-link" href="/visits">
        <ArrowLeft size={16} /> 방문 기록
      </Link>
      <section className="empty-state">
        <span>COMPARE</span>
        <h1>비교할 수 없습니다.</h1>
        <p>{message}</p>
        <Link className="primary-button" href="/visits">
          다시 선택하기
        </Link>
      </section>
    </main>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.ids) ? params.ids.join(",") : (params.ids ?? "");
  const parsed = idsSchema.safeParse(raw.split(",").filter(Boolean));
  if (!parsed.success) return <InvalidCompare message="서로 다른 방문 기록을 2~3개 선택해 주세요." />;
  const { supabase } = await requireUser(`/visits/compare?ids=${raw}`);
  let visits: VisitRecord[];
  try {
    visits = await getCompareVisits(supabase, parsed.data);
  } catch (error) {
    return (
      <InvalidCompare
        message={error instanceof RepositoryError ? error.message : "선택한 기록을 불러오지 못했습니다."}
      />
    );
  }

  return (
    <main className="page-shell compare-page">
      <Link className="back-link" href="/visits">
        <ArrowLeft size={16} /> 선택으로 돌아가기
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">SIDE BY SIDE</p>
          <h1>방문 기록 비교</h1>
          <p>같은 기준으로 관찰한 매장의 구조를 나란히 살펴보세요.</p>
        </div>
      </header>
      <div
        className="compare-scroll"
        tabIndex={0}
        aria-label="방문 기록 비교표. 모바일에서는 가로로 스크롤할 수 있습니다."
      >
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">비교 항목</th>
              {visits.map((visit) => (
                <th scope="col" key={visit.id}>
                  <Link href={`/visits/${visit.id}`}>
                    <strong>{visit.cafe.name}</strong>
                    <span>{visit.cafe.region}</span>
                    <small>{formatSeoulDate(visit.visited_at)}</small>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {visits.map((visit) => {
                  const value = row.cell(visit);
                  return (
                    <td key={visit.id}>
                      <strong>{value.main}</strong>
                      {value.secondary && <small>{value.secondary}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
