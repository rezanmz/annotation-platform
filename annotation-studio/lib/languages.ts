export const languageNames = {
  ar: "Arabic",
  zh: "Chinese",
  en: "English",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ru: "Russian",
  es: "Spanish",
} as const;

export type Language = keyof typeof languageNames;

export function assignmentName(project: { name: string; language: Language | null }) {
  return project.language ? `${project.name} · ${languageNames[project.language]}` : project.name;
}

export function contentLanguage(language: Language | null) {
  return { lang: language ?? undefined, dir: language === "ar" ? "rtl" : "auto" } as const;
}
