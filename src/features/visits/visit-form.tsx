"use client";

import { VISIT_FIELD_LABELS } from "@/lib/validation/visit";
import { VisitFormBasicSection } from "./visit-form-basic-section";
import { VisitFormProvider } from "./visit-form-context";
import { VisitFormCustomerSection } from "./visit-form-customer-section";
import { VisitFormEstimate } from "./visit-form-estimate";
import { VisitFormMenuSection } from "./visit-form-menu-section";
import { VisitFormOperationSection } from "./visit-form-operation-section";
import { VisitFormReviewSection } from "./visit-form-review-section";
import { useVisitFormController, type VisitFormControllerProps } from "./use-visit-form-controller";

export function VisitForm(props: VisitFormControllerProps) {
  const { model, submit, fieldErrors, errorSummaryRef } = useVisitFormController(props);
  return (
    <VisitFormProvider value={model}>
      <form onSubmit={submit} className="visit-form" noValidate aria-busy={model.saving}>
        <fieldset className="form-lock" disabled={model.saving}>
          <div className="form-main">
            <header className="form-heading">
              <p className="eyebrow">FIELD ENTRY</p>
              <h1>{props.visitId ? "방문 기록 수정" : "새 방문 기록"}</h1>
              <p>관찰한 사실과 판단한 추정을 차근차근 구분해 기록하세요.</p>
            </header>
            <ValidationSummary fieldErrors={fieldErrors} summaryRef={errorSummaryRef} />
            <VisitFormBasicSection />
            <VisitFormMenuSection />
            <VisitFormCustomerSection />
            <VisitFormOperationSection />
            <VisitFormReviewSection />
          </div>
          <VisitFormEstimate />
        </fieldset>
      </form>
    </VisitFormProvider>
  );
}

function ValidationSummary({
  fieldErrors,
  summaryRef,
}: {
  fieldErrors: Record<string, string[]>;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (Object.keys(fieldErrors).length === 0) return null;
  return (
    <div className="field-error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
      <strong>확인이 필요한 입력이 있습니다.</strong>
      <ul>
        {Object.entries(fieldErrors).flatMap(([key, errors]) =>
          errors.map((error) => (
            <li key={`${key}-${error}`}>
              <a
                href={`#visit-${key}`}
                onClick={() => window.setTimeout(() => document.getElementById(`visit-${key}`)?.focus(), 0)}
              >
                {VISIT_FIELD_LABELS[key] ? `${VISIT_FIELD_LABELS[key]}: ` : ""}
                {error}
              </a>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
