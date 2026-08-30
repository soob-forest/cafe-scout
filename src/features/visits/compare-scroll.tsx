"use client";

import type { KeyboardEvent, ReactNode } from "react";

const SCROLL_STEP_RATIO = 0.7;

export function CompareScroll({ children }: { children: ReactNode }) {
  return (
    <div
      className="compare-scroll"
      tabIndex={0}
      aria-label="방문 기록 비교표. 모바일에서는 가로로 스크롤할 수 있습니다."
      aria-describedby="compare-scroll-help"
      onKeyDown={scrollWithArrowKey}
    >
      {children}
    </div>
  );
}

function scrollWithArrowKey(event: KeyboardEvent<HTMLDivElement>) {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (direction === 0) return;
  event.preventDefault();
  event.currentTarget.scrollBy({ left: direction * event.currentTarget.clientWidth * SCROLL_STEP_RATIO });
}
