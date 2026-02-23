import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "../sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/create",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/sidebar-queue", () => ({
  SidebarQueue: () => null,
}));

describe("Sidebar", () => {
  it("keeps Radio and AI DJ navigation available", () => {
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    );

    expect(screen.getByRole("link", { name: /radio/i })).toHaveAttribute(
      "href",
      "/radio",
    );
    expect(screen.getByRole("link", { name: /ai dj/i })).toHaveAttribute(
      "href",
      "/dj",
    );
    expect(screen.queryByText(/requires base model/i)).not.toBeInTheDocument();
  });
});
