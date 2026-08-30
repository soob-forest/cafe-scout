import { SourceBadge, type SourceKind } from "@/components/source-badge";

export const VISIT_DETAIL_LABELS = {
  category: {
    COFFEE: "커피",
    NON_COFFEE: "논커피",
    DESSERT: "디저트",
    BAKERY: "베이커리",
    BRUNCH: "브런치",
    ETC: "기타",
  },
  price: { CHEAP: "저렴", NORMAL: "보통", HIGH: "높은 편", VERY_HIGH: "매우 높음" },
  takeout: { NONE: "거의 없음", LOW: "조금 있음", MEDIUM: "많음", HIGH: "매우 많음" },
} as const;

export function VisitMetric({ label, value, source }: { label: string; value: string; source: SourceKind }) {
  return (
    <div className="snapshot-metric">
      <span>
        {label} <SourceBadge source={source} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export function VisitRating({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rating-summary">
      <span>{label}</span>
      <strong>{value === null ? "-" : `${"★".repeat(value)}${"☆".repeat(5 - value)}`}</strong>
    </div>
  );
}
