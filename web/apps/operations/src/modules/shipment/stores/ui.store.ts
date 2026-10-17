import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const STORAGE_KEY = "shipment_express.theme";
const V2_STORAGE_KEY = "shipment_express.ui_v2";

/**
 * Theme variants available. v1 = legacy SPA (kept for the rollback
 * window). v2 = Mockup 2 redesign.
 */
type ThemeVariant = "v1-light" | "v1-dark" | "v2-light" | "v2-dark";

function resolveInitialThemeMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches)
    return "dark";
  return "light";
}

function resolveInitialV2(): {
  variant: "v2-light" | "v2-dark";
  splitterPct: number;
} {
  if (typeof window === "undefined") {
    return { variant: "v2-light", splitterPct: 50 };
  }
  try {
    const raw = localStorage.getItem(V2_STORAGE_KEY);
    if (!raw) return { variant: "v2-light", splitterPct: 50 };
    const parsed = JSON.parse(raw) as {
      variant?: string;
      splitterPct?: number;
    };
    return {
      variant: parsed.variant === "v2-dark" ? "v2-dark" : "v2-light",
      splitterPct: Number.isFinite(parsed.splitterPct as number)
        ? Math.min(70, Math.max(30, Number(parsed.splitterPct)))
        : 50,
    };
  } catch {
    return { variant: "v2-light", splitterPct: 50 };
  }
}

export type ModalName =
  | "cliente"
  | "pickup"
  | "dest"
  | "colli"
  | "costi"
  | "stato"
  | "cod"
  | "insurance"
  | "customs"
  | "supplements"
  | "pickup_schedule"
  | "dates"
  | "proforma"
  | "post_invoice"
  | "pricing_breakdown"
  | "wifi_scale"
  | "riaddebito"
  | "reset_awb"
  | "currency_day"
  | "servizio"
  | "note"
  | "partners"
  | "dgr"
  | "flags"
  | "checkforn"
  | null;

// Id propio ("shipment_ui", no "ui") — ver la nota equivalente en
// modules/cargo/stores/ui.store.ts: ambos usaban el id "ui" y colisionaban
// silenciosamente dentro de la app `operations`.
export const useUiStore = defineStore("shipment_ui", () => {
  // ─── Legacy v1 surface (preserved for backwards compat) ────
  const loading = ref(false);
  const error = ref<string | null>(null);
  const themeMode = ref<"light" | "dark">(resolveInitialThemeMode());

  // v2 themes are the canonical surface palette for the redesigned
  // shipment page; expose them via the legacy `vuetifyThemeName` key so
  // `<v-app :theme=…>` and any older bindings keep working without a
  // dual-write race against the v2 layout's onMounted hook.
  const vuetifyThemeName = computed(() =>
    themeMode.value === "dark" ? "shipmentV2Dark" : "shipmentV2Light",
  );

  function startLoading(): void {
    loading.value = true;
  }
  function stopLoading(): void {
    loading.value = false;
  }
  function setError(msg: string | null): void {
    error.value = msg;
  }

  function toggleTheme(): void {
    themeMode.value = themeMode.value === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, themeMode.value);
    }
  }

  // Persist a theme chosen via the shared PlatformTopBar toggle, which drives
  // Vuetify's `theme.global.name` directly. Maps the Vuetify name back to our
  // light/dark mode so localStorage stays in sync. Unknown names are ignored.
  function setThemeName(name: string): void {
    const mode =
      name === "shipmentV2Dark"
        ? "dark"
        : name === "shipmentV2Light"
          ? "light"
          : null;
    if (mode === null) return;
    themeMode.value = mode;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  // ─── v2 (Mockup 2) state ──────────────────────────────────
  const initialV2 = resolveInitialV2();
  const v2Theme = ref<"v2-light" | "v2-dark">(initialV2.variant);
  const splitterPct = ref<number>(initialV2.splitterPct);

  const v2VuetifyThemeName = computed(() =>
    v2Theme.value === "v2-dark" ? "shipmentV2Dark" : "shipmentV2Light",
  );

  // Drawers (mutually exclusive when on the v2 layout).
  const sidebarOpen = ref(false);
  const docOpen = ref(false);
  const chatOpen = ref(false);
  const auditOpen = ref(false);
  const trackingOpen = ref(false);

  // Single-modal stack — only one open at a time per the mockup design.
  const activeModal = ref<ModalName>(null);

  function openModal(name: Exclude<ModalName, null>): void {
    activeModal.value = name;
  }

  function closeModal(): void {
    activeModal.value = null;
  }

  function toggleV2Theme(): void {
    v2Theme.value = v2Theme.value === "v2-dark" ? "v2-light" : "v2-dark";
  }

  function setSplitterPct(pct: number): void {
    splitterPct.value = Math.min(70, Math.max(30, pct));
  }

  function openSidebar(): void {
    sidebarOpen.value = true;
    docOpen.value = false;
    chatOpen.value = false;
  }

  function openDoc(): void {
    docOpen.value = true;
    sidebarOpen.value = false;
    chatOpen.value = false;
  }

  function openChat(): void {
    chatOpen.value = true;
    sidebarOpen.value = false;
    docOpen.value = false;
    auditOpen.value = false;
    trackingOpen.value = false;
  }

  function openAudit(): void {
    auditOpen.value = true;
    sidebarOpen.value = false;
    docOpen.value = false;
    chatOpen.value = false;
    trackingOpen.value = false;
  }

  function openTracking(): void {
    trackingOpen.value = true;
    sidebarOpen.value = false;
    docOpen.value = false;
    chatOpen.value = false;
    auditOpen.value = false;
  }

  function closeAllDrawers(): void {
    sidebarOpen.value = false;
    docOpen.value = false;
    chatOpen.value = false;
    auditOpen.value = false;
    trackingOpen.value = false;
  }

  watch([v2Theme, splitterPct], () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        V2_STORAGE_KEY,
        JSON.stringify({
          variant: v2Theme.value,
          splitterPct: splitterPct.value,
        }),
      );
    } catch {
      /* incognito / quota errors */
    }
  });

  return {
    // v1 legacy
    loading,
    error,
    themeMode,
    vuetifyThemeName,
    startLoading,
    stopLoading,
    setError,
    toggleTheme,
    setThemeName,
    // v2 (Mockup 2)
    v2Theme,
    v2VuetifyThemeName,
    splitterPct,
    sidebarOpen,
    docOpen,
    chatOpen,
    auditOpen,
    trackingOpen,
    activeModal,
    openModal,
    closeModal,
    toggleV2Theme,
    setSplitterPct,
    openSidebar,
    openDoc,
    openChat,
    openAudit,
    openTracking,
    closeAllDrawers,
  };
});

export type { ThemeVariant };
