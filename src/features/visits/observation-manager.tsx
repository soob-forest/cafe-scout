"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Database } from "@/types/database";
import { formatSeoulDate } from "@/lib/format";
import { groupOccupancyObservations } from "./observation-buckets";
import { deleteObservationAction, saveObservationAction } from "./actions";
import { seoulLocalDateTimeToIso, toSeoulLocalDateTime } from "@/lib/seoul-datetime";

type Observation = Database["public"]["Tables"]["visit_occupancy_observations"]["Row"];

export function ObservationManager({
  visitId,
  initial,
  hasSeatCount,
}: {
  visitId: string;
  initial: Observation[];
  hasSeatCount: boolean;
}) {
  const [observations, setObservations] = useState(initial);
  const [observedAt, setObservedAt] = useState(toSeoulLocalDateTime(new Date().toISOString()));
  const [mode, setMode] = useState<"CUSTOMERS" | "RATE">(hasSeatCount ? "CUSTOMERS" : "RATE");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const buckets = useMemo(() => groupOccupancyObservations(observations), [observations]);

  const save = () => {
    const numericValue = value === "" ? null : Number(value);
    const observedAtIso = seoulLocalDateTimeToIso(observedAt);
    if (!observedAtIso) {
      setError("관찰 시각을 입력해 주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveObservationAction({
          id: editingId ?? undefined,
          cafeVisitId: visitId,
          observedAt: observedAtIso,
          currentCustomers: mode === "CUSTOMERS" ? numericValue : null,
          occupancyRate: mode === "RATE" ? numericValue : null,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        window.location.reload();
      } catch {
        setError("연결이 끊겼습니다. 입력을 유지했으니 다시 시도해 주세요.");
      }
    });
  };

  const edit = (item: Observation) => {
    const editMode = item.current_customers !== null && hasSeatCount ? "CUSTOMERS" : "RATE";
    setEditingId(item.id);
    setObservedAt(toSeoulLocalDateTime(item.observed_at));
    setMode(editMode);
    setValue(String(editMode === "CUSTOMERS" ? (item.current_customers ?? "") : (item.occupancy_rate ?? "")));
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setObservedAt(toSeoulLocalDateTime(new Date().toISOString()));
    setValue("");
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteObservationAction(id, visitId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setObservations((current) => current.filter((item) => item.id !== id));
      } catch {
        setError("연결이 끊겨 관찰을 삭제하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className="observation-manager">
      <div className="observation-form">
        <label className="field">
          <span>관찰 시각</span>
          <input
            id="observation-observed-at"
            type="datetime-local"
            value={observedAt}
            onChange={(event) => setObservedAt(event.target.value)}
            required
            aria-invalid={Boolean(error && !observedAt)}
            aria-describedby={error && !observedAt ? "observation-error" : undefined}
          />
        </label>
        <div className="segmented compact">
          <button
            type="button"
            className={mode === "CUSTOMERS" ? "active" : ""}
            disabled={!hasSeatCount}
            onClick={() => setMode("CUSTOMERS")}
          >
            고객 수
          </button>
          <button type="button" className={mode === "RATE" ? "active" : ""} onClick={() => setMode("RATE")}>
            점유율
          </button>
        </div>
        <label className="field">
          <span>{mode === "CUSTOMERS" ? "현재 고객" : "점유율"}</span>
          <div className="input-suffix">
            <input
              type="number"
              min="0"
              max={mode === "CUSTOMERS" ? 500 : 100}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <b>{mode === "CUSTOMERS" ? "명" : "%"}</b>
          </div>
        </label>
        <button className="secondary-button" type="button" disabled={pending || value === ""} onClick={save}>
          {editingId ? <Pencil size={15} /> : <Plus size={15} />} {editingId ? "관찰 수정" : "관찰 추가"}
        </button>
        {editingId && (
          <button className="text-button" type="button" disabled={pending} onClick={cancelEdit}>
            <X size={15} /> 취소
          </button>
        )}
      </div>
      {!hasSeatCount && <p className="derived-note">좌석 수가 없어 점유율로만 추가할 수 있습니다.</p>}
      {error && (
        <p className="form-error" role="alert" id="observation-error">
          {error}
        </p>
      )}
      {buckets.length > 0 && (
        <div className="occupancy-chart" aria-label="시간대별 평균 점유율">
          {buckets.map((bucket) => (
            <div key={bucket.key}>
              <span>{bucket.label}</span>
              <div>
                <i style={{ width: `${bucket.averageOccupancyRate}%` }} />
              </div>
              <strong>
                {bucket.averageOccupancyRate}% <small>({bucket.count}회)</small>
              </strong>
            </div>
          ))}
        </div>
      )}
      {observations.length ? (
        <ul className="observation-list">
          {observations.map((item) => (
            <li key={item.id}>
              <span>{formatSeoulDate(item.observed_at)}</span>
              <strong>{item.occupancy_rate === null ? "계산 대기" : `${item.occupancy_rate}%`}</strong>
              {item.current_customers !== null && <small>{item.current_customers}명 관찰</small>}
              <button
                type="button"
                disabled={pending}
                onClick={() => edit(item)}
                aria-label={`${formatSeoulDate(item.observed_at)} 관찰 수정`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(item.id)}
                aria-label={`${formatSeoulDate(item.observed_at)} 관찰 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="detail-empty-text">아직 추가 관찰이 없습니다.</p>
      )}
    </div>
  );
}
