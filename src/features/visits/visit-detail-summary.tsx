import Link from "next/link";
import { Clock3, MapPin, Pencil } from "lucide-react";
import type { SourceKind } from "@/components/source-badge";
import { estimateBusiness } from "@/domain/business-estimator";
import { confidenceDots, formatCompactKrw, formatKrw, formatSeoulDate } from "@/lib/format";
import { DeleteVisitButton } from "./detail-actions";
import { VisitMetric } from "./visit-detail-elements";
import type { VisitDetailRecord } from "./visit-detail-types";

export function VisitDetailHeader({ visit }: { visit: VisitDetailRecord }) {
  return (
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
        <Link className="secondary-button" href={`/visits/${visit.id}/edit`}>
          <Pencil size={15} /> 수정
        </Link>
        <DeleteVisitButton visitId={visit.id} cafeName={visit.cafe.name} />
      </div>
    </header>
  );
}

export function VisitBusinessSnapshot({ visit }: { visit: VisitDetailRecord }) {
  const estimate = buildVisitEstimate(visit);
  return (
    <section className="business-snapshot" aria-labelledby="snapshot-title">
      <SnapshotHeading visit={visit} />
      <SalesOverview visit={visit} missingFields={estimate.missingFields} />
      <SnapshotMetrics visit={visit} />
      <p className="snapshot-disclaimer">
        현장 관찰에 기반한 구조적 추정치이며 실제 재무 실적이 아닙니다. 모델{" "}
        {visit.snapshot?.estimation_model_version ?? "mvp-v1"}
      </p>
    </section>
  );
}

function SnapshotHeading({ visit }: { visit: VisitDetailRecord }) {
  const snapshot = visit.snapshot;
  return (
    <div className="snapshot-heading">
      <div>
        <p className="eyebrow light">BUSINESS SNAPSHOT</p>
        <h2 id="snapshot-title">숫자로 본 오늘의 매장</h2>
      </div>
      <span className={`confidence-large confidence-${snapshot?.confidence_level?.toLowerCase() ?? "low"}`}>
        <b>{confidenceDots(snapshot?.confidence_level)}</b>
        <small>신뢰도 {snapshot?.confidence_score ?? 0}/100</small>
      </span>
    </div>
  );
}

function SalesOverview({ visit, missingFields }: { visit: VisitDetailRecord; missingFields: string[] }) {
  const snapshot = visit.snapshot;
  if (missingFields.length > 0) {
    return (
      <div className="snapshot-unavailable">
        <strong>매출 추정 불가</strong>
        <p>{missingFields.join(", ")} 입력이 필요합니다. 기록 내용은 그대로 확인할 수 있습니다.</p>
      </div>
    );
  }
  return (
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
  );
}

function SnapshotMetrics({ visit }: { visit: VisitDetailRecord }) {
  const snapshot = visit.snapshot;
  return (
    <div className="snapshot-metrics">
      <VisitMetric label="좌석" value={seatLabel(snapshot)} source="observed" />
      <VisitMetric
        label="객단가"
        value={formatKrw(snapshot && snapshot.estimated_average_spend)}
        source="estimated"
      />
      <VisitMetric label="점유율" value={occupancyLabel(snapshot)} source={occupancySource(snapshot)} />
      <VisitMetric label="평균 체류" value={stayLabel(snapshot)} source="estimated" />
    </div>
  );
}

type Snapshot = VisitDetailRecord["snapshot"];

function buildVisitEstimate(visit: VisitDetailRecord) {
  return estimateBusiness({
    ...trafficEstimateInput(visit.snapshot),
    ...spendEstimateInput(visit.snapshot),
    ...scheduleEstimateInput(visit.snapshot),
    ...takeoutEstimateInput(visit.snapshot),
    observationDurationMinutes: visit.observation_duration_minutes,
  });
}

function trafficEstimateInput(snapshot: Snapshot) {
  return {
    seatCount: snapshot?.seat_count ?? null,
    currentCustomers: snapshot?.current_customers ?? null,
    occupancyRate: snapshot?.occupancy_rate ?? null,
    averageStayMinutes: snapshot?.average_stay_minutes ?? null,
  };
}

function spendEstimateInput(snapshot: Snapshot) {
  return {
    estimatedAverageSpend: snapshot?.estimated_average_spend ?? null,
  };
}

function scheduleEstimateInput(snapshot: Snapshot) {
  return {
    openTime: snapshot?.open_time ?? null,
    closeTime: snapshot?.close_time ?? null,
    operatingDaysPerMonth: snapshot?.operating_days_per_month ?? null,
  };
}

function takeoutEstimateInput(snapshot: Snapshot) {
  return {
    takeoutLevel: snapshot?.takeout_level ?? null,
    observedTakeoutOrders: snapshot?.observed_takeout_orders ?? null,
  };
}

function seatLabel(snapshot: Snapshot) {
  return snapshot?.seat_count == null ? "-" : `${snapshot.seat_count}석`;
}

function occupancyLabel(snapshot: Snapshot) {
  if (snapshot?.occupancy_rate == null) return "-";
  const isOverCapacity =
    snapshot.current_customers != null &&
    snapshot.seat_count != null &&
    snapshot.current_customers > snapshot.seat_count;
  return isOverCapacity ? "100%+" : `${snapshot.occupancy_rate}%`;
}

function occupancySource(snapshot: Snapshot): SourceKind {
  return snapshot?.occupancy_input_mode === "CUSTOMERS" ? "calculated" : "observed";
}

function stayLabel(snapshot: Snapshot) {
  return snapshot?.average_stay_minutes ? `${snapshot.average_stay_minutes}분` : "-";
}
