import type { ObservationBucket } from "./types";

const BUCKETS = [
  { key: "00-06", label: "00~06시", start: 0, end: 6 },
  { key: "06-11", label: "06~11시", start: 6, end: 11 },
  { key: "11-14", label: "11~14시", start: 11, end: 14 },
  { key: "14-17", label: "14~17시", start: 14, end: 17 },
  { key: "17-20", label: "17~20시", start: 17, end: 20 },
  { key: "20-24", label: "20~24시", start: 20, end: 24 },
] as const;

export function getSeoulHour(isoDate: string): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(isoDate))
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

export function groupOccupancyObservations(
  observations: Array<{ observed_at: string; occupancy_rate: number | null }>,
): ObservationBucket[] {
  return BUCKETS.flatMap((bucket) => {
    const values = observations
      .filter((item) => {
        const hour = getSeoulHour(item.observed_at);
        return hour >= bucket.start && hour < bucket.end && item.occupancy_rate !== null;
      })
      .map((item) => item.occupancy_rate!);
    if (values.length === 0) return [];
    return [
      {
        key: bucket.key,
        label: bucket.label,
        averageOccupancyRate: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        count: values.length,
      },
    ];
  });
}
