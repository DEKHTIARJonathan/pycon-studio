import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";
import { fetchHealth, fetchSettings, updateSettings } from "@/lib/api/client";
import {
  fetchDitThrottle,
  fetchThrottleScope,
  fetchVaeThrottle,
  updateDitThrottle,
  updateThrottleScope,
  updateVaeThrottle,
  resetThrottle,
} from "@/lib/api/radio-client";

vi.mock("@/lib/api/client", () => ({
  fetchHealth: vi.fn(),
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/lib/api/radio-client", () => ({
  fetchVaeThrottle: vi.fn(),
  updateVaeThrottle: vi.fn(),
  fetchDitThrottle: vi.fn(),
  updateDitThrottle: vi.fn(),
  resetThrottle: vi.fn(),
  fetchThrottleScope: vi.fn(),
  updateThrottleScope: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "ok",
      dit_model_loaded: true,
      lm_model_loaded: true,
      dit_model: "fake-dit",
      lm_model: "fake-lm",
      device: "test",
      version: "0.1.0",
      init_stage: "ready",
      init_error: "",
      download_progress: 0,
      instance_id: "test",
    });
    vi.mocked(fetchSettings).mockResolvedValue({
      settings: {
        keep_active_models_resident: "true",
        parallel_pipeline_enabled: "false",
        lyrics_guardrails_enabled: "true",
        default_duration: "200",
      },
    });
    vi.mocked(updateSettings).mockResolvedValue({ settings: {} });
    vi.mocked(fetchVaeThrottle).mockResolvedValue({ chunk_size: 128, sleep_ms: 200 });
    vi.mocked(fetchDitThrottle).mockResolvedValue({ sleep_ms: 200 });
    vi.mocked(fetchThrottleScope).mockResolvedValue({ radio_only: true });
    vi.mocked(updateVaeThrottle).mockResolvedValue({ chunk_size: 128, sleep_ms: 200 });
    vi.mocked(updateDitThrottle).mockResolvedValue({ sleep_ms: 200 });
    vi.mocked(updateThrottleScope).mockResolvedValue({ radio_only: true });
    vi.mocked(resetThrottle).mockResolvedValue({ chunk_size: 128, sleep_ms: 200 });
  });

  it("shows lyrics guardrails on by default and saves toggles", async () => {
    const user = userEvent.setup();
    renderWithQueryClient();

    const toggle = await screen.findByRole("switch", { name: /lyrics guardrails/i });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalled();
    });
    expect(vi.mocked(updateSettings).mock.calls[0][0]).toEqual({
      lyrics_guardrails_enabled: "false",
    });
  });
});
