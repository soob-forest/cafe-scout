import { TAKEOUT_LEVELS } from "@/domain/types";
import { useVisitForm } from "./visit-form-context";
import { CounterInput } from "./visit-form-fields";
import { VISIT_FORM_LABELS } from "./visit-form-labels";

export function VisitFormOperationSection() {
  return (
    <section className="form-section" aria-labelledby="operation-title">
      <div className="section-number">04</div>
      <div className="section-content">
        <h2 id="operation-title">운영 / 테이크아웃</h2>
        <OperatingScheduleFields />
        <TakeoutFields />
      </div>
    </section>
  );
}

function OperatingScheduleFields() {
  const { form, estimate, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <>
      <div className="field-grid three">
        {(["openTime", "closeTime"] as const).map((field) => (
          <label className="field" key={field}>
            <span>{field === "openTime" ? "오픈" : "마감"}</span>
            <input
              id={fieldId(field)}
              type="time"
              value={form[field] ?? ""}
              onChange={(event) => update(field, event.target.value || null)}
              aria-invalid={Boolean(errorFor(field))}
              aria-describedby={errorDescriptionId(field)}
            />
            <small id={`${fieldId(field)}-error`}>{errorFor(field)}</small>
          </label>
        ))}
        <label className="field">
          <span>월 영업일</span>
          <div className="input-suffix">
            <input
              id={fieldId("operatingDaysPerMonth")}
              type="number"
              min="1"
              max="31"
              value={form.operatingDaysPerMonth}
              onChange={(event) => update("operatingDaysPerMonth", Number(event.target.value))}
              aria-invalid={Boolean(errorFor("operatingDaysPerMonth"))}
              aria-describedby={errorDescriptionId("operatingDaysPerMonth")}
            />
            <b>일</b>
          </div>
          <small id={`${fieldId("operatingDaysPerMonth")}-error`}>{errorFor("operatingDaysPerMonth")}</small>
        </label>
      </div>
      <p className="derived-note">
        총 영업시간{" "}
        <strong>{estimate.operatingHours === null ? "-" : `${estimate.operatingHours}시간`}</strong> · 자정
        이후 마감도 지원합니다.
      </p>
    </>
  );
}

function TakeoutFields() {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <>
      <fieldset
        className="choice-field"
        id={fieldId("takeoutLevel")}
        tabIndex={-1}
        aria-invalid={Boolean(errorFor("takeoutLevel"))}
        aria-describedby={errorDescriptionId("takeoutLevel")}
      >
        <legend>
          테이크아웃 수준 <span className="source-badge user-estimate">사용자 추정</span>
        </legend>
        <div className="choice-grid four">
          {TAKEOUT_LEVELS.map((value) => (
            <button
              type="button"
              key={value}
              className={form.takeoutLevel === value ? "active" : ""}
              onClick={() => update("takeoutLevel", value)}
            >
              {VISIT_FORM_LABELS.takeout[value]}
            </button>
          ))}
        </div>
        {errorFor("takeoutLevel") && (
          <small className="inline-error" id={`${fieldId("takeoutLevel")}-error`}>
            {errorFor("takeoutLevel")}
          </small>
        )}
      </fieldset>
      <CounterInput
        fieldId={fieldId("observedTakeoutOrders")}
        label="15분간 테이크아웃 주문"
        value={form.observedTakeoutOrders}
        min={0}
        max={50}
        suffix="건"
        onChange={(value) => update("observedTakeoutOrders", value)}
        error={errorFor("observedTakeoutOrders")}
      />
      {form.observedTakeoutOrders !== null && (
        <p className="derived-note">관찰 주문 수가 테이크아웃 수준보다 우선합니다.</p>
      )}
    </>
  );
}
