/** Languages offered when writing a recipe. BCP-47 base codes. */
export const RECIPE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "tr", label: "Türkçe" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "ru", label: "Русский" },
] as const;

export type RecipeLanguageCode = (typeof RECIPE_LANGUAGES)[number]["code"];

const BY_CODE = new Map<string, string>(RECIPE_LANGUAGES.map((l) => [l.code, l.label]));

/** Display name for a stored code, falling back to the code itself. */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return "English";
  return BY_CODE.get(code.toLowerCase()) ?? code.toUpperCase();
}

/**
 * Models sometimes answer with a language *name* ("Italian", "Italiano") instead of a
 * BCP-47 code, so map those back before falling through to English.
 */
const BY_NAME = new Map<string, string>([
  ...RECIPE_LANGUAGES.map((l) => [l.label.toLowerCase(), l.code] as const),
  ["english", "en"],
  ["italian", "it"],
  ["french", "fr"],
  ["spanish", "es"],
  ["german", "de"],
  ["portuguese", "pt"],
  ["dutch", "nl"],
  ["polish", "pl"],
  ["turkish", "tr"],
  ["japanese", "ja"],
  ["korean", "ko"],
  ["chinese", "zh"],
  ["mandarin", "zh"],
  ["arabic", "ar"],
  ["hindi", "hi"],
  ["russian", "ru"],
]);

/** Normalises anything user- or model-supplied to a code we offer, defaulting to English. */
export function normalizeLanguage(code: string | null | undefined): string {
  const raw = (code ?? "").trim().toLowerCase();
  if (!raw) return "en";
  const base = raw.split("-")[0] ?? "";
  if (BY_CODE.has(base)) return base;
  return BY_NAME.get(raw) ?? "en";
}
