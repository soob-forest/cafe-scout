import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CompareScroll } from "./compare-scroll";

it("scrolls the comparison explicitly with horizontal arrow keys", () => {
  render(
    <CompareScroll>
      <span>비교 내용</span>
    </CompareScroll>,
  );
  const region = screen.getByLabelText(/방문 기록 비교표/);
  const scrollBy = vi.fn();
  Object.defineProperty(region, "clientWidth", { value: 300 });
  region.scrollBy = scrollBy;

  fireEvent.keyDown(region, { key: "ArrowRight" });
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 210 });
  fireEvent.keyDown(region, { key: "ArrowLeft" });
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -210 });
  fireEvent.keyDown(region, { key: "ArrowDown" });
  expect(scrollBy).toHaveBeenCalledTimes(2);
});
