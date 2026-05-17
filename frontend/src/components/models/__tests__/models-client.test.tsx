import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsClient } from "../models-client";
import {
  downloadModel,
  fetchAvailableModels,
  fetchGpuStats,
  fetchHealth,
  fetchModels,
  switchChatLlmModel,
} from "@/lib/api/client";
import { fetchDJInfo } from "@/lib/api/dj-client";

vi.mock("@/lib/api/client", () => ({
  fetchModels: vi.fn(),
  fetchAvailableModels: vi.fn(),
  downloadModel: vi.fn(),
  switchChatLlmModel: vi.fn(),
  fetchGpuStats: vi.fn(),
  fetchHealth: vi.fn(),
}));

vi.mock("@/lib/api/dj-client", () => ({
  fetchDJInfo: vi.fn(),
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
      <ModelsClient />
    </QueryClientProvider>,
  );
}

describe("ModelsClient", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [],
      lm_models: [],
      chat_llm_models: [
        {
          name: "Qwen3-1.7B",
          model_type: "chat_llm",
          is_active: false,
          compatibility: [],
          format: "Transformers",
          quantization: "BF16",
        },
      ],
    });
    vi.mocked(fetchAvailableModels).mockResolvedValue({ models: [] });
    vi.mocked(fetchDJInfo).mockResolvedValue({
      active_model: "Existing-Chat",
      loaded_model: "",
      installed_models: ["Qwen3-1.7B"],
      system_prompt: "",
      default_system_prompt: "",
    });
    vi.mocked(fetchGpuStats).mockResolvedValue({
      device: "test",
      vram_used_mb: null,
      vram_total_mb: null,
      vram_percent: null,
    });
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "degraded",
      dit_model_loaded: false,
      lm_model_loaded: false,
      dit_model: "",
      lm_model: "",
      device: "test",
      version: "0.1.0",
      init_stage: "idle",
      init_error: "",
      download_progress: 0,
      instance_id: "test-instance",
    });
    vi.mocked(downloadModel).mockResolvedValue({ status: "started" });
    vi.mocked(switchChatLlmModel).mockResolvedValue({
      message: "Chat LLM loaded: Qwen3-1.7B",
    });
  });

  it("loads chat models through the load endpoint when none is loaded", async () => {
    const user = userEvent.setup();
    renderWithQueryClient();

    expect(await screen.findByText("Chat LLM")).toBeInTheDocument();
    const switchButton = await screen.findByRole("button", { name: /^load$/i });

    await user.click(switchButton);

    await waitFor(() => {
      expect(switchChatLlmModel).toHaveBeenCalled();
    });
    expect(vi.mocked(switchChatLlmModel).mock.calls[0][0]).toBe("Qwen3-1.7B");
  });

  it("shows loaded only for the runtime-loaded chat model", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [],
      lm_models: [],
      chat_llm_models: [
        {
          name: "Qwen3-1.7B",
          model_type: "chat_llm",
          is_active: true,
          compatibility: [],
          format: "Transformers",
          quantization: "BF16",
        },
      ],
    });
    vi.mocked(fetchDJInfo).mockResolvedValue({
      active_model: "Qwen3-1.7B",
      loaded_model: "Qwen3-1.7B",
      installed_models: ["Qwen3-1.7B"],
      system_prompt: "",
      default_system_prompt: "",
    });

    renderWithQueryClient();

    expect(await screen.findByRole("button", { name: /loaded/i })).toBeInTheDocument();
  });

  it("shows startup ACE DiT loads as loading on the model row", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [
        {
          name: "acestep-v15-base",
          model_type: "dit",
          is_active: false,
          is_loading: true,
        },
      ],
      lm_models: [],
      chat_llm_models: [],
    });
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "degraded",
      dit_model_loaded: false,
      lm_model_loaded: false,
      dit_model: "",
      lm_model: "",
      device: "test",
      version: "0.1.0",
      init_stage: "loading_dit",
      init_error: "",
      download_progress: 0,
      instance_id: "test-instance",
    });

    renderWithQueryClient();

    const loadingButton = await screen.findByRole("button", { name: /loading/i });
    expect(loadingButton).toBeDisabled();
  });

  it("shows startup ACE LM loads as loading on the model row", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [],
      lm_models: [
        {
          name: "acestep-5Hz-lm-0.6B",
          model_type: "lm",
          is_active: false,
          is_loading: true,
        },
      ],
      chat_llm_models: [],
    });
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "ok",
      dit_model_loaded: true,
      lm_model_loaded: false,
      dit_model: "acestep-v15-base",
      lm_model: "",
      device: "test",
      version: "0.1.0",
      init_stage: "loading_lm",
      init_error: "",
      download_progress: 0,
      instance_id: "test-instance",
    });

    renderWithQueryClient();

    expect(await screen.findByText("acestep-5Hz-lm-0.6B")).toBeInTheDocument();
    const loadingButton = await screen.findByRole("button", { name: /loading/i });
    expect(loadingButton).toBeDisabled();
  });

  it("shows startup chat LLM loads as loading on the model row", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [],
      lm_models: [],
      chat_llm_models: [
        {
          name: "Qwen3-1.7B",
          model_type: "chat_llm",
          is_active: false,
          is_loading: true,
          compatibility: [],
          format: "Transformers",
          quantization: "BF16",
        },
      ],
    });
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "ok",
      dit_model_loaded: true,
      lm_model_loaded: true,
      dit_model: "acestep-v15-base",
      lm_model: "acestep-5Hz-lm-0.6B",
      device: "test",
      version: "0.1.0",
      init_stage: "loading_chat_llm",
      init_error: "",
      download_progress: 0,
      instance_id: "test-instance",
    });

    renderWithQueryClient();

    expect(await screen.findByText("Qwen3-1.7B")).toBeInTheDocument();
    const loadingButton = await screen.findByRole("button", { name: /loading/i });
    expect(loadingButton).toBeDisabled();
  });

  it("disables other load buttons while any model is loading", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      dit_models: [
        {
          name: "acestep-v15-base",
          model_type: "dit",
          is_active: false,
          is_loading: true,
        },
      ],
      lm_models: [
        {
          name: "acestep-5Hz-lm-0.6B",
          model_type: "lm",
          is_active: false,
        },
      ],
      chat_llm_models: [
        {
          name: "Qwen3-1.7B",
          model_type: "chat_llm",
          is_active: false,
          compatibility: [],
          format: "Transformers",
          quantization: "BF16",
        },
      ],
    });
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "degraded",
      dit_model_loaded: false,
      lm_model_loaded: false,
      dit_model: "",
      lm_model: "",
      device: "test",
      version: "0.1.0",
      init_stage: "loading_dit",
      init_error: "",
      download_progress: 0,
      instance_id: "test-instance",
    });

    renderWithQueryClient();

    expect(await screen.findByRole("button", { name: /loading/i })).toBeDisabled();
    const otherLoadButtons = await screen.findAllByRole("button", { name: /^load$/i });
    expect(otherLoadButtons).toHaveLength(2);
    for (const button of otherLoadButtons) {
      expect(button).toBeDisabled();
    }
  });
});
