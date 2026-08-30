import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { MENU_CATEGORIES, PRICE_LEVELS, type VisitInput } from "@/domain/types";
import { useVisitForm } from "./visit-form-context";
import { numberOrNull } from "./visit-form-fields";
import { VISIT_FORM_LABELS } from "./visit-form-labels";
import { PhotoPicker } from "./visit-photo-picker";

type Menu = VisitInput["representativeMenus"][number];

export function VisitFormMenuSection() {
  return (
    <section className="form-section" aria-labelledby="menu-title">
      <div className="section-number">02</div>
      <div className="section-content">
        <h2 id="menu-title">메뉴 / 가격</h2>
        <MenuBoardPhotoField />
        <MenuEditor />
        <PriceLevelField />
        <AverageSpendField />
      </div>
    </section>
  );
}

function MenuBoardPhotoField() {
  const form = useVisitForm();
  return (
    <PhotoPicker
      kind="MENU_BOARD"
      title="메뉴판 사진"
      photos={form.photos}
      stored={form.storedPhotos}
      onFiles={form.onFiles}
      setPhotos={form.setPhotos}
      onRemoveStored={form.removeStored}
      onMoveStored={form.moveStored}
      disabled={form.saving || form.photoPreparationPending || form.photoMutationPending}
    />
  );
}

function MenuEditor() {
  const { form, addMenu, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <>
      <div className="subheading">
        <div>
          <h3>대표 메뉴</h3>
          <p>3~5개를 추천하며 최대 10개까지 저장합니다.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={addMenu}
          disabled={form.representativeMenus.length >= 10}
        >
          <Plus size={15} /> 메뉴 추가
        </button>
      </div>
      <div
        className="menu-list"
        id={fieldId("representativeMenus")}
        tabIndex={-1}
        aria-invalid={Boolean(errorFor("representativeMenus"))}
        aria-describedby={errorDescriptionId("representativeMenus")}
      >
        {form.representativeMenus.map((menu, index) => (
          <MenuRow key={menu.id ?? index} menu={menu} index={index} total={form.representativeMenus.length} />
        ))}
        {errorFor("representativeMenus") && (
          <small className="inline-error" id={`${fieldId("representativeMenus")}-error`}>
            {errorFor("representativeMenus")}
          </small>
        )}
      </div>
    </>
  );
}

function MenuRow({ menu, index, total }: { menu: Menu; index: number; total: number }) {
  const { updateMenu, removeMenu, moveMenu, errorFor, errorDescriptionId } = useVisitForm();
  const invalid = Boolean(errorFor("representativeMenus"));
  const description = errorDescriptionId("representativeMenus");
  return (
    <div className="menu-row">
      <div className="sort-controls">
        <button type="button" onClick={() => moveMenu(index, -1)} disabled={index === 0} aria-label="위로">
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => moveMenu(index, 1)}
          disabled={index === total - 1}
          aria-label="아래로"
        >
          <ArrowDown size={14} />
        </button>
      </div>
      <input
        aria-label={`메뉴 ${index + 1} 이름`}
        aria-invalid={invalid}
        aria-describedby={description}
        placeholder="메뉴명"
        value={menu.name}
        maxLength={40}
        onChange={(event) => updateMenu(index, { name: event.target.value })}
      />
      <MenuCategory menu={menu} index={index} invalid={invalid} description={description} />
      <MenuPrice menu={menu} index={index} invalid={invalid} description={description} />
      <label className="check-label">
        <input
          type="checkbox"
          checked={menu.isSignature}
          onChange={(event) => updateMenu(index, { isSignature: event.target.checked })}
        />
        시그니처
      </label>
      <button
        type="button"
        className="icon-button danger"
        aria-label="메뉴 삭제"
        onClick={() => removeMenu(index)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function MenuCategory({
  menu,
  index,
  invalid,
  description,
}: {
  menu: Menu;
  index: number;
  invalid: boolean;
  description?: string;
}) {
  const { updateMenu } = useVisitForm();
  return (
    <select
      aria-label={`메뉴 ${index + 1} 카테고리`}
      aria-invalid={invalid}
      aria-describedby={description}
      value={menu.category}
      onChange={(event) => updateMenu(index, { category: event.target.value as Menu["category"] })}
    >
      {MENU_CATEGORIES.map((value) => (
        <option key={value} value={value}>
          {VISIT_FORM_LABELS.category[value]}
        </option>
      ))}
    </select>
  );
}

function MenuPrice({
  menu,
  index,
  invalid,
  description,
}: {
  menu: Menu;
  index: number;
  invalid: boolean;
  description?: string;
}) {
  const { updateMenu } = useVisitForm();
  return (
    <div className="input-suffix">
      <input
        aria-label={`메뉴 ${index + 1} 가격`}
        aria-invalid={invalid}
        aria-describedby={description}
        type="number"
        min="0"
        max="100000"
        value={menu.price}
        onChange={(event) => updateMenu(index, { price: Number(event.target.value) })}
      />
      <b>원</b>
    </div>
  );
}

function PriceLevelField() {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <fieldset
      className="choice-field"
      id={fieldId("priceLevel")}
      tabIndex={-1}
      aria-invalid={Boolean(errorFor("priceLevel"))}
      aria-describedby={errorDescriptionId("priceLevel")}
    >
      <legend>
        가격 수준 <span className="source-badge user-estimate">사용자 추정</span>
      </legend>
      <div className="choice-grid four">
        {PRICE_LEVELS.map((value) => (
          <button
            type="button"
            key={value}
            className={form.priceLevel === value ? "active" : ""}
            onClick={() => update("priceLevel", form.priceLevel === value ? null : value)}
          >
            {VISIT_FORM_LABELS.price[value]}
          </button>
        ))}
      </div>
      {errorFor("priceLevel") && (
        <small className="inline-error" id={`${fieldId("priceLevel")}-error`}>
          {errorFor("priceLevel")}
        </small>
      )}
    </fieldset>
  );
}

function AverageSpendField() {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <label className="field spend-field">
      <span>
        예상 객단가 <i className="source-badge user-estimate">사용자 추정</i>
      </span>
      <div className="quick-values">
        {[6000, 8000, 10000, 12000].map((value) => (
          <button type="button" key={value} onClick={() => update("estimatedAverageSpend", value)}>
            {value / 1000}천
          </button>
        ))}
      </div>
      <div className="input-suffix">
        <input
          id={fieldId("estimatedAverageSpend")}
          type="number"
          min="1000"
          max="100000"
          value={form.estimatedAverageSpend ?? ""}
          onChange={(event) => update("estimatedAverageSpend", numberOrNull(event.target.value))}
          aria-invalid={Boolean(errorFor("estimatedAverageSpend"))}
          aria-describedby={errorDescriptionId("estimatedAverageSpend")}
        />
        <b>원</b>
      </div>
      <small id={`${fieldId("estimatedAverageSpend")}-error`}>
        {errorFor("estimatedAverageSpend") ?? "한 고객이 한 번 방문해 실제로 사용하는 금액을 추정해 주세요."}
      </small>
    </label>
  );
}
