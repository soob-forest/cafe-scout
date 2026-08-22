export default function AppLoading() {
  return (
    <main className="page-shell" aria-busy="true" aria-live="polite">
      <div className="page-heading skeleton-block" />
      <div className="visit-grid">
        {[0, 1, 2].map((item) => (
          <div className="visit-card skeleton-card" key={item} />
        ))}
      </div>
      <span className="sr-only">방문 기록을 불러오는 중입니다.</span>
    </main>
  );
}
