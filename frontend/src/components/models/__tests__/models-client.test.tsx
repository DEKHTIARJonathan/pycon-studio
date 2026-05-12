import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsClient } from "../models-client";
import {
  downloadModel,
  fetchAvailableModels,
  fetchGpuStats,
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
    vi.mocked(fetchGpuStats).mockResolvedValue({ device: "test" });
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
});
