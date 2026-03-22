import type { Pinia } from "pinia";
import { watch } from "vue";
import { usePreferencesStore } from "@/store/modules/preferences";
import { mix, setProperties, withAlpha } from "@/utils";

export function installThemeWatcher(pinia: Pinia): void {
  const preferences = usePreferencesStore(pinia);

  watch(
    () => [preferences.themeMode, preferences.primaryColor] as const,
    ([mode, primary]) => {
      const isDark = mode === "dark";
      const surface = isDark ? "#18211f" : "#ffffff";
      const text = isDark ? "#edf4f2" : "#1e2724";

      setProperties({
        appBg: isDark
          ? "linear-gradient(180deg, #101716 0%, #1a2522 100%)"
          : "linear-gradient(160deg, #f4f2ec 0%, #eef4f0 58%, #f7efea 100%)",
        surfaceBg: withAlpha(surface, isDark ? 0.9 : 0.8),
        surfaceBorder: mix(primary, isDark ? "#8fb8ac" : "#d7ddd2", 28),
        textPrimary: text,
        textSecondary: isDark ? "#b6c7c2" : "#4c5a54",
        brandPrimary: primary,
        brandPrimarySoft: mix(primary, surface, 25),
        shadowSoft: isDark
          ? "0 12px 28px rgba(0, 0, 0, 0.25)"
          : "0 10px 25px rgba(19, 46, 39, 0.08)"
      });
    },
    { immediate: true }
  );
}
