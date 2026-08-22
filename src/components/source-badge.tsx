export type SourceKind = "observed" | "estimated" | "calculated";

const labels: Record<SourceKind, string> = {
  observed: "관찰",
  estimated: "사용자 추정",
  calculated: "시스템 계산",
};

export function SourceBadge({ source }: { source: SourceKind }) {
  return (
    <span className={`source-badge ${source === "estimated" ? "user-estimate" : source}`}>
      {labels[source]}
    </span>
  );
}
