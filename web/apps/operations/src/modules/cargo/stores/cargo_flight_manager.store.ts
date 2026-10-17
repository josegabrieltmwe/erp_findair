import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  webcargoRateService,
  isModernShortId,
  type WebcargoRate,
} from "@cargo/services/webcargo_rate.service";
import {
  bookingService,
  type BookingSummary,
  type BookingStatus,
} from "@cargo/services/booking.service";
import { klmBookingService } from "@cargo/services/klm_booking.service";
import {
  providerForBookingId,
  providerForShortId,
} from "@cargo/services/booking_provider";
import { klmRateService, isKlmShortId } from "@cargo/services/klm_rate.service";
import { rateService } from "@cargo/services/rate.service";

/**
 * Cargo flight manager store — mirrors the legacy `cargo_flight_manager.js`
 * lifecycle. Tracks **two independent resources** keyed by the cargo's
 * `id_rate_webcargo` (short_id):
 *
 *   - **rate**:    cached realtime/published rate snapshot. May expire (TTL).
 *   - **booking**: WebCargo booking record (pending / confirmed / canceled).
 *
 * Both are fetched in parallel by `hydrate()` so the card never flickers
 * between "no booking" and "booking chip appears" on first render.
 *
 * Render state derives directly from the two refs:
 *
 *   loading                       → fetches in flight
 *   hasActiveBooking && !rate     → booking-only (rate cache expired)
 *   !rate && !error               → empty (search button)
 *   error && !rate                → error (retry + search/cancel)
 *   rate (+ booking chip if any)  → normal flight card
 *
 * Actions kept separate (legacy parity — selecting ≠ booking):
 *
 *   - select(shortId)        → rate_clear + rate_select
 *   - cancelRate()           → rate_clear
 *   - book()                 → webcargo_booking (POST) — explicit action
 *   - cancelBooking(reason?) → webcargo_booking_cancel
 *
 * Selecting a new rate when a booking is already active is the
 * cancel+clear+select cascade (legacy `flight_search_dialog.confirmSelection`).
 */
export const useCargoFlightManagerStore = defineStore(
  "cargoFlightManager",
  () => {
    const shipmentId = ref<number | null>(null);
    const currentShortId = ref<string>("");
    /**
     * Immutable priced version accepted at selection time. Kept alongside
     * `currentShortId` — not instead of it — because it is what makes booking
     * safe: without it, book() had no way to prove it was reserving the exact
     * version the operator just confirmed, and fell back to re-resolving a
     * short_id against the mutable rate cache, which can have moved on by the
     * time the operator clicks "Book".
     */
    const currentPricingSnapshotId = ref<string>("");

    const rate = ref<WebcargoRate | null>(null);
    const booking = ref<BookingSummary | null>(null);

    const loading = ref(false);
    const error = ref<string | null>(null);
    /**
     * Codigo de error del backend (QUOTE_EXPIRED, AWB_PREFIX_MISSING, …).
     *
     * Viajaba en la respuesta pero se descartaba aqui, asi que lo unico que
     * llegaba a la pantalla era el `error` en ingles del carrier — el operador
     * acababa leyendo el JSON crudo de la API. Con el codigo se puede elegir un
     * mensaje traducido y accionable, dejando el texto tecnico como detalle.
     */
    const errorCode = ref<string | null>(null);

    // Per-action busy flags (so the UI can show specific spinners).
    const selecting = ref(false);
    const cancellingRate = ref(false);
    const booking_in_flight = ref(false);
    const cancellingBooking = ref(false);
    /** Última cancelación con resultado desconocido (timeout del carrier). */
    const cancelIndeterminate = ref(false);

    // ─── Derived state ──────────────────────────────────────────────
    const bookingStatus = computed<BookingStatus | null>(
      () => booking.value?.status ?? null,
    );
    const bookingId = computed<string | null>(
      () => booking.value?.booking_id ?? null,
    );
    const bookingAwb = computed<string | null>(
      () => (booking.value?.awb_number as string | undefined) ?? null,
    );

    const hasActiveBooking = computed(
      () =>
        !!bookingId.value &&
        (bookingStatus.value === "pending" ||
          bookingStatus.value === "confirmed"),
    );

    type RenderState = "loading" | "booking-only" | "empty" | "error" | "rate";
    const renderState = computed<RenderState>(() => {
      if (loading.value) return "loading";
      if (hasActiveBooking.value && !rate.value) return "booking-only";
      if (error.value && !rate.value) return "error";
      if (!rate.value) return "empty";
      return "rate";
    });

    // ─── Lifecycle ──────────────────────────────────────────────────

    /**
     * Hydrate from the cargo row. Pass both the shipment id and the
     * current `id_rate_webcargo` (short_id from spedizioni_cargo). Calls
     * rate-detail and booking-by-short-id in parallel.
     */
    async function hydrate(
      shipId: number,
      shortId: string | null | undefined,
    ): Promise<void> {
      shipmentId.value = shipId;
      currentShortId.value = shortId ?? "";
      // Hydrating from the cargo row only ever gives us a short_id (spedizioni_
      // cargo.id_rate_webcargo) — the pricing snapshot behind it is not stored
      // there, so it cannot be recovered on reload. book() falls back to
      // short_id in that case; only a selectRate() in the current session
      // carries the stronger guarantee.
      currentPricingSnapshotId.value = "";
      loading.value = true;
      error.value = null;
      errorCode.value = null;
      rate.value = null;
      booking.value = null;

      if (!shortId) {
        loading.value = false;
        return;
      }

      // Enrutado por carrier: un rate KLM lleva el prefijo `klm_` y NO se
      // resuelve por el endpoint de WebCargo — cada uno tiene su cache.
      //
      // Antes esta rama devolvia una promesa VACIA, asi que `rate` se quedaba
      // en null y `renderState` caia a `empty`: con un vuelo KLM asignado la
      // ficha decia "No flight selected" y no ofrecia ni Book ni Remove,
      // mientras que con WebCargo funcionaba. El endpoint ya existia; faltaban
      // el servicio TS y un wrapper Web_* que aceptara cookie de sesion.
      const isKlm = isKlmShortId(shortId);

      const ratePromise = (
        isKlm
          ? klmRateService.getRateDetail(shortId)
          : webcargoRateService.getRateDetail(shortId)
      ).then((r) => {
        if (r) {
          // `source` no viene en la respuesta de detalle de KLM —solo en los
          // resultados de búsqueda— y aquí ya se sabe cuál es. Y no basta con
          // "es KLM": una quote firme es `klm_quote` y una tarifa de catálogo
          // `klm`; de esa distinción depende que la UI la etiquete como
          // cotización en vez de como published. Se detecta por `quote_id`.
          //
          // Los segmentos NO se tocan aquí: llegan anidados en `rate_data` y de
          // izarlos se encarga `segmentsFromRate()`, que ya sabe traducir la
          // forma de cada proveedor (KLM y WebCargo la tienen distinta).
          const inner = (r as { rate_data?: Record<string, unknown> }).rate_data ?? {};
          const isQuote = Boolean(
            (r as { quote_id?: unknown }).quote_id ?? inner.quote_id,
          );
          rate.value = {
            source: isKlm ? (isQuote ? "klm_quote" : "klm") : "published",
            ...r,
          };
        } else {
          error.value = "Rate not found or expired";
        }
      });

      // Booking lookup, por carrier — igual que book() y cancel().
      //
      // Antes era WebCargo-only: una reserva KLM existente NO se hidrataba, así
      // que al recargar la ficha desaparecía de la vista (sólo se veía si se
      // había creado en esa misma sesión). Eso dejaba al operador con un vuelo
      // aparentemente sin reservar cuya tarifa, sin embargo, no se dejaba
      // reservar de nuevo porque la reserva sí existía en la base de datos.
      const bookingPromise = isKlm
        ? klmBookingService.getByShortId(shortId).then((b) => {
            if (b) booking.value = b;
          })
        : isModernShortId(shortId)
          ? bookingService.getByShortId(shortId).then((b) => {
              if (b) booking.value = b;
            })
          : Promise.resolve();

      await Promise.all([ratePromise, bookingPromise]);
      loading.value = false;
    }

    // ─── Actions: rate selection lifecycle ───────────────────────────

    /**
     * Select a new rate. When a booking is currently active, the legacy
     * cascade is:
     *   1. webcargo_booking_cancel  (if hasActiveBooking)
     *   2. rate_clear
     *   3. rate_select
     * Returns true on success.
     */
    async function selectRate(
      shortId: string,
      opts: {
        cancelBookingIfActive?: boolean;
        /**
         * Immutable priced version the operator accepted. When present it wins
         * over `shortId`, which resolves a mutable cache row and therefore
         * cannot guarantee the price that was on screen.
         */
        pricingSnapshotId?: string;
      } = {},
    ): Promise<boolean> {
      if (!shipmentId.value) return false;
      if (!shortId && !opts.pricingSnapshotId) return false;
      selecting.value = true;
      error.value = null;
      errorCode.value = null;
      try {
        if (hasActiveBooking.value && opts.cancelBookingIfActive) {
          const ok = await internalCancelBooking("Replacing with new flight");
          if (!ok) return false;
        }

        const clr = await rateService.clear(shipmentId.value);
        if (!clr.success) {
          error.value = clr.error ?? "Rate clear failed";
          return false;
        }

        const sel = await rateService.select({
          shipmentId: shipmentId.value,
          shortId,
          pricingSnapshotId: opts.pricingSnapshotId,
        });
        if (!sel.success) {
          error.value = sel.error ?? "Rate select failed";
          return false;
        }

        const selectionData = sel.data as
          | {
              itinerary_applied?: boolean;
              current_selection?: boolean;
              pricing_snapshot_id?: string;
            }
          | undefined;
        if (
          opts.pricingSnapshotId &&
          (selectionData?.itinerary_applied !== true ||
            selectionData?.current_selection !== true)
        ) {
          error.value =
            "La tariffa è stata ricevuta, ma il volo non risulta applicato. Riprova senza chiudere questa finestra.";
          errorCode.value = "SELECTION_INCONSISTENT";
          return false;
        }

        // Refresh local state. hydrate() resets currentPricingSnapshotId to ""
        // (it cannot recover it from spedizioni_cargo), so the snapshot id
        // must be set AFTER hydrate() resolves, not before. It comes from the
        // BACKEND's response, not from opts — the backend is the one that
        // resolved and froze the exact version, and echoing back what the
        // caller sent would defeat the point of asking it to confirm.
        currentShortId.value = shortId;
        await hydrate(shipmentId.value, shortId);
        currentPricingSnapshotId.value = selectionData?.pricing_snapshot_id ?? "";
        return true;
      } finally {
        selecting.value = false;
      }
    }

    /**
     * Quitar el vuelo del cargo: cancela la reserva si la hay y desasocia el
     * rate. UNA sola acción, porque para el operador «quitar el vuelo» es UNA
     * sola intención.
     *
     * Antes esto era `rate_clear` a secas y la UI lo compensaba escondiendo el
     * botón mientras hubiera reserva activa (paridad legacy), lo que dejaba dos
     * problemas: con un vuelo realtime reservado NO había forma de quitarlo
     * desde la tarjeta, y si el botón se hubiera mostrado habría dejado la
     * reserva colgando en el carrier —con su stock de AWB retenido— mientras el
     * cargo ya no la referenciaba.
     *
     * El orden importa: la reserva PRIMERO. Si el carrier rechaza la
     * cancelación (o el resultado es indeterminado por timeout) se aborta sin
     * tocar el rate, porque desasociarlo nos dejaría sin el `booking_id` con el
     * que reintentar.
     *
     * `internalCancelBooking` ya limpia rate + short_id al cancelar (el backend
     * los borra en el mismo movimiento), así que en esa rama no hace falta un
     * `rate_clear` extra.
     */
    async function cancelRate(): Promise<boolean> {
      if (!shipmentId.value) return false;
      cancellingRate.value = true;
      error.value = null;
      errorCode.value = null;
      try {
        if (hasActiveBooking.value) {
          return await internalCancelBooking("Flight removed from shipment");
        }

        const r = await rateService.clear(shipmentId.value);
        if (!r.success) {
          error.value = r.error ?? "Rate clear failed";
          return false;
        }
        rate.value = null;
        currentShortId.value = "";
        currentPricingSnapshotId.value = "";
        return true;
      } finally {
        cancellingRate.value = false;
      }
    }

    // ─── Actions: booking lifecycle ──────────────────────────────────

    /**
     * Create a WebCargo booking for the currently selected rate. Distinct
     * action from selecting — the operator decides when to actually book.
     */
    async function book(
      opts: {
        awbManual?: string;
        awbMode?: "carrier" | "pool" | "manual";
        useTesting?: boolean;
      } = {},
    ): Promise<BookingSummary | null> {
      if (!shipmentId.value || !currentShortId.value) return null;
      if (rate.value?.bookable === false) {
        error.value =
          rate.value.not_bookable_reason ?? "Rate not bookable via API";
        return null;
      }
      booking_in_flight.value = true;
      error.value = null;
      errorCode.value = null;
      try {
        // Enrutado por carrier vía el módulo de proveedores: un único punto
        // que refleja el contrato `Booking_Driver` del backend, en vez de
        // repetir el prefijo aquí, en cancel y en refresh (F3.4).
        const isKlm = providerForShortId(currentShortId.value) === "klm";
        const pricingSnapshotId = currentPricingSnapshotId.value || undefined;
        const bookArgs = {
          shipmentId: shipmentId.value,
          shortId: currentShortId.value,
          pricingSnapshotId,
          // Derived the same way rate.service.ts derives its selection key: a
          // retried booking click (double click, dropped connection) reuses
          // it and maps to the driver's own active_lock instead of minting a
          // second attempt; picking a different rate first changes
          // currentPricingSnapshotId and therefore this key.
          idempotencyKey: pricingSnapshotId
            ? `book-${shipmentId.value}-${pricingSnapshotId.slice(0, 32)}`
            : undefined,
          awbManual: opts.awbManual,
          awbMode: opts.awbMode,
          useTesting: opts.useTesting,
        };
        const r = isKlm
          ? await klmBookingService.book(bookArgs)
          : await bookingService.book(bookArgs);
        if (!r.success || !r.booking) {
          error.value = r.error ?? "Booking failed";
          errorCode.value = r.error_code ?? null;
          return null;
        }
        booking.value = r.booking;
        return r.booking;
      } finally {
        booking_in_flight.value = false;
      }
    }

    async function cancelBooking(reason?: string): Promise<boolean> {
      return internalCancelBooking(reason);
    }

    /**
     * Relee el estado de la reserva.
     *
     * Enrutado por carrier, como book() y cancel(): antes llamaba SIEMPRE al
     * endpoint de WebCargo, así que con una reserva KLM se preguntaba por su
     * estado al proveedor equivocado (y no devolvía nada útil).
     *
     * Las dos ramas NO son equivalentes, a propósito:
     *  - WebCargo tiene `refreshStatus`, que consulta a la API del carrier
     *    (GET /booking) y reescribe las columnas enriquecidas.
     *  - KLM no expone un status barato: lo más cercano sería `manage_booking`,
     *    una escritura contra el carrier. Refrescar es una acción de UI que el
     *    operador puede repetir a voluntad, así que aquí se relee la fila
     *    persistida y NO se llama a KLM. Si en el futuro hace falta el estado
     *    vivo de KLM, debe ser una acción distinta y explícita.
     */
    async function refreshBookingStatus(): Promise<boolean> {
      if (!bookingId.value) return false;
      const before = booking.value?.status;

      if (providerForBookingId(bookingId.value) === "klm") {
        if (!currentShortId.value) return false;
        const fresh = await klmBookingService.getByShortId(
          currentShortId.value,
        );
        if (fresh) {
          booking.value = { ...booking.value, ...fresh };
        }
        return fresh != null && fresh.status !== before;
      }

      const fresh = await bookingService.refreshStatus(bookingId.value);
      if (fresh) {
        booking.value = { ...booking.value, ...fresh };
      }
      return fresh != null && fresh.status !== before;
    }

    // Shared by selectRate() (when replacing booking) and the explicit
    // cancelBooking() action.
    async function internalCancelBooking(reason?: string): Promise<boolean> {
      if (!bookingId.value) return true;
      cancellingBooking.value = true;
      try {
        // Cancelar POR EL MISMO PROVEEDOR con el que se reservo.
        //
        // El book ya enrutaba por carrier (:236) pero el cancel llamaba
        // siempre a WebCargo, asi que cancelar una reserva KLM/AF pegaba
        // contra /api_cargo_webcargo_booking_cancel. klmBookingService.cancel
        // existia y no lo llamaba nadie.
        //
        // Se discrimina por el prefijo del booking_id (klm_book_ / wc_book_),
        // que es el mismo criterio que usa Booking_Dispatcher en el backend
        // (:36-37). No se usa `currentShortId` porque al cancelar puede estar
        // ya vacio: el book lo consume antes de reservar.
        const isKlmBooking = providerForBookingId(bookingId.value) === "klm";
        const r = isKlmBooking
          ? await klmBookingService.cancel(bookingId.value, reason)
          : await bookingService.cancel({
              bookingId: bookingId.value,
              reason,
            });
        if (!r.success) {
          // Un timeout NO es un fallo: el carrier pudo cancelar sin que
          // viéramos la respuesta. Se marca aparte para que la UI pueda decir
          // «verifica antes de reintentar» en vez de «ha fallado», y sobre todo
          // para NO limpiar la reserva de la vista: darla por cancelada sería
          // mentir si el carrier no llegó a cancelarla.
          if (r.indeterminate) {
            cancelIndeterminate.value = true;
            error.value = r.error ?? "Cancellation outcome unknown";
            errorCode.value = r.error_code ?? "CANCEL_TIMEOUT";
            return false;
          }
          error.value = r.error ?? "Booking cancel failed";
          errorCode.value = r.error_code ?? null;
          return false;
        }
        cancelIndeterminate.value = false;
        booking.value = null;
        // Legacy parity: cancelBooking ALSO clears the rate association
        // (releases AWB stock and wipes flight info). The cargo row is
        // reloaded by the page after this action, so we mirror that here.
        rate.value = null;
        currentShortId.value = "";
        currentPricingSnapshotId.value = "";
        return true;
      } finally {
        cancellingBooking.value = false;
      }
    }

    /**
     * Reset the rate/booking side of the flights so the operator can start
     * over. Cancels an active WebCargo/KLM booking first (releasing AWB
     * stock), then clears the rate association. Returns false on the first
     * failure so the caller can surface the error and stop (it must NOT go
     * on to wipe the manual legs if the booking cancel failed).
     *
     * The manual legs (flight_num1..5 etc. on spedizioni_cargo) are NOT this
     * store's concern — the caller clears those via the cargo store after
     * this resolves true (see useFlightReset).
     */
    async function resetFlights(
      opts: {
        cancelBookingReason?: string;
      } = {},
    ): Promise<boolean> {
      if (!shipmentId.value) return false;
      // Misma cascada que «quitar el vuelo» (cancelRate ya cancela la reserva
      // si la hay y libera el stock de AWB); aquí sólo cambia el motivo que se
      // manda al carrier.
      if (hasActiveBooking.value) {
        return internalCancelBooking(
          opts.cancelBookingReason ?? "Reset flights",
        );
      }
      return cancelRate();
    }

    function $reset(): void {
      rate.value = null;
      booking.value = null;
      error.value = null;
      errorCode.value = null;
      currentShortId.value = "";
      currentPricingSnapshotId.value = "";
      shipmentId.value = null;
    }

    return {
      // state
      shipmentId,
      currentShortId,
      currentPricingSnapshotId,
      rate,
      booking,
      loading,
      error,
      errorCode,
      selecting,
      cancellingRate,
      booking_in_flight,
      cancellingBooking,
      cancelIndeterminate,
      // derived
      bookingStatus,
      bookingId,
      bookingAwb,
      hasActiveBooking,
      renderState,
      // actions
      hydrate,
      selectRate,
      cancelRate,
      book,
      cancelBooking,
      refreshBookingStatus,
      resetFlights,
      $reset,
    };
  },
);
