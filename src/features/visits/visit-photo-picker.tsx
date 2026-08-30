/* eslint-disable @next/next/no-img-element */

import type { Dispatch, SetStateAction } from "react";
import { ArrowDown, ArrowUp, Camera, ImagePlus, Trash2 } from "lucide-react";
import type { PhotoKind } from "@/domain/types";
import { swapPendingPhotoOrder } from "@/features/photos/photo-order";
import type { PhotoWithUrl } from "./types";

export type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  kind: PhotoKind;
  width: number;
  height: number;
  sortOrder: number;
  status: "ready" | "uploading" | "failed";
};

type PhotoPickerProps = {
  kind: PhotoKind;
  title: string;
  photos: PendingPhoto[];
  stored: PhotoWithUrl[];
  onFiles: (kind: PhotoKind, files: FileList | null) => void;
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
  onRemoveStored: (photo: PhotoWithUrl) => void;
  onMoveStored: (photo: PhotoWithUrl, direction: -1 | 1) => void;
  disabled: boolean;
};

export function PhotoPicker(props: PhotoPickerProps) {
  const current = props.photos
    .filter((photo) => photo.kind === props.kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const existing = props.stored
    .filter((photo) => photo.kind === props.kind)
    .sort((a, b) => a.sort_order - b.sort_order);
  const limit = props.kind === "GENERAL" ? 10 : 3;
  return (
    <div className="photo-picker">
      <PhotoPickerHeader {...props} limit={limit} count={current.length + existing.length} />
      <PhotoStrip {...props} current={current} existing={existing} />
    </div>
  );
}

function PhotoPickerHeader({
  kind,
  title,
  onFiles,
  disabled,
  limit,
  count,
}: PhotoPickerProps & { limit: number; count: number }) {
  return (
    <div className="subheading">
      <div>
        <h3>{title}</h3>
        <p>
          {kind === "GENERAL" ? "공간과 외관" : "OCR 없이 참고용으로 저장"} · 최대 {limit}장
        </p>
      </div>
      <label className="secondary-button file-button">
        <ImagePlus size={15} />
        <span>사진 선택</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            onFiles(kind, event.target.files);
            event.target.value = "";
          }}
          disabled={disabled || count >= limit}
        />
      </label>
    </div>
  );
}

function PhotoStrip({
  kind,
  title,
  current,
  existing,
  setPhotos,
  onRemoveStored,
  onMoveStored,
  disabled,
}: PhotoPickerProps & { current: PendingPhoto[]; existing: PhotoWithUrl[] }) {
  return (
    <div className="photo-strip">
      {existing.map((photo, index) => (
        <StoredPhotoItem
          key={photo.id}
          photo={photo}
          title={title}
          index={index}
          total={existing.length}
          disabled={disabled || current.length > 0}
          onRemove={onRemoveStored}
          onMove={onMoveStored}
        />
      ))}
      {current.map((photo, index) => (
        <PendingPhotoItem
          key={photo.id}
          photo={photo}
          index={index}
          total={current.length}
          kind={kind}
          title={title}
          disabled={disabled}
          setPhotos={setPhotos}
        />
      ))}
    </div>
  );
}

type StoredItemProps = {
  photo: PhotoWithUrl;
  title: string;
  index: number;
  total: number;
  disabled: boolean;
  onRemove: (photo: PhotoWithUrl) => void;
  onMove: (photo: PhotoWithUrl, direction: -1 | 1) => void;
};

function StoredPhotoItem({ photo, title, index, total, disabled, onRemove, onMove }: StoredItemProps) {
  return (
    <div className="photo-item">
      {photo.signedUrl ? <img src={photo.signedUrl} alt={`${title} 저장 사진`} /> : <Camera />}
      <div className="photo-controls">
        <PhotoMoveButton
          label="저장 사진 앞으로"
          direction={-1}
          disabled={disabled || index === 0}
          onMove={() => onMove(photo, -1)}
        />
        <PhotoMoveButton
          label="저장 사진 뒤로"
          direction={1}
          disabled={disabled || index === total - 1}
          onMove={() => onMove(photo, 1)}
        />
        <button type="button" onClick={() => onRemove(photo)} disabled={disabled} aria-label="저장 사진 제거">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

type PendingItemProps = {
  photo: PendingPhoto;
  index: number;
  total: number;
  kind: PhotoKind;
  title: string;
  disabled: boolean;
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
};

function PendingPhotoItem(props: PendingItemProps) {
  const move = (direction: -1 | 1) =>
    props.setPhotos((all) => swapPendingPhotoOrder(all, props.photo.id, props.kind, direction));
  const remove = () => {
    URL.revokeObjectURL(props.photo.previewUrl);
    props.setPhotos((items) => items.filter((item) => item.id !== props.photo.id));
  };
  return (
    <div className={`photo-item ${props.photo.status}`}>
      <img src={props.photo.previewUrl} alt={`${props.title} 업로드 예정 ${props.index + 1}`} />
      <div className="photo-controls">
        <PhotoMoveButton
          label="사진 앞으로"
          direction={-1}
          disabled={props.disabled || props.index === 0}
          onMove={() => move(-1)}
        />
        <PhotoMoveButton
          label="사진 뒤로"
          direction={1}
          disabled={props.disabled || props.index === props.total - 1}
          onMove={() => move(1)}
        />
        <button type="button" onClick={remove} disabled={props.disabled} aria-label="예정 사진 제거">
          <Trash2 size={12} />
        </button>
      </div>
      {props.photo.status !== "ready" && (
        <span>{props.photo.status === "uploading" ? "업로드 중" : "실패"}</span>
      )}
    </div>
  );
}

function PhotoMoveButton({
  label,
  direction,
  disabled,
  onMove,
}: {
  label: string;
  direction: -1 | 1;
  disabled: boolean;
  onMove: () => void;
}) {
  const Icon = direction === -1 ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={onMove} disabled={disabled} aria-label={label}>
      <Icon size={12} />
    </button>
  );
}
