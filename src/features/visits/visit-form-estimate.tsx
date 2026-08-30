"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { EstimationResult } from "@/domain/types";
import { confidenceDots, formatCompactKrw, formatKrw, formatNumber } from "@/lib/format";
import { useVisitForm } from "./visit-form-context";

export function VisitFormEstimate() {
  const mobileLayout = useMobileLayout();
  return (
    <aside className="estimate-sidebar">
      <div className="estimate-card">
        {mobileLayout ? (
          <MobileEstimateAction />
        ) : (
          <>
            <EstimateHeading />
            <EstimateBody />
            <EstimateConfidence />
            <EstimateMessage />
            <SaveButton />
            <p className="disclaimer">현장 관찰을 기반으로 한 추정치이며 실제 재무 데이터가 아닙니다.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function EstimateHeading() {
  const { estimate } = useVisitForm();
  return (
    <div className="estimate-title">
      <div>
        <p className="eyebrow">LIVE ESTIMATE</p>
        <h2>예상 매출</h2>
      </div>
      <span className={`confidence-pill confidence-${estimate.confidenceLevel.toLowerCase()}`}>
        {confidenceDots(estimate.confidenceLevel)}
      </span>
    </div>
  );
}

function EstimateBody() {
  const { estimate } = useVisitForm();
  if (!estimate.canEstimate) {
    return (
      <div className="estimate-missing">
        <strong>추정 불가</strong>
        <p>아래 값을 채우면 즉시 계산합니다.</p>
        <ul>
          {estimate.missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <>
      <EstimateRates estimate={estimate} />
      <EstimateScenarios estimate={estimate} />
      <EstimateInputs estimate={estimate} />
    </>
  );
}

function EstimateRates({ estimate }: { estimate: EstimationResult }) {
  return (
    <div className="metric-pair">
      <div>
        <span>시간당 회전율</span>
        <strong>{estimate.estimatedSeatTurnsPerHour?.toFixed(2)}회</strong>
      </div>
      <div>
        <span>시간당 고객</span>
        <strong>{estimate.estimatedCustomersPerHour?.toFixed(1)}명</strong>
      </div>
    </div>
  );
}

function EstimateScenarios({ estimate }: { estimate: EstimationResult }) {
  return (
    <div className="scenario-table">
      <div className="scenario-head">
        <span></span>
        <span>보수</span>
        <span>기준</span>
        <span>활황</span>
      </div>
      <ScenarioRow label="일 방문객" values={scenarioValues(estimate, "customers", formatNumber)} />
      <ScenarioRow label="일매출" values={scenarioValues(estimate, "dailySales", formatCompactKrw)} />
      <ScenarioRow label="월매출" values={scenarioValues(estimate, "monthlySales", formatCompactKrw)} />
    </div>
  );
}

function ScenarioRow({ label, values }: { label: string; values: [string, string, string] }) {
  return (
    <div>
      <b>{label}</b>
      <span>{values[0]}</span>
      <span className="featured">{values[1]}</span>
      <span>{values[2]}</span>
    </div>
  );
}

function scenarioValues(
  estimate: EstimationResult,
  key: "customers" | "dailySales" | "monthlySales",
  format: (value: number | null | undefined) => string,
): [string, string, string] {
  return ["low", "base", "high"].map((level) =>
    format(estimate.scenarios[level as "low" | "base" | "high"]?.[key]),
  ) as [string, string, string];
}

function EstimateInputs({ estimate }: { estimate: EstimationResult }) {
  const { form } = useVisitForm();
  return (
    <div className="estimate-detail">
      <span>적용 객단가</span>
      <b>{formatKrw(form.estimatedAverageSpend)}</b>
      <span>테이크아웃 보정</span>
      <b>+{Math.round(estimate.takeoutAdjustmentRate * 100)}%</b>
    </div>
  );
}

function EstimateConfidence() {
  const { estimate } = useVisitForm();
  return (
    <div className="confidence-explain">
      <span>신뢰도 {estimate.confidenceScore}/100</span>
      <small>입력 항목과 관찰 시간으로 자동 계산</small>
    </div>
  );
}

function EstimateMessage() {
  const { message } = useVisitForm();
  if (!message) return null;
  return (
    <p className="form-error save-message" role="alert">
      {message}
    </p>
  );
}

function MobileEstimateAction() {
  const { estimate } = useVisitForm();
  return (
    <>
      <EstimateMessage />
      <div className="mobile-estimate-summary" aria-live="polite">
        <span>기준 예상 일매출</span>
        <strong>
          {estimate.canEstimate ? formatCompactKrw(estimate.scenarios.base?.dailySales) : "입력 대기"}
        </strong>
      </div>
      <SaveButton />
    </>
  );
}

function SaveButton() {
  const { saving, photoPreparationPending, photoMutationPending } = useVisitForm();
  return (
    <button
      className="save-button"
      type="submit"
      disabled={saving || photoPreparationPending || photoMutationPending}
    >
      <Save size={18} />
      {saving ? "저장 중…" : "저장"}
    </button>
  );
}

function useMobileLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
