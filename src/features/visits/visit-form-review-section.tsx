import { useVisitForm } from "./visit-form-context";
import { RatingField } from "./visit-form-fields";

const RATING_FIELDS = [
  ["spaceRating", "공간"],
  ["menuRating", "메뉴"],
  ["locationRating", "입지"],
  ["overallRating", "전체"],
] as const;

export function VisitFormReviewSection() {
  return (
    <section className="form-section" aria-labelledby="review-title">
      <div className="section-number">05</div>
      <div className="section-content">
        <h2 id="review-title">분위기 / 평가 / 메모</h2>
        <ReviewRatings />
        <ReviewNote field="strengths" label="잘한 점" placeholder="동선, 메뉴 구성, 고객 경험에서 잘한 점" />
        <ReviewNote
          field="adoptablePoints"
          label="가져오고 싶은 점"
          placeholder="내 카페에 적용하고 싶은 구체적인 요소"
        />
      </div>
    </section>
  );
}

function ReviewRatings() {
  const { form, update, errorFor, fieldId } = useVisitForm();
  return (
    <div className="rating-grid">
      {RATING_FIELDS.map(([field, label]) => (
        <RatingField
          key={field}
          fieldId={fieldId(field)}
          label={label}
          value={form[field]}
          onChange={(value) => update(field, value)}
          error={errorFor(field)}
        />
      ))}
    </div>
  );
}

function ReviewNote({
  field,
  label,
  placeholder,
}: {
  field: "strengths" | "adoptablePoints";
  label: string;
  placeholder: string;
}) {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  const value = form[field] ?? "";
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        id={fieldId(field)}
        maxLength={500}
        rows={4}
        value={value}
        onChange={(event) => update(field, event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(errorFor(field))}
        aria-describedby={errorDescriptionId(field)}
      />
      <small id={`${fieldId(field)}-error`}>{errorFor(field) ?? `${value.length}/500`}</small>
    </label>
  );
}
