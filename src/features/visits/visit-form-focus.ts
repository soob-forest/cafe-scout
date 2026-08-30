import type { RefObject } from "react";

export function focusValidationError(
  errorKey: string | undefined,
  summaryRef: RefObject<HTMLDivElement | null>,
  attempt = 0,
) {
  window.setTimeout(
    () => {
      const target = errorKey ? document.getElementById(`visit-${errorKey}`) : null;
      if (target instanceof HTMLElement && !target.matches(":disabled")) {
        target.focus();
        target.scrollIntoView?.({ block: "center" });
        return;
      }
      if (attempt < 4) {
        focusValidationError(errorKey, summaryRef, attempt + 1);
        return;
      }
      summaryRef.current?.focus();
    },
    attempt === 0 ? 0 : 16,
  );
}
