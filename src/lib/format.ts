const krw = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ko-KR");
const seoulDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatKrw = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : krw.format(value);
export const formatCompactKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "추정 불가";
  if (value >= 10_000) return `약 ${number.format(Math.round(value / 10_000))}만원`;
  return krw.format(value);
};
export const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : number.format(value);
export const formatSeoulDate = (value: string | Date) =>
  seoulDate.format(typeof value === "string" ? new Date(value) : value);
export const confidenceDots = (level: string | null | undefined) =>
  level === "HIGH" ? "●●●" : level === "MEDIUM" ? "●●○" : "●○○";
