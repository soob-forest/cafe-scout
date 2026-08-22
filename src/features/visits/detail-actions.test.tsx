import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteVisitButton } from "./detail-actions";
import { deleteVisitAction } from "./actions";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("./actions", () => ({
  deleteVisitAction: vi.fn(),
}));

describe("DeleteVisitButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows a retryable error when the action transport fails", async () => {
    vi.mocked(deleteVisitAction).mockRejectedValueOnce(new Error("network unavailable"));
    render(<DeleteVisitButton visitId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" cafeName="테스트 카페" />);

    fireEvent.click(screen.getByRole("button", { name: "기록 삭제" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("방문 기록을 삭제하지 못했습니다"),
    );
    expect(screen.getByRole("button", { name: "기록 삭제" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
