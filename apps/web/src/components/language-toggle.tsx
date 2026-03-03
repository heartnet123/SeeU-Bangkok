"use client";

import React from "react";
import { useLanguage } from "@/contexts/language-context";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        aria-label="Switch to English"
        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
          locale === "en" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-gray-700 border-gray-300"
        }`}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        aria-label="Switch to Thai"
        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
          locale === "th" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-gray-700 border-gray-300"
        }`}
        onClick={() => setLocale("th")}
      >
        ไทย
      </button>
    </div>
  );
}
