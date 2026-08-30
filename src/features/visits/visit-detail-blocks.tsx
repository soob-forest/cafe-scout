import { Users } from "lucide-react";
import { formatKrw } from "@/lib/format";
import { ObservationManager } from "./observation-manager";
import { PhotoGallery } from "./photo-gallery";
import { VISIT_DETAIL_LABELS, VisitMetric, VisitRating } from "./visit-detail-elements";
import type { VisitDetailRecord } from "./visit-detail-types";

export function VisitDetailBlocks({ visit }: { visit: VisitDetailRecord }) {
  const sortedPhotos = [...visit.photos].sort((a, b) =>
    a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "GENERAL" ? -1 : 1,
  );
  return (
    <div className="detail-blocks">
      <SpaceSection visit={visit} />
      <MenuSection visit={visit} />
      <CustomerSection visit={visit} />
      <PhotoSection photos={sortedPhotos} cafeName={visit.cafe.name} />
      <NoteSection index="05" title="잘한 점" value={visit.strengths} />
      <NoteSection index="06" title="가져오고 싶은 점" value={visit.adoptable_points} />
    </div>
  );
}

function SpaceSection({ visit }: { visit: VisitDetailRecord }) {
  const snapshot = visit.snapshot;
  return (
    <section className="detail-block">
      <div className="block-index">01</div>
      <div>
        <h2>공간</h2>
        <div className="fact-grid">
          <VisitMetric
            label="테이블"
            value={snapshot?.table_count == null ? "-" : `${snapshot.table_count}개`}
            source="observed"
          />
          <VisitMetric
            label="좌석"
            value={snapshot?.seat_count ? `${snapshot.seat_count}석` : "-"}
            source="observed"
          />
          <VisitMetric
            label="가격 수준"
            value={snapshot?.price_level ? VISIT_DETAIL_LABELS.price[snapshot.price_level] : "-"}
            source="estimated"
          />
        </div>
        <div className="rating-summaries">
          <VisitRating label="공간" value={visit.space_rating} />
          <VisitRating label="입지" value={visit.location_rating} />
          <VisitRating label="전체" value={visit.overall_rating} />
        </div>
        <TagList tags={visit.mood_tags} />
      </div>
    </section>
  );
}

function MenuSection({ visit }: { visit: VisitDetailRecord }) {
  return (
    <section className="detail-block">
      <div className="block-index">02</div>
      <div>
        <h2>메뉴</h2>
        {visit.menus.length ? (
          <div className="detail-menu-list">
            {visit.menus.map((menu) => (
              <div key={menu.id}>
                <span>{VISIT_DETAIL_LABELS.category[menu.category]}</span>
                <strong>
                  {menu.name}
                  {menu.is_signature && <i>Signature</i>}
                </strong>
                <b>{formatKrw(menu.price)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-empty-text">입력한 대표 메뉴가 없습니다.</p>
        )}
        <VisitRating label="메뉴" value={visit.menu_rating} />
      </div>
    </section>
  );
}

function CustomerSection({ visit }: { visit: VisitDetailRecord }) {
  const snapshot = visit.snapshot;
  return (
    <section className="detail-block">
      <div className="block-index">03</div>
      <div>
        <h2>고객</h2>
        <CustomerFacts visit={visit} />
        <TagList tags={visit.customer_types} />
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">P1 · OCCUPANCY LOG</p>
            <h3>시간대별 추가 관찰</h3>
          </div>
          <Users size={22} />
        </div>
        <ObservationManager
          visitId={visit.id}
          initial={visit.observations}
          hasSeatCount={Boolean(snapshot?.seat_count)}
        />
      </div>
    </section>
  );
}

function CustomerFacts({ visit }: { visit: VisitDetailRecord }) {
  const snapshot = visit.snapshot;
  const observedTakeout = snapshot?.observed_takeout_orders != null;
  return (
    <div className="fact-grid">
      <VisitMetric label="현재 고객" value={customerCountLabel(snapshot)} source="observed" />
      <VisitMetric label="시간당 예상 고객" value={hourlyCustomersLabel(snapshot)} source="calculated" />
      <VisitMetric
        label="테이크아웃"
        value={takeoutLabel(snapshot)}
        source={observedTakeout ? "observed" : "estimated"}
      />
    </div>
  );
}

type Snapshot = VisitDetailRecord["snapshot"];

function customerCountLabel(snapshot: Snapshot) {
  return snapshot?.current_customers == null ? "-" : `${snapshot.current_customers}명`;
}

function hourlyCustomersLabel(snapshot: Snapshot) {
  return snapshot?.estimated_customers_per_hour == null
    ? "-"
    : `${Number(snapshot.estimated_customers_per_hour).toFixed(1)}명`;
}

function takeoutLabel(snapshot: Snapshot) {
  if (snapshot?.observed_takeout_orders != null) return `${snapshot.observed_takeout_orders}건 / 15분`;
  return snapshot?.takeout_level ? VISIT_DETAIL_LABELS.takeout[snapshot.takeout_level] : "-";
}

function PhotoSection({ photos, cafeName }: { photos: VisitDetailRecord["photos"]; cafeName: string }) {
  return (
    <section className="detail-block">
      <div className="block-index">04</div>
      <div>
        <h2>사진</h2>
        <PhotoGallery photos={photos} cafeName={cafeName} />
      </div>
    </section>
  );
}

function NoteSection({ index, title, value }: { index: string; title: string; value: string | null }) {
  return (
    <section className="detail-block prose-block">
      <div className="block-index">{index}</div>
      <div>
        <h2>{title}</h2>
        <p>{value || "기록된 내용이 없습니다."}</p>
      </div>
    </section>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}
