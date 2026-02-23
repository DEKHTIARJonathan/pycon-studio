import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GenerateButton } from "../generate-button";

afterEach(cleanup);

describe("GenerateButton", () => {
  it('renders "Generate" when not generating', () => {
    render(
      <GenerateButton onClick={vi.fn()} disabled={false} isGenerating={false} />,
    );
    expect(screen.getByRole("button", { name: /generate/i })).toHaveTextContent(
      "Generate",
    );
  });

  it('renders "Generating..." when isGenerating', () => {
    render(
      <GenerateButton onClick={vi.fn()} disabled={false} isGenerating={true} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Generating...");
  });

  it("button is disabled when disabled=true", () => {
    render(
      <GenerateButton onClick={vi.fn()} disabled={true} isGenerating={false} />,
    );
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it('renders "Cancelling..." when isCancelling is true', () => {
    render(
      <GenerateButton
        onClick={vi.fn()}
        disabled={false}
        isGenerating={true}
        isCancelling={true}
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Cancelling...");
    expect(button).not.toHaveTextContent("Generating...");
  });

  it("button is disabled when isCancelling is true", () => {
    render(
      <GenerateButton
        onClick={vi.fn()}
        disabled={false}
        isGenerating={false}
        isCancelling={true}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
