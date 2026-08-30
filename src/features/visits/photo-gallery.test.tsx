import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoGallery } from "./photo-gallery";
import type { PhotoWithUrl } from "./types";

const photo: PhotoWithUrl = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  owner_id: "11111111-1111-4111-8111-111111111111",
  cafe_visit_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  kind: "GENERAL",
  bucket: "cafe-photos",
  object_path: "owner/visit/photo.webp",
  mime_type: "image/webp",
  size_bytes: 100,
  width: 800,
  height: 600,
  sort_order: 0,
  created_at: "2026-08-30T00:00:00.000Z",
  signedUrl: "https://signed.example/photo.webp",
};

describe("PhotoGallery", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("traps focus in the lightbox and restores its trigger on close", async () => {
    render(<PhotoGallery photos={[photo]} cafeName="테스트 카페" />);
    const trigger = screen.getByRole("button", { name: /^테스트 카페 일반 사진 1/ });

    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "확대 보기 닫기" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
});
