export type { ThemeDefinition } from "./types";
import { bangers } from "./bangers";

export const THEMES = [bangers] as const;
export type BuiltInThemeId = (typeof THEMES)[number]["id"];
export type ThemeId = BuiltInThemeId | (string & {});
export const THEME_IDS = THEMES.map(t => t.id);
export const DEFAULT_THEME: ThemeId = "bangers";
