"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import en from "../locales/en.json";
import th from "../locales/th.json";

export type Locale = "en" | "th";

type Translation = Record<string, any>;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string> | string, fallback?: string) => string;
}

const translations: Record<Locale, Translation> = {
  en,
  th,
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const v = localStorage.getItem("locale") as Locale | null;
      const initialLocale = v ?? (navigator.language?.startsWith("th") ? "th" : "en");
      setLocaleState(initialLocale);
    } catch (e) {
      setLocaleState("en");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("locale", locale);
    } catch (e) {
      // ignore
    }
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);

  const t = (key: string, vars?: Record<string, string> | string, fallback?: string) => {
    // Support legacy call: t(key, fallbackString)
    const resolvedFallback = typeof vars === "string" ? vars : (fallback ?? "");
    const resolvedVars = typeof vars === "object" ? vars : undefined;

    const parts = key.split(".");
    let value: any = translations[locale];
    for (const p of parts) {
      if (value && typeof value === "object" && p in value) {
        value = value[p];
      } else {
        return resolvedFallback || key;
      }
    }
    if (typeof value !== "string") return resolvedFallback || key;

    // Replace {placeholder} tokens
    if (resolvedVars) {
      return value.replace(/\{(\w+)\}/g, (_: string, k: string) => resolvedVars[k] ?? `{${k}}`);
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale, setLocale } = useLanguage();
  return { t, locale, setLocale };
}
