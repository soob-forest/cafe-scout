"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteVisitAction } from "./actions";

export function DeleteVisitButton({ visitId, cafeName }: { visitId: string; cafeName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    if (!window.confirm(`${cafeName} 방문 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteVisitAction(visitId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace(result.data.cleanupPending ? "/visits?cleanup=pending" : "/visits");
        router.refresh();
      } catch {
        setError("연결이 끊겨 방문 기록을 삭제하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className="delete-control">
      <button className="text-button danger" type="button" disabled={pending} onClick={remove}>
        <Trash2 size={16} /> {pending ? "삭제 중…" : "기록 삭제"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
