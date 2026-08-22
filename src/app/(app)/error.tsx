"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="error-state" role="alert">
        <p className="eyebrow">CONNECTION INTERRUPTED</p>
        <h1>기록을 불러오지 못했습니다.</h1>
        <p>네트워크 연결이나 Supabase 프로젝트 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button className="primary-button" type="button" onClick={reset}>
          다시 시도
        </button>
      </section>
    </main>
  );
}
