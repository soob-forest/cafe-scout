const FALLBACK_RETURN_TO = "/visits";

export function safeReturnTo(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return FALLBACK_RETURN_TO;
  }

  try {
    const parsed = new URL(value, "https://cafe-scout.invalid");
    return parsed.origin === "https://cafe-scout.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : FALLBACK_RETURN_TO;
  } catch {
    return FALLBACK_RETURN_TO;
  }
}
