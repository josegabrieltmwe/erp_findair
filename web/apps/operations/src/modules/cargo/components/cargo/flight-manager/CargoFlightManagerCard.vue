<template>
  <section class="flight-manager">
    <!-- ─── 1. LOADING ───────────────────────────────────────────── -->
    <div v-if="state === 'loading'" class="fm-loading">
      <v-progress-circular indeterminate color="primary" size="20" width="2" />
      <span class="text-caption text-medium-emphasis ms-2">{{
        t("cargo.flightmgr.loading_flight")
      }}</span>
    </div>

    <!-- ─── 2. BOOKING-ONLY (rate expired, booking active) ────────── -->
    <div
      v-else-if="state === 'booking-only'"
      class="fm-card fm-card--booking-only"
    >
      <div class="fm-row">
        <v-icon icon="mdi-shield-airplane" size="22" color="primary" />
        <div class="fm-body">
          <div class="d-flex align-center ga-1">
            <span class="font-weight-bold">{{
              store.booking?.airline_code || "—"
            }}</span>
            <v-chip :color="bookingChipColor" size="x-small" variant="flat">
              {{ bookingStatusLabel }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ bookingRoute }}
            <span v-if="store.bookingAwb" class="ms-2">
              <v-icon icon="mdi-barcode" size="x-small" />
              {{ store.bookingAwb }}
            </span>
          </div>
        </div>
        <div class="fm-actions">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-shield-check"
            @click="ui.openModal('booking_detail')"
          >
            {{ t("cargo.flightmgr.detail") }}
          </v-btn>
          <!-- Aqui el rate ya caduco pero la reserva sigue viva, asi que
               «quitar el vuelo» es exactamente «cancelar la reserva»: se usa la
               MISMA accion que en el estado normal para no tener dos botones
               distintos que acaban en el mismo sitio. -->
          <v-btn
            size="small"
            variant="tonal"
            color="error"
            prepend-icon="mdi-close-circle"
            :loading="store.cancellingRate || store.cancellingBooking"
            @click="openCancelRate"
          >
            {{ t("cargo.flightmgr.remove_flight") }}
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ─── 3. EMPTY (no rate, no booking) ───────────────────────── -->
    <div v-else-if="state === 'empty'" class="fm-card">
      <div class="fm-row">
        <v-icon icon="mdi-airplane-off" color="info" size="20" />
        <div class="fm-body">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.flightmgr.no_flight") }}
          </div>
        </div>
        <div class="fm-actions">
          <v-btn
            size="small"
            variant="flat"
            color="primary"
            prepend-icon="mdi-airplane-search"
            :loading="quoteChecking"
            @click="openSearch"
          >
            {{ t("cargo.flightmgr.search_flights") }}
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ─── 4. ERROR ─────────────────────────────────────────────── -->
    <div v-else-if="state === 'error'" class="fm-card fm-card--error">
      <div class="fm-row">
        <v-icon icon="mdi-alert-circle" color="warning" size="20" />
        <div class="fm-body">
          <div class="text-caption">{{ store.error }}</div>
        </div>
        <div class="fm-actions">
          <v-btn
            size="small"
            variant="text"
            icon="mdi-refresh"
            :title="t('common.retry')"
            @click="reload"
          />
          <v-btn
            size="small"
            variant="flat"
            color="primary"
            prepend-icon="mdi-airplane-search"
            :loading="quoteChecking"
            @click="openSearch"
          >
            {{ t("cargo.flightmgr.search_flights") }}
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="error"
            prepend-icon="mdi-close-circle"
            @click="openCancelRate"
          >
            {{ t("cargo.flightmgr.remove_flight") }}
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ─── 5. RATE (+ booking chip overlay if active) ───────────── -->
    <div v-else class="fm-card">
      <div class="fm-row">
        <!-- La cola de la aerolinea, no el icono generico: es el unico sitio
             del bloque que la nombra desde que la fila «Vettore» de
             CargoVoliCard se oculta con vuelo asignado. Sin codigo IATA o si
             el logo falla, AirlineLogo pinta el avion en su propia caja (el
             cargo SIEMPRE es aereo), asi que aqui ya no hace falta el `v-else`
             que antes lo sustituia. -->
        <AirlineLogo :code="rateAirlineCode" :size="24">
          <template #placeholder>
            <v-icon icon="mdi-airplane" color="primary" size="22" />
          </template>
        </AirlineLogo>
        <div class="fm-body">
          <div class="d-flex align-center ga-1 flex-wrap">
            <span class="font-weight-bold">{{ rateAirlineCode || "—" }}</span>
            <v-chip
              v-if="store.rate?.source"
              size="x-small"
              variant="flat"
              :color="sourceColor(String(store.rate.source))"
            >
              {{ sourceShort(String(store.rate.source)) }}
            </v-chip>
          </div>
          <!-- Ni ruta ni precio: la ruta la pinta CargoFlightLegList justo
               debajo (y con las escalas a un clic, que esta linea no tenia), y
               el precio vive en el bloque Costi con su desglose. El transito se
               queda porque no esta en ningun otro sitio del overview. -->
          <div
            v-if="store.rate?.transit_hours || cutoffLabel"
            class="text-caption text-medium-emphasis"
          >
            <template v-if="store.rate?.transit_hours">
              <v-icon icon="mdi-clock-outline" size="x-small" />
              {{ formatTransit(Number(store.rate.transit_hours)) }}
            </template>
            <!-- Cut-off: es LA fecha que decide si aun se puede entregar la
                 mercancia a tiempo, y hasta ahora no se veia sin abrir el
                 detalle. Se marca cuando es estimado (realtime) para no
                 presentarlo como un compromiso de la aerolinea. -->
            <span
              v-if="cutoffLabel"
              :class="{ 'ms-2': store.rate?.transit_hours }"
            >
              <v-icon icon="mdi-calendar-clock" size="x-small" />
              {{ cutoffLabel }}
            </span>
          </div>
          <!-- POR QUE no se puede reservar. El boton ya se deshabilitaba, pero
               el motivo (`SOLD_OUT`…) no llegaba al cliente hasta que entro en
               la whitelist; sin el, el operador veia un boton apagado y sin
               explicacion. -->
          <div
            v-if="
              store.rate?.bookable === false && store.rate?.not_bookable_reason
            "
            class="text-caption text-warning"
          >
            <v-icon icon="mdi-alert-outline" size="x-small" />
            {{ store.rate.not_bookable_reason }}
          </div>
        </div>
        <div class="fm-actions">
          <v-btn
            size="small"
            variant="text"
            icon="mdi-information-outline"
            :title="t('cargo.flightmgr.rate_detail')"
            @click="openDetailDialog"
          />
          <v-btn
            v-if="!store.hasActiveBooking"
            size="small"
            variant="flat"
            color="primary"
            prepend-icon="mdi-shield-airplane"
            :disabled="store.rate?.bookable === false"
            :title="
              store.rate?.bookable === false
                ? (store.rate?.not_bookable_reason ?? '')
                : t('cargo.flightmgr.book_this')
            "
            @click="openBook"
          >
            {{ t("cargo.flightmgr.book") }}
          </v-btn>
          <!-- OCULTO con reserva activa: buscar otro vuelo no cancela la que ya
               existe, asi que dejaba una reserva VIVA en el carrier —ocupando
               espacio y facturando— asociada a un vuelo que en el ERP ya nadie
               mira. El unico camino para cambiar de vuelo pasa ahora por el
               boton de quitar, que cancela primero y desasocia despues. -->
          <v-btn
            v-if="!store.hasActiveBooking"
            size="small"
            variant="outlined"
            prepend-icon="mdi-airplane-search"
            :loading="quoteChecking"
            @click="openSearch"
          >
            {{ t("cargo.flightmgr.new_flight") }}
          </v-btn>
          <!-- Icono, no boton con texto: conserva los tramos manuales, que el
               «reset» de la cabecera de la tarjeta (mdi-airplane-remove) si
               borra. Al despegarlo de Book / New flight, esas dos quedan como
               las acciones que el operador realmente busca.

               SIEMPRE visible, tambien con reserva activa: antes se ocultaba
               (`v-if="!hasActiveBooking"`) para que nadie desasociara un rate
               dejando la reserva viva en el carrier, pero eso dejaba un vuelo
               realtime reservado SIN forma de quitarlo desde aqui. Ahora la
               accion cancela primero y desasocia despues, asi que el motivo
               para esconderla ya no existe — y es UN solo boton para las dos
               cosas, no uno por paso. -->
          <v-btn
            size="small"
            variant="text"
            color="error"
            icon="mdi-close-circle"
            :loading="store.cancellingRate || store.cancellingBooking"
            :title="
              store.hasActiveBooking
                ? t('cargo.flightmgr.remove_and_cancel')
                : t('cargo.flightmgr.remove')
            "
            @click="openCancelRate"
          />
        </div>
      </div>

      <!-- Referencia de la reserva activa. En una fila propia bajo el rate, NO
           superpuesta: flotando sobre la esquina se montaba encima de los
           botones de accion. -->
      <div v-if="store.hasActiveBooking" class="fm-booking-ref">
        <v-chip
          :color="bookingChipColor"
          size="small"
          variant="flat"
          @click="ui.openModal('booking_detail')"
        >
          <v-icon start size="small" icon="mdi-shield-check" />
          {{ t("cargo.flightmgr.booking") }}
          {{ store.bookingAwb || store.bookingId }}
          <v-icon end size="small" icon="mdi-chevron-right" />
        </v-chip>
      </div>
    </div>

    <!-- Resultado fallido de la última acción, traducido a partir del
         `error_code`. Antes se interpolaba `store.error` crudo, que es el texto
         (o el JSON) que devuelve el carrier en inglés. -->
    <BookingErrorAlert
      v-if="store.error && state === 'rate'"
      :message="store.error"
      :code="store.errorCode"
      :indeterminate="store.cancelIndeterminate"
    />

    <!-- Dialogs owned by this card -->
    <BookingConfirmDialog
      v-model="bookOpen"
      :rate="store.rate"
      :busy="store.booking_in_flight"
      :cargo-id="cargoId ? Number(cargoId) : null"
      @confirm="performBook"
    />
    <!-- MISMO dialogo que el boton de la cabecera de CargoVoliCard: era la
         unica accion que quedaba duplicada, y las dos hacian ya lo mismo salvo
         los tramos manuales, que ahora son una casilla dentro del dialogo. -->
    <ResetFlightsDialog
      v-model="reset.dialogOpen.value"
      :busy="reset.busy.value"
      :has-active-booking="reset.hasActiveBooking.value"
      :has-rate="reset.hasRate.value"
      :has-manual-legs="reset.hasManualLegs.value"
      :booking-ref="store.bookingAwb || store.bookingId"
      @confirm="performRemoveFlight"
    />

    <!-- Por que NO se puede buscar vuelos. Sustituye al toast de «falta peso»,
         que solo nombraba una de las cinco causas posibles. -->
    <QuoteBlockedDialog
      v-model="quoteBlockedOpen"
      :issues="quoteIssues"
      :loading="quoteChecking"
      @recheck="recheckQuote"
      @fix="goFixQuote"
    />

    <!-- Detalle del rate YA asociado. En modo consulta: ofrecer "seleccionar"
         no significa nada sobre la tarifa que ya está seleccionada. -->
    <FlightDetailDialog
      v-model="rateDetailOpen"
      :rate="selectedRateDetail"
      :saving="false"
      readonly
    />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useToastStore } from "@cargo/stores/toast.store";
import AirlineLogo from "@cargo/components/cargo/AirlineLogo.vue";
import FlightDetailDialog from "@cargo/components/cargo/flight-search/FlightDetailDialog.vue";
import {
  normalizeRate,
  type NormalizedRate,
} from "@cargo/services/flight_search.service";
import BookingConfirmDialog from "./BookingConfirmDialog.vue";
import BookingErrorAlert from "./BookingErrorAlert.vue";
import ResetFlightsDialog from "./ResetFlightsDialog.vue";
import QuoteBlockedDialog from "./QuoteBlockedDialog.vue";
import { useFlightReset } from "@cargo/composables/useFlightReset";
import { useQuoteGuard } from "@cargo/composables/useQuoteGuard";

const { t, te } = useI18n();

/**
 * Mensaje traducido de un fallo de reserva, para el toast.
 *
 * Misma resolución que BookingErrorAlert (código → clave i18n, con caída al
 * genérico) para que banner y toast no digan cosas distintas del mismo fallo.
 * `te()` primero: con una clave ausente vue-i18n devuelve la propia clave, y
 * enseñar "cargo.flightmgr.booking_error.X" sería peor que no traducir.
 */
function bookingErrorText(code: string | null | undefined): string {
  const base = "cargo.flightmgr.booking_error";
  const key = (code ?? "").trim();
  return key && te(`${base}.${key}`)
    ? t(`${base}.${key}`)
    : t(`${base}.generic`);
}
const cargoStore = useCargoStore();
const store = useCargoFlightManagerStore();
const ui = useUiStore();
const toasts = useToastStore();
const { cargo, id: cargoId } = storeToRefs(cargoStore);
const reset = useFlightReset();

const state = computed(() => store.renderState);

const bookOpen = ref(false);

// ─── hydration ──────────────────────────────────────────────────
const currentShortId = computed<string>(() => {
  const c = cargo.value as { id_rate_webcargo?: string | null } | null;
  return c?.id_rate_webcargo ?? "";
});

async function hydrate(): Promise<void> {
  if (!cargoId.value) return;
  await store.hydrate(Number(cargoId.value), currentShortId.value || null);
}

onMounted(hydrate);
watch(() => [cargoId.value, currentShortId.value], hydrate);

async function reload(): Promise<void> {
  await hydrate();
}

// ─── actions ────────────────────────────────────────────────────
/**
 * Guard de «se puede cotizar», delegado al backend.
 *
 * Antes esto era un `peso <= 0` local con un toast. Dos problemas: el peso es
 * UNA de las cinco cosas que impiden cotizar (faltan bultos, dimensiones,
 * terminal de origen y de destino), y el toast solo nombraba esa — el operador
 * corregia el peso, volvia a pulsar y seguia bloqueado sin saber por que.
 *
 * Ahora se pregunta a `Cargo_Quote_Data_Validator`, que es EL MISMO que decide
 * el 422 del endpoint de busqueda, asi que el dialogo no puede desincronizarse
 * de lo que realmente bloquea. Ademas mira el detalle de bultos, no solo la
 * cabecera: un cargo con `peso=0` arriba pero con colli pesados abajo es
 * cotizable, y el guard viejo lo rechazaba.
 */
const {
  issues: quoteIssues,
  checking: quoteChecking,
  blockedOpen: quoteBlockedOpen,
  openSearch,
  recheck: recheckQuote,
  goFix: goFixQuote,
} = useQuoteGuard();

/** Diálogo de detalle del rate YA asociado (solo consulta). */
const rateDetailOpen = ref(false);

/**
 * El rate seleccionado, pasado por el MISMO normalizador que los resultados de
 * búsqueda, para que la tarifa se vea igual antes y después de seleccionarla.
 *
 * Los endpoints de detalle devuelven menos que la búsqueda —verificado sobre
 * `api_cargo_klm_rate_detail`: ni `source` ni `segments`, aunque sí el
 * `rate_data` crudo—, así que se normaliza aquí en vez de leer campos sueltos
 * en la plantilla. El `source` lo aporta el store, que ya lo sabe: es lo que
 * decidió a qué caché preguntar.
 */
const selectedRateDetail = computed<NormalizedRate | null>(() => {
  const r = store.rate;
  if (!r) return null;
  return normalizeRate(r as Parameters<typeof normalizeRate>[0]);
});

function openDetailDialog(): void {
  // Consultar un detalle NO puede cambiar el estado operativo de la
  // expedición. Antes esta función abría `booking_detail` si había reserva y,
  // si no, llamaba a openSearch() — que abre el formulario "New flight". Es
  // decir: el botón "Rate detail" nunca mostraba el detalle del rate, y sin
  // reserva empezaba una búsqueda. El propio código lo reconocía como atajo
  // provisional ("for now we route the operator to the search modal").
  //
  // El detalle de reserva sigue teniendo su camino propio: el chip de booking.
  if (!selectedRateDetail.value) return;
  rateDetailOpen.value = true;
}

function openBook(): void {
  if (store.rate?.bookable === false) {
    toasts.push(
      "warning",
      store.rate.not_bookable_reason ?? t("cargo.flightmgr.not_bookable"),
    );
    return;
  }
  bookOpen.value = true;
}

async function performBook(payload: {
  awbManual?: string;
  awbMode?: "carrier" | "pool" | "manual";
}): Promise<void> {
  const result = await store.book(payload);
  if (result) {
    bookOpen.value = false;
    toasts.push(
      "success",
      t("cargo.flightmgr.booking_created", { id: result.booking_id ?? "" }),
    );
    if (cargoId.value) await cargoStore.load(Number(cargoId.value));
  } else if (store.error) {
    // Mismo mensaje traducido que el banner: el toast mostraba el texto crudo
    // del carrier, así que el operador leía dos versiones distintas del mismo
    // fallo. El detalle técnico vive en el banner, que no desaparece solo.
    toasts.push("error", bookingErrorText(store.errorCode));
  }
}

function openCancelRate(): void {
  reset.open();
}

/**
 * Quitar el vuelo. Delega en el composable compartido, que es el MISMO que usa
 * el boton de la cabecera de la tarjeta: una sola cascada, un solo sitio donde
 * arreglarla.
 *
 * El composable ya publica su propio toast de exito/fallo, asi que aqui solo se
 * matiza el caso indeterminado (timeout del carrier), que no es ni exito ni
 * fallo limpio y merece un aviso distinto: la reserva PUDO cancelarse, y
 * reintentar a ciegas arriesga una doble cancelacion.
 */
async function performRemoveFlight(opts: {
  clearManualLegs: boolean;
}): Promise<void> {
  const ok = await reset.confirm({ clearManualLegs: opts.clearManualLegs });
  if (!ok && store.cancelIndeterminate && store.error) {
    toasts.push("warning", store.error);
  }
}

// ─── view helpers ───────────────────────────────────────────────
/**
 * Codigo IATA del rate, para el logo y para la etiqueta.
 *
 * NO se pinta `airline_name` al lado: cuando difiere del codigo es justo el
 * caso incoherente que hay abierto (sigla IB con nombre BA, dos companias
 * distintas en la misma fila), y cuando no difiere no aportaba nada. Si el
 * diagnostico confirma codeshare, el segundo transportista vuelve pero
 * etiquetado («operato da BA»), no como un nombre suelto.
 */
const rateAirlineCode = computed<string>(() =>
  String(store.rate?.airline_code ?? "").trim(),
);

/**
 * Cut-off listo para pintar, o "" si la fuente no lo trae.
 *
 * Se antepone `~` cuando es estimado: en `realtime` el valor sale de un
 * parametro que enviamos en la peticion, no de lo que dicta la aerolinea para
 * ese vuelo. Sin la marca, dos datos de naturaleza distinta se leerian igual.
 */
const cutoffLabel = computed<string>(() => {
  const ts = store.rate?.last_acceptance_ts;
  if (!ts) return "";
  const d = new Date(String(ts));
  if (Number.isNaN(d.getTime())) return "";
  const txt = d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return store.rate?.last_acceptance_estimated ? `~${txt}` : txt;
});

const bookingRoute = computed<string>(() => {
  const b = store.booking as
    | (typeof store.booking & {
        route?: { origin?: string; destination?: string };
      })
    | null;
  if (!b?.route) return "—";
  return `${b.route.origin ?? "?"} → ${b.route.destination ?? "?"}`;
});

const bookingChipColor = computed(() => {
  switch (store.bookingStatus) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
    case "canceled":
    case "rejected":
    case "failed":
      return "error";
    default:
      return "primary";
  }
});

const bookingStatusLabel = computed(() => {
  const s = String(store.bookingStatus ?? "").toUpperCase();
  return s || "BOOKED";
});

function sourceColor(s: string): string {
  if (s === "realtime") return "success";
  if (s === "express") return "warning";
  // Una quote firme caduca en minutos: verde como realtime, porque comparte lo
  // que importa al operador —es un precio reservable AHORA—, no el indigo de la
  // tarifa de catalogo.
  if (s === "klm_quote") return "success";
  if (s === "klm") return "indigo";
  return "primary";
}
function sourceShort(s: string): string {
  if (s === "realtime") return "RT";
  if (s === "express") return "EX";
  // `klm_quote` es una quote FIRME (precio cerrado que caduca en minutos);
  // `klm` es tarifa de contrato. Sin este caso la quote caia al "PUB" del
  // final, que dice justo lo contrario de lo que es.
  if (s === "klm_quote") return "KLQ";
  if (s === "klm") return "KL";
  return "PUB";
}
function formatTransit(h: number): string {
  if (!h) return "";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm ? ` ${String(mm).padStart(2, "0")}'` : ""}`;
}
</script>

<style scoped lang="scss">
.flight-manager {
  position: relative;
}
.fm-loading {
  display: flex;
  align-items: center;
  padding: 10px 12px;
}
/* Sin fondo propio: el manager vive DENTRO de la tarjeta «Volo e vettore», y
   una caja gris sobre la superficie de la tarjeta creaba un segundo nivel
   visual para algo que no es una sección aparte — son las acciones del vuelo
   que la tarjeta ya anuncia en su cabecera.

   Los estados `error` y `booking-only` SI conservan el suyo: ahi el color no es
   decoracion, es el estado. */
.fm-card {
  padding: 6px 0 10px;
  border-radius: 10px;
  position: relative;
  /* Sin fondo, la barra se fundia con la tira de tramos que va justo debajo.
     Una linea basta para separarlas sin volver a meter una caja. */
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}
.fm-card--error,
.fm-card--booking-only {
  padding: 10px 12px;
  border-bottom: 0;
}
.fm-card--error {
  background: rgba(237, 108, 2, 0.06);
}
.fm-card--booking-only {
  background: rgba(46, 125, 50, 0.06);
}
.fm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fm-body {
  flex: 1;
  min-width: 0;
}
/* `center`, no `flex-start`: el cuerpo puede ser una linea (solo la aerolinea)
   o tres (con transito y motivo de no-reservable), y los botones deben quedar
   centrados respecto a el en ambos casos. `flex-end` en el eje horizontal los
   ancla a la derecha aunque el cuerpo se quede corto.

   `align-self: center` sobre el propio contenedor evita que `align-items:
   center` del padre lo estire cuando envuelve en pantallas estrechas. */
.fm-actions {
  display: flex;
  align-items: center;
  align-self: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}
/* Los botones de icono (`v-btn--icon`) son cuadrados y los de texto se dimensionan
   por su contenido, asi que en la misma fila quedaban a alturas distintas y con
   los bordes desalineados. Se igualan a la altura del boton `small` de Vuetify
   (28px en densidad comfortable) para que la barra lea como una sola linea. */
.fm-actions :deep(.v-btn) {
  height: 28px;
  min-height: 28px;
}
.fm-actions :deep(.v-btn--icon) {
  width: 28px;
  min-width: 28px;
}
/* EN FLUJO, no flotando.
   Era `position: absolute; top: 4px; right: 8px`, es decir, anclado justo en el
   rincon que ocupa `.fm-actions`: el chip se montaba ENCIMA de los botones
   (Rate detail / New flight / Remove) y, al ser clicable, ademas les robaba el
   clic. Con el texto corto casi no se notaba, pero el chip crece con el numero
   («Booking klm_book_4ed757b79», y mas aun con AWB) y acababa tapandolos.

   Fuera del flujo la tarjeta no le reservaba alto, asi que no bastaba con
   moverlo: se pone en flujo como una fila propia bajo `.fm-row` y el
   solapamiento desaparece por construccion, a cualquier ancho y con cualquier
   longitud de referencia. */
.fm-booking-ref {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  /* El chip no debe estirarse a todo el ancho al envolver: que ocupe lo suyo. */
  min-width: 0;
}
</style>
