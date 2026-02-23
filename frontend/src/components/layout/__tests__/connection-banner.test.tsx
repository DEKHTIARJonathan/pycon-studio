import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionBanner } from "../connection-banner";

vi.mock("@/lib/api/client", () => ({
  fetchHealth: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("ConnectionBanner", () => {
  it("shows nothing when loading", () => {
    const { container } = renderWithProviders(<ConnectionBanner />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("max-h-0");
    expect(wrapper.className).toContain("opacity-0");
    expect(wrapper.textContent).toBe("");
  });
});
