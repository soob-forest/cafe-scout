"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import type { VisitListItem } from "./types";
import { confidenceDots, formatCompactKrw, formatSeoulDate } from "@/lib/format";

function primaryRating(visit: VisitListItem) {
  if (visit.overall_rating)
    return `${"★".repeat(visit.overall_rating)}${"☆".repeat(5 - visit.overall_rating)}`;
  const values = [visit.space_rating, visit.menu_rating].filter((value): value is number => value !== null);
  return values.length
    ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)} / 5`
    : "평점 없음";
}

export function CompareSelector({ visits }: { visits: VisitListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const countLabel = useMemo(() => `${selected.length}/3 선택`, [selected.length]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  };

  return (
    <>
      <div className="visit-grid">
        {visits.map((visit) => {
          const checked = selected.includes(visit.id);
          const representative = [...visit.photos].sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "GENERAL" ? -1 : 1;
            return a.sort_order - b.sort_order;
          })[0];
          return (
            <article className={`visit-card ${checked ? "selected" : ""}`} key={visit.id}>
              <button
                type="button"
                className="compare-check"
                aria-pressed={checked}
                aria-label={`${visit.cafe.name} 비교 ${checked ? "해제" : "선택"}`}
                onClick={() => toggle(visit.id)}
                disabled={!checked && selected.length >= 3}
              >
                {checked && <Check size={15} />}
              </button>
              <a href={`/visits/${visit.id}`} className="visit-card-link">
                <div className="visit-thumb">
                  {representative?.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={representative.signedUrl} alt={`${visit.cafe.name} 대표 사진`} />
                  ) : (
                    <div className="photo-fallback">
                      <span>{visit.cafe.name.slice(0, 1)}</span>
                    </div>
                  )}
                  <span
                    className={`confidence-pill confidence-${visit.snapshot?.confidence_level?.toLowerCase() ?? "low"}`}
                  >
                    {confidenceDots(visit.snapshot?.confidence_level)}
                  </span>
                </div>
                <div className="visit-card-body">
                  <div className="visit-card-meta">
                    <span>{visit.cafe.region}</span>
                    <span>{formatSeoulDate(visit.visited_at)}</span>
                  </div>
                  <h2>{visit.cafe.name}</h2>
                  <div className="visit-card-result">
                    <span>기준 예상 일매출</span>
                    <strong>{formatCompactKrw(visit.snapshot?.estimated_daily_sales_base)}</strong>
                  </div>
                  <div className="visit-card-rating">{primaryRating(visit)}</div>
                </div>
              </a>
            </article>
          );
        })}
      </div>
      <div className={`compare-bar ${selected.length ? "visible" : ""}`} aria-live="polite">
        <span>{countLabel}</span>
        <p>{selected.length < 2 ? "기록을 하나 더 선택하세요." : "선택한 방문의 구조를 나란히 봅니다."}</p>
        <button
          type="button"
          disabled={selected.length < 2}
          onClick={() => router.push(`/visits/compare?ids=${selected.join(",")}`)}
        >
          비교하기 <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
