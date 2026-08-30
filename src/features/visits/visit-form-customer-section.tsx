import { STAY_PRESETS } from "@/domain/types";
import { CounterInput } from "./visit-form-fields";
import { VISIT_FORM_LABELS } from "./visit-form-labels";
import { useVisitForm } from "./visit-form-context";

export function VisitFormCustomerSection() {
  return (
    <section className="form-section" aria-labelledby="customer-title">
      <div className="section-number">03</div>
      <div className="section-content">
        <h2 id="customer-title">좌석 / 고객</h2>
        <CapacityFields />
        <OccupancyFields />
        <StayPresetField />
      </div>
    </section>
  );
}

function CapacityFields() {
  const { form, update, errorFor, fieldId } = useVisitForm();
  return (
    <div className="counter-grid">
      <CounterInput
        fieldId={fieldId("tableCount")}
        label="테이블 수"
        value={form.tableCount}
        min={0}
        max={100}
        suffix="개"
        onChange={(value) => update("tableCount", value)}
        error={errorFor("tableCount")}
      />
      <CounterInput
        fieldId={fieldId("seatCount")}
        label="좌석 수"
        value={form.seatCount}
        min={1}
        max={300}
        suffix="석"
        onChange={(value) => update("seatCount", value)}
        error={errorFor("seatCount")}
      />
    </div>
  );
}

function OccupancyFields() {
  const { form, estimate, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  const useRate = form.occupancyInputMode === "RATE";
  return (
    <>
      <div
        className="segmented"
        id={fieldId("occupancyInputMode")}
        tabIndex={-1}
        aria-invalid={Boolean(errorFor("occupancyInputMode"))}
        aria-describedby={errorDescriptionId("occupancyInputMode")}
      >
        <OccupancyModeButton mode="CUSTOMERS" active={!useRate} />
        <OccupancyModeButton mode="RATE" active={useRate} />
      </div>
      {errorFor("occupancyInputMode") && (
        <small className="inline-error" id={`${fieldId("occupancyInputMode")}-error`}>
          {errorFor("occupancyInputMode")}
        </small>
      )}
      <CounterInput
        fieldId={fieldId(useRate ? "occupancyRate" : "currentCustomers")}
        label={useRate ? "현재 점유율" : "현재 고객"}
        value={useRate ? form.occupancyRate : form.currentCustomers}
        min={0}
        max={useRate ? 100 : 500}
        suffix={useRate ? "%" : "명"}
        onChange={(value) => update(useRate ? "occupancyRate" : "currentCustomers", value)}
        error={errorFor(useRate ? "occupancyRate" : "currentCustomers")}
      />
      <div className="occupancy-readout">
        <span>
          계산 점유율 <i className="source-badge calculated">시스템 계산</i>
        </span>
        <strong>{occupancyLabel(estimate.isOverCapacity, estimate.occupancyRate)}</strong>
      </div>
    </>
  );
}

function OccupancyModeButton({ mode, active }: { mode: "CUSTOMERS" | "RATE"; active: boolean }) {
  const { update } = useVisitForm();
  const selectMode = () => {
    update("occupancyInputMode", mode);
    update(mode === "RATE" ? "currentCustomers" : "occupancyRate", null);
  };
  return (
    <button type="button" className={active ? "active" : ""} onClick={selectMode}>
      {mode === "RATE" ? "점유율로 입력" : "고객 수로 입력"}
    </button>
  );
}

function StayPresetField() {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <fieldset
      className="choice-field"
      id={fieldId("averageStayPreset")}
      tabIndex={-1}
      aria-invalid={Boolean(errorFor("averageStayPreset"))}
      aria-describedby={errorDescriptionId("averageStayPreset")}
    >
      <legend>
        평균 체류시간 <span className="source-badge user-estimate">사용자 추정</span>
      </legend>
      <div className="choice-grid five">
        {STAY_PRESETS.map((value) => (
          <button
            type="button"
            key={value}
            className={form.averageStayPreset === value ? "active" : ""}
            onClick={() => update("averageStayPreset", value)}
          >
            {VISIT_FORM_LABELS.stay[value]}
          </button>
        ))}
      </div>
      {errorFor("averageStayPreset") && (
        <small className="inline-error" id={`${fieldId("averageStayPreset")}-error`}>
          {errorFor("averageStayPreset")}
        </small>
      )}
    </fieldset>
  );
}

function occupancyLabel(isOverCapacity: boolean, rate: number | null) {
  if (isOverCapacity) return "100%+";
  return rate === null ? "-" : `${rate}%`;
}
