"use client";

import { useLayoutEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", "bangers");
    html.style.colorScheme = "dark";
    html.classList.add("dark");
  }, []);

  return <>{children}</>;
}
