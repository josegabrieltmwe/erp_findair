/**
 * Composable extracted from CargoFlightSearch.vue so the SFC stays under
 * the 400-line DoD policy (plan v2 § 5.1). Behaviour byte-equivalent to
 * the original — same state, same SSE handling, same 2-step wizard.
 *
 * The SFC keeps only the template + a thin <script setup> that calls
 * this composable and destructures the returned API.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { useUiStore } from "@cargo/stores/ui.store";
import {
  openFlightSearchStream,
  normalizeRate,
  rateKey,
  providerOf,
  kindOf,
  type NormalizedRate,
  type FlightSearchParams as FSParams,
  type FlightSearchProgress,
  emptyFilters,
  resetRowSeq,
  matchesFilters,
  filterToday,
  type FlightFiltersModel,
} from "@cargo/services/flight_search.service";

import { stripCarrierMarkup } from "@cargo/utils/carrierName";
import { isPastDate, serverToday } from "@cargo/utils/serverTime";

export function useCargoFlightSearch() {
  const cargoStore = useCargoStore();
  const flightManager = useCargoFlightManagerStore();
  const { cargo } = storeToRefs(cargoStore);
  const toasts = useToastStore();
  const ui = useUiStore();
  const { t } = useI18n();

  const tPastDate = (): string => t("cargo.flight.error_date_past");

  interface ParamsModel {
    origin: string;
    destination: string;
    weight: string;
    date: string;
    /**
     * Pre-search source toggles. Always initialised explicitly (see `params`
     * below): leaving them undefined made `x !== false` evaluate to true, so an
     * untouched form asked the backend for EVERY source while the checkboxes —
     * which render on `=== true` — showed them all unticked.
     */
    include_published?: boolean;
    include_realtime?: boolean;
    /** Cotizar con la cuenta directa de TMWE IT (sin delegación de ruta). */
    include_realtime_direct?: boolean;
    credential_ids?: number[];
    include_klm?: boolean;
    include_klm_quotes?: boolean;
    /**
     * Partner whose credential the operator accepted for this search.
     *
     * Only set when a DELEGATED source was ticked on purpose. The backend
     * treats it as an explicit override of its own precedence, so leaving it
     * undefined keeps the previous behaviour exactly.
     */
    via_partner?: number;
  }

  const params = ref<ParamsModel>({
    origin: "",
    destination: "",
    weight: "",
    date: "",
    // No source is requested until the operator ticks one. The checkboxes
    // render on `=== true`, so anything other than an explicit false here
    // would show unticked while still being sent as true.
    include_published: false,
    include_realtime: false,
    include_realtime_direct: false,
    include_klm: false,
    include_klm_quotes: false,
  });
  const filters = ref<FlightFiltersModel>(emptyFilters());

  watch(
    () => [ui.activeModal, cargo.value?.id],
    () => {
      if (ui.activeModal !== "flight_search") return;
      const c = cargo.value;
      if (!c) return;
      if (!params.value.origin)
        params.value.origin = (c.terminal_part ?? "") as string;
      if (!params.value.destination)
        params.value.destination = (c.terminal_dest ?? "") as string;
      if (!params.value.weight)
        params.value.weight = String(c.peso ?? c.pesor ?? "");
      if (!params.value.date)
        params.value.date = (c.data_sped1 ?? c.data_sped0 ?? "") as string;
    },
    { immediate: true },
  );

  /**
   * "Today" según el SERVIDOR (no el reloj del cliente, que puede estar mal).
   * Se usa como `min` del input de fecha y para validar la fecha de aceptación.
   */
  const minDate = computed<string>(() => serverToday());

  /**
   * True si la fecha elegida está en el pasado respecto al servidor. WebCargo
   * no cotiza vuelos con fecha de aceptación pasada (devuelve 0 tarifas), así
   * que se bloquea el envío antes de gastar la consulta.
   */
  const isDatePast = computed<boolean>(() => isPastDate(params.value.date));

  const canSearch = computed<boolean>(() => {
    const p = params.value;
    return Boolean(
      p.origin &&
      p.destination &&
      p.weight &&
      p.date &&
      cargo.value?.id &&
      !isDatePast.value,
    );
  });

  const rates = ref<NormalizedRate[]>([]);
  const ratesIndex = new Map<string, number>();
  const searching = ref(false);
  type SearchOutcome = "idle" | "running" | "completed" | "error" | "cancelled";
  const searchOutcome = ref<SearchOutcome>("idle");
  const lastQuery = ref<FSParams | null>(null);
  const lastError = ref<string | null>(null);
  const progress = ref<FlightSearchProgress | null>(null);
  const airlineStatus = ref<
    Record<string, "pending" | "rates" | "error" | "empty">
  >({});

  /**
   * Estado REAL de cada fuente, tal y como lo cuenta el backend.
   *
   * Antes no existia: el chip de cada fuente inferia su estado de
   * `count === 0 && searching`, asi que una fuente que respondia con CERO
   * tarifas seguia girando hasta el final de la busqueda entera y entonces
   * saltaba a un tick verde — anunciando "completada con exito" justo lo que
   * no habia traido nada.
   *
   * El backend ya emitia el dato (`phase` con `status: started|completed`,
   * `total_rates` y `error`); solo habia que dejar de tirarlo.
   */
  type SourceState = "pending" | "running" | "done" | "error";
  const sourceStatus = ref<Record<string, SourceState>>({});

  /**
   * Fase del backend → clave de fuente del panel.
   *
   * Las fases no se llaman igual que las fuentes de las tarifas: el backend
   * dice `klm_live`/`klm_quotes` y las tarifas llegan con `source` `klm`/
   * `klm_quote`. Sin esta tabla el estado se escribiria bajo una clave que
   * ningun chip lee, y todos se quedarian en "pending" para siempre.
   */
  const PHASE_TO_SOURCE: Record<string, string> = {
    published: "published",
    realtime: "realtime",
    klm_live: "klm",
    klm_quotes: "klm_quote",
  };

  const selectedKey = ref<string | null>(null);
  /**
   * Pantalla activa. El formulario ya no es un paso: vive en su propio dialogo
   * apilado sobre el listado (`paramsOpen` en el componente), de modo que
   * cerrarlo devuelve a los resultados en lugar de sustituirlos.
   */
  type Step = "results" | "confirm";
  const step = ref<Step>("results");
  const selectedRate = ref<NormalizedRate | null>(null);
  const persisting = ref(false);
  const persistingMessage = ref<string>("");
  const persistError = ref<string | null>(null);

  const detailOpen = ref(false);
  const detailRate = ref<NormalizedRate | null>(null);

  let stream: { abort(): void } | null = null;

  function resetSearchState(): void {
    // La numeracion de filas arranca de cero en cada busqueda.
    resetRowSeq();
    rates.value = [];
    ratesIndex.clear();
    lastError.value = null;
    searchOutcome.value = "idle";
    progress.value = null;
    airlineStatus.value = {};
    sourceStatus.value = {};
    selectedKey.value = null;
    filters.value = {
      carriers: [],
      sources: [],
      providers: [],
      kinds: [],
      directOnly: false,
      maxStops: null,
      priceRange: null,
      maxTransitHours: null,
      promotionalOnly: false,
      validNow: false,
      products: [],
      serviceTypes: [],
    };
  }

  function defaultProgress(): FlightSearchProgress {
    return {
      phase: "",
      percent: 0,
      phase_percent: 0,
      completed: 0,
      total: 0,
      rates_received: 0,
    };
  }

  function startSearch(): void {
    if (!cargo.value?.id) return;
    // Guardia dura: nunca enviar una consulta con fecha en el pasado (fecha del
    // servidor). Evita quemar la consulta a WebCargo (0 tarifas garantizadas).
    if (isDatePast.value) {
      toasts.push("error", tPastDate());
      return;
    }
    if (!canSearch.value) return;
    stream?.abort();
    stream = null;
    searching.value = false;
    resetSearchState();

    const query: FSParams = {
      shipment_id: Number(cargo.value.id),
      origin: params.value.origin.toUpperCase(),
      destination: params.value.destination.toUpperCase(),
      weight: Number(params.value.weight) || undefined,
      date: params.value.date,
      // Send exactly what the operator ticked. These are `=== true` (not
      // `!== false`) on purpose: the flags start out false, and `!== false`
      // would turn an untouched form into "request every source" while the
      // checkboxes showed them all unticked.
      include_published: params.value.include_published === true,
      include_realtime: params.value.include_realtime === true,
      include_realtime_direct: params.value.include_realtime_direct === true,
      credential_ids: params.value.credential_ids,
      include_klm: params.value.include_klm === true,
      // Sent explicitly: omitting it makes the server default it to
      // include_klm, so KLM/AF Rates would drag the firm-quote phase along.
      include_klm_quotes: params.value.include_klm_quotes === true,
      // This modal quotes air freight only. The server defaults both courier
      // phases to true, so they have to be switched off here or they run on
      // every search — ~4s and a batch of courier API errors for nothing.
      include_courier_live: false,
      include_courier: false,
      // Travels only when a delegated source was accepted; otherwise the
      // backend resolves credentials as it always did.
      ...(params.value.via_partner
        ? { via_partner: params.value.via_partner }
        : {}),
    };
    lastQuery.value = query;
    searching.value = true;
    searchOutcome.value = "running";

    stream = openFlightSearchStream(query, (ev) => {
      if (ev.type === "connected") return;
      if (ev.type === "permissions") return;
      if (ev.type === "phase") {
        progress.value = {
          ...(progress.value ?? defaultProgress()),
          phase: ev.data.phase,
        };
        // Estado por fuente. `completed` con `error` es un fallo; `completed`
        // sin tarifas NO lo es (la fuente respondio, simplemente no cubre la
        // ruta) y por eso ambos se distinguen aqui en vez de colapsarse.
        const src = PHASE_TO_SOURCE[ev.data.phase];
        if (src) {
          if (ev.data.status === "started") {
            sourceStatus.value[src] = "running";
          } else if (ev.data.status === "completed") {
            sourceStatus.value[src] = ev.data.error ? "error" : "done";
          }
        }
        return;
      }
      if (ev.type === "progress") {
        progress.value = ev.data;
        if (ev.data.airline && !airlineStatus.value[ev.data.airline]) {
          airlineStatus.value[ev.data.airline] = "pending";
        }
        return;
      }
      if (ev.type === "rate") {
        airlineStatus.value[ev.airline] =
          ev.rates.length > 0 ? "rates" : "empty";
        for (const raw of ev.rates) {
          if (ev.source && !raw.source) raw.source = ev.source;
          if (ev.airline && !raw.airline_code) raw.airline_code = ev.airline;
          const n = normalizeRate(raw);
          const k = rateKey(n);
          const existing = ratesIndex.get(k);
          if (existing !== undefined) {
            rates.value[existing] = n;
          } else {
            ratesIndex.set(k, rates.value.length);
            rates.value.push(n);
          }
        }
        return;
      }
      if (ev.type === "rate_error") {
        airlineStatus.value[ev.airline] = "error";
        return;
      }
      if (ev.type === "complete") {
        searching.value = false;
        searchOutcome.value = "completed";
        settlePendingSources();
        return;
      }
      if (ev.type === "error") {
        console.error("[flight-search] stream failed", ev.message);
        lastError.value = t("cargo.flight.search_error_text");
        searching.value = false;
        searchOutcome.value = "error";
        settlePendingSources();
      }
    });
  }

  /**
   * Ninguna fuente sigue "en curso" cuando ya no hay busqueda.
   *
   * El backend cierra cada fase con su `completed`, pero un `complete` global,
   * un `error` de stream o un aborto manual cortan antes de que lleguen los
   * cierres pendientes. Sin esto el chip de esa fuente se quedaria animado
   * indefinidamente sobre una busqueda ya terminada — el mismo spinner
   * fantasma, solo que por otra via.
   */
  function settlePendingSources(): void {
    for (const k of Object.keys(sourceStatus.value)) {
      if (sourceStatus.value[k] === "running") sourceStatus.value[k] = "done";
    }
  }

  function stopSearch(): void {
    const wasSearching = searching.value;
    stream?.abort();
    stream = null;
    searching.value = false;
    if (wasSearching) searchOutcome.value = "cancelled";
    settlePendingSources();
  }

  const progressPercent = computed<number>(() => {
    const p = progress.value;
    if (!p) return 0;
    return Math.min(100, Math.max(0, Math.round(p.percent || 0)));
  });

  const realtimeCount = computed(
    () => rates.value.filter((r) => r.source === "realtime").length,
  );
  const publishedCount = computed(
    () => rates.value.filter((r) => r.source === "published").length,
  );

  const airlineStatuses = computed(() =>
    Object.entries(airlineStatus.value)
      .filter(([code]) => code)
      .map(([code, status]) => ({ code, status })),
  );

  /**
   * Roll the per-airline pills into two counters.
   *
   * A real search queries ~38 carriers and only a handful come back with
   * flights, so rendering one chip each buried the useful signal in a wall of
   * red. The counts answer the question the operator actually has — did enough
   * carriers answer? — and the full list stays one click away.
   */
  const airlineSummary = computed(() => {
    const withRates: string[] = [];
    const without: string[] = [];
    const pending: string[] = [];

    for (const a of airlineStatuses.value) {
      if (a.status === "rates") withRates.push(a.code);
      else if (a.status === "error" || a.status === "empty")
        without.push(a.code);
      else pending.push(a.code);
    }
    return {
      withRates,
      without,
      pending,
      total: airlineStatuses.value.length,
    };
  });

  const airlineDetailOpen = ref(false);

  function pillColor(s: string): string {
    if (s === "rates") return "success";
    if (s === "error") return "error";
    if (s === "empty") return "grey";
    return "info";
  }
  function pillIcon(s: string): string {
    if (s === "rates") return "mdi-check-circle";
    if (s === "error") return "mdi-alert-circle";
    if (s === "empty") return "mdi-minus-circle-outline";
    return "mdi-progress-clock";
  }

  const filteredRates = computed<NormalizedRate[]>(() => {
    const f = filters.value;
    const today = filterToday();
    return rates.value.filter((r) => matchesFilters(r, f, today));
  });

  function openDetail(rate: NormalizedRate): void {
    detailRate.value = rate;
    detailOpen.value = true;
  }

  /**
   * Seleccionar un vuelo del listado.
   *
   * NUNCA puede salir en silencio. El listado se oculta con
   * `step !== 'confirm'` pero el wizard se monta con
   * `step === 'confirm' && selectedRate && cargo?.id`: dos condiciones
   * DISTINTAS, y la del wizard es mas estricta. Si faltaba `cargo.id` el
   * listado se cerraba, el wizard no aparecia y no habia ni error ni peticion
   * — el operador veia desaparecer el modal y nada mas.
   *
   * Ahora el paso a 'confirm' solo ocurre si el wizard va a poder montarse.
   * Si no, se queda en el listado y se dice por que.
   */
  function onSelectRate(rate: NormalizedRate): void {
    if (!cargo.value?.id) {
      persistError.value = t("cargo.flight.error_no_shipment");
      console.error("[flight-search] select aborted: cargo.id missing", {
        cargo: cargo.value,
        rate_key: rateKey(rate),
      });
      return;
    }
    selectedRate.value = rate;
    selectedKey.value = rateKey(rate);
    persistError.value = null;
    detailOpen.value = false;
    step.value = "confirm";
  }

  function backToResults(): void {
    step.value = "results";
    persistError.value = null;
    persistingMessage.value = "";
  }

  async function performAssignment(): Promise<void> {
    // Ningún camino puede salir en silencio.
    //
    // Este guard hacía `return` sin mensaje ni log: al confirmar el wizard se
    // cerraba el paso, no salía ninguna petición y el operador no tenía forma
    // de saber por qué. Un fallo mudo en la acción que ASIGNA el vuelo a la
    // expedición es peor que un error feo — parece que se guardó y no se
    // guardó nada.
    if (!cargo.value?.id) {
      persistError.value =
        "No se puede asignar: la expedición no está cargada. Recarga la página e inténtalo de nuevo.";
      console.error("[flight-search] assignment aborted: cargo.id missing", {
        cargo: cargo.value,
      });
      return;
    }
    if (!selectedRate.value) {
      persistError.value =
        "No se puede asignar: no hay ninguna tarifa seleccionada.";
      console.error("[flight-search] assignment aborted: selectedRate is null");
      return;
    }

    const rate = selectedRate.value;
    const shortId = (rate as { short_id?: string }).short_id;
    // Present once the backend runs in modern mode: it identifies the exact
    // priced version shown, instead of a cache row that may have moved on.
    const pricingSnapshotId = (rate as { pricing_snapshot_id?: string })
      .pricing_snapshot_id;

    // A rate the backend marked unselectable must not be assignable, whatever
    // identifiers it carries — typically its price could not be computed, and
    // the amount on screen is the supplier cost rather than a real offer.
    const notSelectable =
      (rate as { selectable?: boolean }).selectable === false;
    if (notSelectable) {
      const reason =
        (rate as { not_selectable_reason?: string }).not_selectable_reason ??
        "";
      // El motivo manda sobre el mensaje. `quote_on_request` NO es un fallo
      // recuperable: el carrier no tarifa esa ruta automáticamente, así que
      // invitar a relanzar la búsqueda —lo que hacía el texto único— hace
      // perder el tiempo al operador. Se conserva el genérico para los fallos
      // técnicos de verdad.
      if (reason.startsWith("quote_on_request")) {
        const detail = reason.split(":")[1] ?? "";
        persistError.value =
          detail === "MANUAL_LOAD_CHECK"
            ? t("cargo.flight.quote_manual_load_check")
            : t("cargo.flight.quote_on_request");
      } else {
        persistError.value =
          t("cargo.flight.rate_not_assignable") +
          (reason ? ` (${reason})` : "") +
          ". " +
          t("cargo.flight.relaunch_search");
      }
      return;
    }

    if (!shortId && !pricingSnapshotId) {
      // Pasa con tarifas que no vienen de la caché de tarifas (p. ej. una
      // published sin `rate_id`): no hay nada que el backend pueda resolver.
      persistError.value =
        "Esta tarifa no tiene un identificador válido y no puede asignarse. " +
        "Vuelve a lanzar la búsqueda para obtener tarifas nuevas.";
      console.error(
        "[flight-search] assignment aborted: rate has neither pricing_snapshot_id nor short_id",
        {
          airline: rate.airline_code,
          source: rate.source,
        },
      );
      return;
    }
    persisting.value = true;
    persistError.value = null;
    persistingMessage.value = flightManager.hasActiveBooking
      ? "Annullamento prenotazione corrente, pulizia e assegnazione…"
      : "Assegnazione tariffa…";

    try {
      const ok = await flightManager.selectRate(shortId ?? "", {
        cancelBookingIfActive: flightManager.hasActiveBooking,
        pricingSnapshotId,
      });
      if (!ok) {
        persistError.value = flightManager.error ?? "Selezione fallita";
        return;
      }
      toasts.push("success", `Tariffa ${rate.airline_code} assegnata al cargo`);
      await cargoStore.load(Number(cargo.value.id));
      step.value = "results";
      selectedRate.value = null;
      ui.closeModal();
    } finally {
      persisting.value = false;
      persistingMessage.value = "";
    }
  }

  const currentRateSnapshot = computed(() => {
    const c = cargo.value;
    if (!c) return null;
    const sigla =
      (c.vettore_sigla as string | undefined) ||
      (c.flight_num1 as string | undefined)?.slice(0, 2) ||
      "";
    if (!sigla && !c.terminal_part && !c.terminal_dest) return null;
    return {
      airline_code: sigla,
      airline_name: stripCarrierMarkup(c.vettore_nome) || sigla,
      origin: (c.terminal_part as string | undefined) ?? "",
      destination: (c.terminal_dest as string | undefined) ?? "",
      price: Number(c.carico_volo ?? 0) || undefined,
      currency: (c.valuta_target as string | undefined) ?? "EUR",
      transit_hours: undefined,
    };
  });

  return {
    // store handles — the template references `cargo` for the wizard
    // condition (`step === 'confirm' && selectedRate && cargo?.id`) and
    // `flightManager` for the active-booking decisions inside the wizard.
    cargo,
    flightManager,
    // state
    params,
    filters,
    rates,
    searching,
    searchOutcome,
    lastQuery,
    lastError,
    progress,
    airlineStatus,
    sourceStatus,
    selectedKey,
    step,
    selectedRate,
    persisting,
    persistingMessage,
    persistError,
    detailOpen,
    detailRate,
    // computeds
    canSearch,
    minDate,
    isDatePast,
    dateError: computed<string | null>(() =>
      isDatePast.value ? tPastDate() : null,
    ),
    progressPercent,
    realtimeCount,
    publishedCount,
    airlineStatuses,
    airlineSummary,
    airlineDetailOpen,
    filteredRates,
    currentRateSnapshot,
    // methods
    startSearch,
    stopSearch,
    pillColor,
    pillIcon,
    openDetail,
    onSelectRate,
    backToResults,
    performAssignment,
  };
}
