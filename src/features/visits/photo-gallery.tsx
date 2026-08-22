"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import type { PhotoWithUrl } from "./types";

export function PhotoGallery({ photos, cafeName }: { photos: PhotoWithUrl[]; cafeName: string }) {
  const [active, setActive] = useState<PhotoWithUrl | null>(null);
  useEffect(() => {
    if (!active) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active]);

  if (!photos.length)
    return (
      <div className="detail-empty">
        <Camera size={24} />
        <p>저장된 사진이 없습니다.</p>
      </div>
    );

  return (
    <>
      <div className="detail-gallery">
        {photos.map((photo, index) => (
          <button
            type="button"
            className="gallery-item"
            key={photo.id}
            disabled={!photo.signedUrl}
            onClick={() => setActive(photo)}
          >
            {photo.signedUrl ? (
              <img
                src={photo.signedUrl}
                alt={`${cafeName} ${photo.kind === "GENERAL" ? "일반" : "메뉴판"} 사진 ${index + 1}`}
              />
            ) : (
              <Camera />
            )}
            <span>{photo.kind === "GENERAL" ? "일반" : "메뉴판"}</span>
          </button>
        ))}
      </div>
      {active?.signedUrl && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="사진 확대 보기"
          onClick={() => setActive(null)}
        >
          <button type="button" aria-label="확대 보기 닫기" onClick={() => setActive(null)}>
            <X />
          </button>
          <img
            src={active.signedUrl}
            alt={`${cafeName} 확대 사진`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
