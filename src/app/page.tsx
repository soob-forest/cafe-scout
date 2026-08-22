import { ArrowRight, BarChart3, Coffee, MapPin } from "lucide-react";

const snapshot = [
  { label: "좌석", value: "42석" },
  { label: "점유율", value: "76%" },
  { label: "객단가", value: "9,500원" },
];

export default function HomePage() {
  return (
    <main className="welcome-shell">
      <header className="welcome-nav">
        <a className="brand" href="#top" aria-label="Cafe Scout 홈">
          <span className="brand-mark">
            <Coffee size={19} strokeWidth={2.4} />
          </span>
          <span>CAFE SCOUT</span>
        </a>
        <span className="eyebrow">FIELD NOTE 001</span>
      </header>

      <section id="top" className="welcome-grid">
        <div className="welcome-copy">
          <p className="kicker">
            <MapPin size={15} /> 현장에서 3분, 숫자로 오래 남게
          </p>
          <h1>
            감이 아니라
            <br />
            <em>구조</em>를 기록하세요.
          </h1>
          <p className="welcome-lead">
            좌석, 점유, 체류시간과 객단가를 입력하면 카페의 예상 일·월 매출을 즉시 계산합니다.
          </p>
          <a className="primary-action" href="/login">
            관찰 시작하기 <ArrowRight size={18} />
          </a>
          <p className="welcome-note">현장 관찰 기반 추정치이며 실제 재무 데이터가 아닙니다.</p>
        </div>

        <article className="preview-card" aria-label="사업성 스냅샷 예시">
          <div className="preview-topline">
            <div>
              <p className="eyebrow">BUSINESS SNAPSHOT</p>
              <h2>성수 로스터리</h2>
            </div>
            <span className="confidence">●●○</span>
          </div>
          <div className="snapshot-grid">
            {snapshot.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="sales-panel">
            <div className="sales-label">
              <BarChart3 size={17} /> 기준 예상 일매출
            </div>
            <strong>약 126만원</strong>
            <div className="sales-range">
              <span>보수 90만</span>
              <span>활황 165만</span>
            </div>
          </div>
          <div className="preview-footer">
            <span className="source-badge observed">관찰</span>
            <span>좌석 · 현재 고객 · 영업시간</span>
            <span className="source-badge calculated">시스템 계산</span>
          </div>
        </article>
      </section>
    </main>
  );
}
