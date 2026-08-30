"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { PhotoWithUrl } from "./types";

function PhotoLightbox({
  photo,
  cafeName,
  onClose,
  returnFocus,
}: {
  photo: PhotoWithUrl;
  cafeName: string;
  onClose: () => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      returnFocus?.focus();
    };
  }, [onClose, returnFocus]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="사진 확대 보기" onClick={onClose}>
      <button ref={closeRef} type="button" aria-label="확대 보기 닫기" onClick={onClose}>
        <X />
      </button>
      <img
        src={photo.signedUrl ?? ""}
        alt={`${cafeName} 확대 사진`}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

export function PhotoGallery({ photos, cafeName }: { photos: PhotoWithUrl[]; cafeName: string }) {
  const [active, setActive] = useState<PhotoWithUrl | null>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLButtonElement | null>(null);

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
            onClick={(event) => {
              setReturnFocus(event.currentTarget);
              setActive(photo);
            }}
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
        <PhotoLightbox
          photo={active}
          cafeName={cafeName}
          onClose={() => setActive(null)}
          returnFocus={returnFocus}
        />
      )}
    </>
  );
}
