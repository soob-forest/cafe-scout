import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitListItem } from "./types";
import { CompareSelector } from "./compare-selector";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

function visit(index: number): VisitListItem {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
    cafe_id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
    owner_id: "11111111-1111-4111-8111-111111111111",
    visited_at: `2026-08-1${index}T03:00:00.000Z`,
    observation_duration_minutes: 20,
    mood_tags: [],
    customer_types: [],
    visit_purposes: [],
    space_rating: 4,
    menu_rating: 4,
    location_rating: 4,
    overall_rating: 4,
    strengths: null,
    adoptable_points: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    cafe: {
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
      owner_id: "11111111-1111-4111-8111-111111111111",
      name: `카페 ${index}`,
      region: "서울",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    snapshot: null,
    photos: [],
  };
}

describe("CompareSelector", () => {
  beforeEach(() => push.mockClear());

  it("enables compare for 2–3 visits and blocks a fourth selection", () => {
    render(<CompareSelector visits={[1, 2, 3, 4].map(visit)} />);
    const compare = screen.getByRole("button", { name: /비교하기/ });
    expect(compare).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "카페 1 비교 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "카페 2 비교 선택" }));
    expect(compare).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "카페 3 비교 선택" }));
    expect(screen.getByRole("button", { name: "카페 4 비교 선택" })).toBeDisabled();
    fireEvent.click(compare);
    expect(push).toHaveBeenCalledWith(
      "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
    );
  });
});
