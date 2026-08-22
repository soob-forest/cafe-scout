import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, Pencil, Users } from "lucide-react";
import { SourceBadge, type SourceKind } from "@/components/source-badge";
import { estimateBusiness } from "@/domain/business-estimator";
import { formatCompactKrw, formatKrw, formatSeoulDate, confidenceDots } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getVisit } from "@/features/visits/repository";
import { DeleteVisitButton } from "@/features/visits/detail-actions";
import { PhotoGallery } from "@/features/visits/photo-gallery";
import { ObservationManager } from "@/features/visits/observation-manager";

export const dynamic = "force-dynamic";

const categoryLabels = {
  COFFEE: "커피",
  NON_COFFEE: "논커피",
  DESSERT: "디저트",
  BAKERY: "베이커리",
  BRUNCH: "브런치",
  ETC: "기타",
} as const;
const priceLabels = { CHEAP: "저렴", NORMAL: "보통", HIGH: "높은 편", VERY_HIGH: "매우 높음" } as const;
const takeoutLabels = { NONE: "거의 없음", LOW: "조금 있음", MEDIUM: "많음", HIGH: "매우 많음" } as const;

function Metric({ label, value, source }: { label: string; value: string; source: SourceKind }) {
  return (
    <div className="snapshot-metric">
      <span>
        {label} <SourceBadge source={source} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function Rating({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rating-summary">
      <span>{label}</span>
      <strong>{value === null ? "-" : `${"★".repeat(value)}${"☆".repeat(5 - value)}`}</strong>
    </div>
  );
}

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/visits/${id}`);
  const visit = await getVisit(supabase, id);
  if (!visit) notFound();
  const snapshot = visit.snapshot;
  const estimate = estimateBusiness({
    seatCount: snapshot?.seat_count ?? null,
    currentCustomers: snapshot?.current_customers ?? null,
    occupancyRate: snapshot?.occupancy_rate ?? null,
    averageStayMinutes: snapshot?.average_stay_minutes ?? null,
    estimatedAverageSpend: snapshot?.estimated_average_spend ?? null,
    openTime: snapshot?.open_time ?? null,
    closeTime: snapshot?.close_time ?? null,
    operatingDaysPerMonth: snapshot?.operating_days_per_month ?? null,
    takeoutLevel: snapshot?.takeout_level ?? null,
    observedTakeoutOrders: snapshot?.observed_takeout_orders ?? null,
    observationDurationMinutes: visit.observation_duration_minutes,
  });
  const occupancySource: SourceKind =
    snapshot?.occupancy_input_mode === "CUSTOMERS" ? "calculated" : "observed";
  const sortedPhotos = [...visit.photos].sort((a, b) =>
    a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "GENERAL" ? -1 : 1,
  );

  return (
    <main className="page-shell detail-page">
      <Link className="back-link" href="/visits">
        <ArrowLeft size={16} /> 방문 기록
      </Link>
      <header className="detail-heading">
        <div>
          <p className="eyebrow">FIELD REPORT · {formatSeoulDate(visit.visited_at)}</p>
          <h1>{visit.cafe.name}</h1>
          <p>
            <MapPin size={15} /> {visit.cafe.region}
            {visit.observation_duration_minutes && (
              <>
                {" "}
                · <Clock3 size={15} /> {visit.observation_duration_minutes}분 관찰
              </>
            )}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="secondary-button" href={`/visits/${id}/edit`}>
            <Pencil size={15} /> 수정
          </Link>
          <DeleteVisitButton visitId={id} cafeName={visit.cafe.name} />
        </div>
      </header>

      <section className="business-snapshot" aria-labelledby="snapshot-title">
        <div className="snapshot-heading">
          <div>
            <p className="eyebrow light">BUSINESS SNAPSHOT</p>
            <h2 id="snapshot-title">숫자로 본 오늘의 매장</h2>
          </div>
          <span
            className={`confidence-large confidence-${snapshot?.confidence_level?.toLowerCase() ?? "low"}`}
          >
            <b>{confidenceDots(snapshot?.confidence_level)}</b>
            <small>신뢰도 {snapshot?.confidence_score ?? 0}/100</small>
          </span>
        </div>
        {!estimate.canEstimate ? (
          <div className="snapshot-unavailable">
            <strong>매출 추정 불가</strong>
            <p>
              {estimate.missingFields.join(", ")} 입력이 필요합니다. 기록 내용은 그대로 확인할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="sales-highlight">
            <div>
              <span>예상 일매출 범위</span>
              <strong>
                {formatCompactKrw(snapshot?.estimated_daily_sales_low)} —{" "}
                {formatCompactKrw(snapshot?.estimated_daily_sales_high)}
              </strong>
            </div>
            <div>
              <span>기준 예상 일매출</span>
              <strong>{formatKrw(snapshot?.estimated_daily_sales_base)}</strong>
            </div>
            <div>
              <span>기준 예상 월매출</span>
              <strong>{formatCompactKrw(snapshot?.estimated_monthly_sales_base)}</strong>
            </div>
          </div>
        )}
        <div className="snapshot-metrics">
          <Metric
            label="좌석"
            value={
              snapshot?.seat_count === null || snapshot?.seat_count === undefined
                ? "-"
                : `${snapshot.seat_count}석`
            }
            source="observed"
          />
          <Metric label="객단가" value={formatKrw(snapshot?.estimated_average_spend)} source="estimated" />
          <Metric
            label="점유율"
            value={
              snapshot?.occupancy_rate === null || snapshot?.occupancy_rate === undefined
                ? "-"
                : snapshot.current_customers !== null &&
                    snapshot.seat_count !== null &&
                    snapshot.current_customers > snapshot.seat_count
                  ? "100%+"
                  : `${snapshot.occupancy_rate}%`
            }
            source={occupancySource}
          />
          <Metric
            label="평균 체류"
            value={snapshot?.average_stay_minutes ? `${snapshot.average_stay_minutes}분` : "-"}
            source="estimated"
          />
        </div>
        <p className="snapshot-disclaimer">
          현장 관찰에 기반한 구조적 추정치이며 실제 재무 실적이 아닙니다. 모델{" "}
          {snapshot?.estimation_model_version ?? "mvp-v1"}
        </p>
      </section>

      <div className="detail-blocks">
        <section className="detail-block">
          <div className="block-index">01</div>
          <div>
            <h2>공간</h2>
            <div className="fact-grid">
              <Metric
                label="테이블"
                value={
                  snapshot?.table_count === null || snapshot?.table_count === undefined
                    ? "-"
                    : `${snapshot.table_count}개`
                }
                source="observed"
              />
              <Metric
                label="좌석"
                value={snapshot?.seat_count ? `${snapshot.seat_count}석` : "-"}
                source="observed"
              />
              <Metric
                label="가격 수준"
                value={snapshot?.price_level ? priceLabels[snapshot.price_level] : "-"}
                source="estimated"
              />
            </div>
            <div className="rating-summaries">
              <Rating label="공간" value={visit.space_rating} />
              <Rating label="입지" value={visit.location_rating} />
              <Rating label="전체" value={visit.overall_rating} />
            </div>
            {visit.mood_tags.length > 0 && (
              <div className="tag-list">
                {visit.mood_tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="detail-block">
          <div className="block-index">02</div>
          <div>
            <h2>메뉴</h2>
            {visit.menus.length ? (
              <div className="detail-menu-list">
                {visit.menus.map((menu) => (
                  <div key={menu.id}>
                    <span>{categoryLabels[menu.category]}</span>
                    <strong>
                      {menu.name}
                      {menu.is_signature && <i>Signature</i>}
                    </strong>
                    <b>{formatKrw(menu.price)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-empty-text">입력한 대표 메뉴가 없습니다.</p>
            )}
            <Rating label="메뉴" value={visit.menu_rating} />
          </div>
        </section>

        <section className="detail-block">
          <div className="block-index">03</div>
          <div>
            <h2>고객</h2>
            <div className="fact-grid">
              <Metric
                label="현재 고객"
                value={
                  snapshot?.current_customers === null || snapshot?.current_customers === undefined
                    ? "-"
                    : `${snapshot.current_customers}명`
                }
                source="observed"
              />
              <Metric
                label="시간당 예상 고객"
                value={
                  snapshot?.estimated_customers_per_hour === null ||
                  snapshot?.estimated_customers_per_hour === undefined
                    ? "-"
                    : `${Number(snapshot.estimated_customers_per_hour).toFixed(1)}명`
                }
                source="calculated"
              />
              <Metric
                label="테이크아웃"
                value={
                  snapshot?.observed_takeout_orders !== null &&
                  snapshot?.observed_takeout_orders !== undefined
                    ? `${snapshot.observed_takeout_orders}건 / 15분`
                    : snapshot?.takeout_level
                      ? takeoutLabels[snapshot.takeout_level]
                      : "-"
                }
                source={
                  snapshot?.observed_takeout_orders !== null &&
                  snapshot?.observed_takeout_orders !== undefined
                    ? "observed"
                    : "estimated"
                }
              />
            </div>
            {visit.customer_types.length > 0 && (
              <div className="tag-list">
                {visit.customer_types.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            <div className="subsection-heading">
              <div>
                <p className="eyebrow">P1 · OCCUPANCY LOG</p>
                <h3>시간대별 추가 관찰</h3>
              </div>
              <Users size={22} />
            </div>
            <ObservationManager
              visitId={id}
              initial={visit.observations}
              hasSeatCount={Boolean(snapshot?.seat_count)}
            />
          </div>
        </section>

        <section className="detail-block">
          <div className="block-index">04</div>
          <div>
            <h2>사진</h2>
            <PhotoGallery photos={sortedPhotos} cafeName={visit.cafe.name} />
          </div>
        </section>
        <section className="detail-block prose-block">
          <div className="block-index">05</div>
          <div>
            <h2>잘한 점</h2>
            <p>{visit.strengths || "기록된 내용이 없습니다."}</p>
          </div>
        </section>
        <section className="detail-block prose-block">
          <div className="block-index">06</div>
          <div>
            <h2>가져오고 싶은 점</h2>
            <p>{visit.adoptable_points || "기록된 내용이 없습니다."}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
