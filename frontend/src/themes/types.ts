export interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly colorScheme: "dark" | "light";
  readonly preview: {
    readonly bg: string;
    readonly sidebar: string;
    readonly primary: string;
  };
}
