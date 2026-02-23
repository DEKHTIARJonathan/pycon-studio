import type { ThemeDefinition } from "./types";

export const bangers = {
  id: "bangers",
  name: "conda install bangers",
  description: "Long Beach night colors with cyan, pink, and yellow pop",
  colorScheme: "dark",
  preview: { bg: "#090a28", sidebar: "#101136", primary: "#25c8eb" },
} as const satisfies ThemeDefinition;
