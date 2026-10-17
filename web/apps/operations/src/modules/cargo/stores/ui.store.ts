import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const STORAGE_KEY = "cargo_express.theme";
const V2_STORAGE_KEY = "cargo_express.ui_v2";

/**
 * Theme variants. v1 = legacy SPA (kept until rollback window closes).
 * v2 = Mockup 2 redesign, ported from shipment_express.
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

/**
 * Names of the cargo modals registered in `CargoModals.vue`. Mirrors
 * the shipment ui store contract so generic shell components
 * (ModalWrapper, Splitter) can be reused verbatim.
 */
export type ModalName =
  | "cliente"
  | "pickup"
  | "dest"
  | "agency"
  | "handler"
  | "colli"
  | "costi"
  | "servizio"
  | "mawb"
  | "flights"
  | "consolidation"
  | "flight_search"
  | "customs"
  | "insurance"
  | "cod"
  | "supplements"
  | "stato"
  | "delivery"
  | "cotizacion"
  | "partners"
  | "cancel_cargo"
  | "email_document"
  | "validate_ldv"
  | "booking_confirm"
  | "booking_detail"
  | "booking_cancel"
  | "hawb_form"
  | "hawb_list"
  | "tact_detail"
  | "pricing_breakdown"
  | "flight_legs_manual"
  | "currency_day"
  | "post_invoice"
  | "dgr"
  | null;

// Id propio ("cargo_ui", no "ui"): shipment/stores/ui.store.ts registraba
// también `defineStore("ui")`. Al convivir ambos módulos en la app
// `operations`, Pinia devolvía SIEMPRE el primero registrado y el segundo
// quedaba inerte — con distinta clave de localStorage para el tema y una
// unión de modales distinta (mawb/flights/consolidation solo existen aquí),
// así que abrir un modal de cargo podía no hacer nada. Los dos stores NO se
// fusionan: solo comparten el bloque de tema; el resto es disjunto por dominio.
export const useUiStore = defineStore("cargo_ui", () => {
  // ─── Legacy v1 surface (preserved for backwards compat) ────
  const loading = ref(false);
  const error = ref<string | null>(null);
  const themeMode = ref<"light" | "dark">(resolveInitialThemeMode());

  // v2 themes are the canonical surface palette; expose via the legacy
  // `vuetifyThemeName` key so existing bindings keep working.
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

  // Single-modal stack — only one open at a time per the mockup design.
  const activeModal = ref<ModalName>(null);

  // Active detail tab ('overview' | 'flights'). Shared here so overview cards
  // can deep-link into the "Voli & MAWB" tab (where the MAWB form + HAWB list
  // live), making those editors reachable from the Riepilogo.
  const activeCargoTab = ref<"overview" | "flights">("overview");
  function goToTab(tab: "overview" | "flights"): void {
    activeCargoTab.value = tab;
  }

  /**
   * Document kind targeted by the `email_document` modal. Set just
   * before opening so the modal title, default subject and the
   * backend `type` param can adapt without proliferating per-doc
   * modal components. Defaults to `mawb`, which is what the AWB docs
   * bar (INVIA) sends.
   */
  type EmailableType =
    | "mawb"
    | "hawb"
    | "manifest"
    | "pouch"
    | "mawb_colli"
    | "hawb_colli";
  const pendingEmailType = ref<EmailableType>("mawb");

  /**
   * HAWB id that the HawbFormModal must edit. Set just before
   * `openModal('hawb_form')` so the modal can resolve the row from the
   * HAWB store without leaking the id through route params.
   */
  const pendingHawbId = ref<number | null>(null);

  /**
   * Which tab the unified "Cotización" modal opens on: the carrier RFQ
   * table (`carriers`) or the client offer (`client`). Set just before
   * `openCotizacionModal(tab)` so both the summary card and the Azioni
   * InfoRow can deep-link into their side of the quote.
   */
  const pendingCotizacionTab = ref<"carriers" | "client">("carriers");

  /**
   * Tab activo del modal de aduanas: 'customs' (bloques export/import) o
   * 'notify' (notificar agencias). Todo el trabajo de aduanas vive en este
   * modal; la fila de Azioni y el botón "Notificar agencia" lo abren en su tab.
   */
  const customsTab = ref<"customs" | "notify">("customs");

  function openModal(name: Exclude<ModalName, null>): void {
    activeModal.value = name;
  }

  /** Abre el modal de aduanas en un tab concreto. */
  function openCustomsModal(tab: "customs" | "notify" = "customs"): void {
    customsTab.value = tab;
    activeModal.value = "customs";
  }

  /** Open the unified quote modal on a specific tab. */
  function openCotizacionModal(tab: "carriers" | "client" = "carriers"): void {
    pendingCotizacionTab.value = tab;
    activeModal.value = "cotizacion";
  }

  /** Convenience for the email_document modal — sets the kind + opens. */
  function openEmailDocumentModal(type: EmailableType): void {
    pendingEmailType.value = type;
    activeModal.value = "email_document";
  }

  /** Open HawbFormModal scoped to a specific HAWB row. */
  function openHawbFormModal(hawb_id: number): void {
    pendingHawbId.value = hawb_id;
    activeModal.value = "hawb_form";
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
  }

  function openAudit(): void {
    auditOpen.value = true;
    sidebarOpen.value = false;
    docOpen.value = false;
    chatOpen.value = false;
  }

  function closeAllDrawers(): void {
    sidebarOpen.value = false;
    docOpen.value = false;
    chatOpen.value = false;
    auditOpen.value = false;
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
    openAudit,
    activeModal,
    activeCargoTab,
    goToTab,
    pendingEmailType,
    pendingHawbId,
    openHawbFormModal,
    pendingCotizacionTab,
    openCotizacionModal,
    customsTab,
    openCustomsModal,
    openModal,
    openEmailDocumentModal,
    closeModal,
    toggleV2Theme,
    setSplitterPct,
    openSidebar,
    openDoc,
    openChat,
    closeAllDrawers,
  };
});

export type { ThemeVariant };
