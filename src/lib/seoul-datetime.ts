const SEOUL_OFFSET = "+09:00";
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function toSeoulLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");
}

export function seoulLocalDateTimeToIso(value: string): string | null {
  if (!LOCAL_DATE_TIME.test(value)) return null;
  const date = new Date(`${value}:00${SEOUL_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
