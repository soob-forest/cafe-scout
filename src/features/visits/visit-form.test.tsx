import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultVisitInput } from "./defaults";
import { VisitForm } from "./visit-form";
import { saveVisitAction } from "./actions";
import { createPhotoUploadAction, finalizePhotoUploadAction } from "@/features/photos/actions";
import { createClient } from "@/lib/supabase/browser";

vi.mock("./actions", () => ({ saveVisitAction: vi.fn() }));
vi.mock("@/features/photos/actions", () => ({
  createPhotoUploadAction: vi.fn(),
  discardPhotoUploadAction: vi.fn(),
  finalizePhotoUploadAction: vi.fn(),
  removePhotoAction: vi.fn(),
  reorderPhotosAction: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe("VisitForm live estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let objectUrl = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:photo-${objectUrl++}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1;
        naturalHeight = 1;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["processed"], { type: "image/webp" }));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows missing fields without disabling record entry", () => {
    render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);
    expect(screen.getByText("추정 불가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("updates calculated occupancy and over-capacity label immediately", () => {
    const initial = {
      ...defaultVisitInput(),
      seatCount: 40,
      currentCustomers: 30,
      occupancyInputMode: "CUSTOMERS" as const,
    };
    render(<VisitForm initial={initial} cafes={[]} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("현재 고객"), { target: { value: "41" } });
    expect(screen.getByText("100%+")).toBeInTheDocument();
  });

  it("handles a cleared visit date and links the server error to the field", async () => {
    vi.mocked(saveVisitAction).mockResolvedValue({
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: { visitedAt: ["방문 일시 입력값을 확인해 주세요."] },
    });
    render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);
    const visitedAt = screen.getByLabelText("방문 일시");

    expect(() => fireEvent.change(visitedAt, { target: { value: "" } })).not.toThrow();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(visitedAt).toHaveAttribute("aria-invalid", "true"));
    expect(visitedAt).toHaveAttribute("aria-describedby", "visit-visitedAt-error");
    expect(screen.getByRole("link", { name: /방문 일시/ })).toHaveAttribute("href", "#visit-visitedAt");
    await waitFor(() => expect(document.activeElement).toBe(visitedAt));
  });

  it("keeps one create request id across an ambiguous failure and retry", async () => {
    vi.mocked(saveVisitAction)
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          cafe: { id: "cafe", name: "카페", region: "지역" },
        },
      });
    render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("연결이 끊겼습니다"));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveVisitAction).toHaveBeenCalledTimes(2));

    const firstRequestId = vi.mocked(saveVisitAction).mock.calls[0]?.[2];
    const secondRequestId = vi.mocked(saveVisitAction).mock.calls[1]?.[2];
    expect(firstRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondRequestId).toBe(firstRequestId);
  });

  it("locks mutable form fields while a save is in flight", async () => {
    let finishSave: ((value: Awaited<ReturnType<typeof saveVisitAction>>) => void) | undefined;
    vi.mocked(saveVisitAction).mockImplementation(() => new Promise((resolve) => (finishSave = resolve)));
    render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByLabelText("카페명")).toBeDisabled());
    expect(screen.getByRole("button", { name: "저장 중…" })).toBeDisabled();

    finishSave?.({ ok: false, error: "다시 시도" });
    await waitFor(() => expect(screen.getByLabelText("카페명")).toBeEnabled());
  });

  it.each([
    [0, [0, 1, 0]],
    [1, [0, 1, 1]],
  ])(
    "preserves photo slots when upload %i fails and the other succeeds",
    async (failedIndex, expectedOrders) => {
      vi.mocked(saveVisitAction).mockResolvedValue({
        ok: true,
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          cafe: { id: "cafe", name: "카페", region: "지역" },
        },
      });
      let prepared = 0;
      vi.mocked(createPhotoUploadAction).mockImplementation(async () => ({
        ok: true,
        data: { path: `owner/visit/photo-${prepared++}.webp`, token: "token" },
      }));
      const uploadToSignedUrl = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockReturnValue({ storage: { from: () => ({ uploadToSignedUrl }) } } as never);
      let finalized = 0;
      vi.mocked(finalizePhotoUploadAction).mockImplementation(async (input) => {
        const attempt = finalized++;
        if (attempt === failedIndex) return { ok: false, error: "일시적 실패" };
        return {
          ok: true,
          data: {
            id: `photo-${attempt}`,
            owner_id: "owner",
            cafe_visit_id: input.visitId,
            kind: input.kind,
            bucket: "cafe-photos",
            object_path: input.path,
            mime_type: input.mimeType,
            size_bytes: input.sizeBytes,
            width: input.width,
            height: input.height,
            sort_order: input.sortOrder,
            created_at: "2026-08-18T00:00:00.000Z",
            signedUrl: "https://signed.example/photo",
          },
        };
      });

      render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);
      const files = [
        new File(["first"], "first.png", { type: "image/png" }),
        new File(["second"], "second.png", { type: "image/png" }),
      ];
      fireEvent.change(document.querySelectorAll<HTMLInputElement>('input[type="file"]')[0], {
        target: { files },
      });
      await waitFor(() => expect(screen.getAllByAltText(/업로드 예정/)).toHaveLength(2));

      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(finalizePhotoUploadAction).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("alert")).toHaveTextContent("사진 1장을 올리지 못했습니다");

      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(finalizePhotoUploadAction).toHaveBeenCalledTimes(3));
      expect(vi.mocked(finalizePhotoUploadAction).mock.calls.map(([input]) => input.sortOrder)).toEqual(
        expectedOrders,
      );
      expect(saveVisitAction).toHaveBeenCalledTimes(1);
    },
  );

  it("allocates independent stable slots for mixed GENERAL and MENU_BOARD photos", async () => {
    vi.mocked(saveVisitAction).mockResolvedValue({
      ok: true,
      data: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        cafe: { id: "cafe", name: "카페", region: "지역" },
      },
    });
    let prepared = 0;
    vi.mocked(createPhotoUploadAction).mockImplementation(async () => ({
      ok: true,
      data: { path: `owner/visit/mixed-${prepared++}.webp`, token: "token" },
    }));
    vi.mocked(createClient).mockReturnValue({
      storage: { from: () => ({ uploadToSignedUrl: vi.fn().mockResolvedValue({ data: {}, error: null }) }) },
    } as never);
    vi.mocked(finalizePhotoUploadAction).mockImplementation(async (input) => ({
      ok: true,
      data: {
        id: `photo-${input.kind}`,
        owner_id: "owner",
        cafe_visit_id: input.visitId,
        kind: input.kind,
        bucket: "cafe-photos",
        object_path: input.path,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        sort_order: input.sortOrder,
        created_at: "2026-08-18T00:00:00.000Z",
        signedUrl: "https://signed.example/photo",
      },
    }));

    render(<VisitForm initial={defaultVisitInput()} cafes={[]} />);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[0], {
      target: { files: [new File(["general"], "general.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getAllByAltText(/업로드 예정/)).toHaveLength(1));
    fireEvent.change(inputs[1], {
      target: { files: [new File(["menu"], "menu.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getAllByAltText(/업로드 예정/)).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(finalizePhotoUploadAction).toHaveBeenCalledTimes(2));

    expect(
      vi.mocked(finalizePhotoUploadAction).mock.calls.map(([input]) => [input.kind, input.sortOrder]),
    ).toEqual([
      ["GENERAL", 0],
      ["MENU_BOARD", 0],
    ]);
  });
});
