import { Check, Minus, Plus } from "lucide-react";

type CounterInputProps = {
  fieldId: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number | null) => void;
  error?: string;
};

type ChipGroupProps<T extends string> = {
  fieldId: string;
  label: string;
  values: readonly T[];
  selected: string[];
  max: number;
  onChange: (values: string[]) => void;
  error?: string;
};

type RatingFieldProps = {
  fieldId: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
};

export function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}

export function CounterInput({
  fieldId,
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  error,
}: CounterInputProps) {
  const adjust = (amount: number) => onChange(Math.min(max, Math.max(min, (value ?? min) + amount)));
  return (
    <div className="counter-field">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => adjust(-1)} aria-label={`${label} 감소`}>
          <Minus size={15} />
        </button>
        <input
          id={fieldId}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(event) => onChange(numberOrNull(event.target.value))}
        />
        <b>{suffix}</b>
        <button type="button" onClick={() => adjust(1)} aria-label={`${label} 증가`}>
          <Plus size={15} />
        </button>
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

export function ChipGroup<T extends string>({
  fieldId,
  label,
  values,
  selected,
  max,
  onChange,
  error,
}: ChipGroupProps<T>) {
  return (
    <fieldset
      className="chip-field"
      id={fieldId}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${fieldId}-error` : undefined}
    >
      <legend>
        {label}
        <small>최대 {max}개</small>
      </legend>
      <div className="chip-row">
        {values.map((value) => (
          <ChipButton key={value} value={value} selected={selected} max={max} onChange={onChange} />
        ))}
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </fieldset>
  );
}

function ChipButton({
  value,
  selected,
  max,
  onChange,
}: {
  value: string;
  selected: string[];
  max: number;
  onChange: (values: string[]) => void;
}) {
  const active = selected.includes(value);
  const toggle = () =>
    onChange(
      active
        ? selected.filter((item) => item !== value)
        : selected.length < max
          ? [...selected, value]
          : selected,
    );
  return (
    <button type="button" className={active ? "active" : ""} aria-pressed={active} onClick={toggle}>
      {active && <Check size={13} />}
      {value}
    </button>
  );
}

export function RatingField({ fieldId, label, value, onChange, error }: RatingFieldProps) {
  return (
    <fieldset
      className="rating-field"
      id={fieldId}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${fieldId}-error` : undefined}
    >
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            type="button"
            key={rating}
            aria-label={`${label} ${rating}점`}
            aria-pressed={value === rating}
            onClick={() => onChange(value === rating ? null : rating)}
          >
            {rating <= (value ?? 0) ? "★" : "☆"}
          </button>
        ))}
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </fieldset>
  );
}
