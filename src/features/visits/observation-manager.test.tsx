import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObservationManager } from "./observation-manager";
import { deleteObservationAction, saveObservationAction } from "./actions";

vi.mock("./actions", () => ({
  saveObservationAction: vi.fn(),
  deleteObservationAction: vi.fn(),
}));

describe("ObservationManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a recoverable validation error when the observation date is cleared", () => {
    render(<ObservationManager visitId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" initial={[]} hasSeatCount />);
    fireEvent.change(screen.getByLabelText("관찰 시각"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "관찰 추가" }));

    expect(screen.getByRole("alert")).toHaveTextContent("관찰 시각을 입력해 주세요.");
    expect(saveObservationAction).not.toHaveBeenCalled();
  });

  it("edits a customer observation as its derived rate when seats are no longer available", () => {
    render(
      <ObservationManager
        visitId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
        hasSeatCount={false}
        initial={[
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            owner_id: "11111111-1111-4111-8111-111111111111",
            cafe_visit_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
            observed_at: "2026-08-18T03:00:00.000Z",
            current_customers: 10,
            occupancy_rate: 50,
            created_at: "2026-08-18T03:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /관찰 수정/ }));
    expect(screen.getByText("점유율", { selector: "label span" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(50);
  });

  it("keeps the observation input and shows a retryable error when the action transport fails", async () => {
    vi.mocked(saveObservationAction).mockRejectedValueOnce(new Error("network unavailable"));
    render(<ObservationManager visitId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" initial={[]} hasSeatCount />);

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "관찰 추가" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("연결이 끊겼습니다"));
    expect(screen.getByRole("spinbutton")).toHaveValue(10);
    expect(screen.getByRole("button", { name: "관찰 추가" })).toBeEnabled();
  });

  it("retains an observation when its delete action transport fails", async () => {
    vi.mocked(deleteObservationAction).mockRejectedValueOnce(new Error("network unavailable"));
    render(
      <ObservationManager
        visitId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
        hasSeatCount
        initial={[
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            owner_id: "11111111-1111-4111-8111-111111111111",
            cafe_visit_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
            observed_at: "2026-08-18T03:00:00.000Z",
            current_customers: 10,
            occupancy_rate: 50,
            created_at: "2026-08-18T03:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /관찰 삭제/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("관찰을 삭제하지 못했습니다"));
    expect(within(screen.getByRole("list")).getByText("50%", { exact: true })).toBeInTheDocument();
  });
});
