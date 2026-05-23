import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

/**
 * Two-button EN / ES toggle. Writes to localStorage("dnc_lang") via
 * i18next-browser-languagedetector so the choice persists across sessions.
 */
export const LanguageToggle = ({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) => {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("es") ? "es" : "en";

  const setLang = (lng: "en" | "es") => {
    if (current === lng) return;
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem("dnc_lang", lng);
    } catch {}
  };

  const baseBtn =
    "inline-flex items-center justify-center font-display tracking-wider transition-colors";
  const sizeCls = variant === "compact" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  const active = "bg-maple text-maple-foreground shadow-maple";
  const idle = "text-foreground/70 hover:text-foreground hover:bg-white/5";

  return (
    <div
      role="group"
      aria-label={t("lang.toggleLabel")}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 backdrop-blur p-1"
    >
      <Languages
        className={`${variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground ml-1`}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={current === "en"}
        className={`${baseBtn} ${sizeCls} rounded-full ${current === "en" ? active : idle}`}
      >
        {t("lang.shortEn")}
      </button>
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={current === "es"}
        className={`${baseBtn} ${sizeCls} rounded-full ${current === "es" ? active : idle}`}
      >
        {t("lang.shortEs")}
      </button>
    </div>
  );
};
