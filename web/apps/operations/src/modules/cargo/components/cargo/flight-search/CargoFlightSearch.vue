<template>
  <div class="flight-search-root">
    <!-- ─── STEP: CONFIRM (2-step wizard, paridad legacy) ─── -->
    <!-- `selectedRate && cargo` son REDUNDANTES con wizardOpen: estan solo para
         que TypeScript estreche los tipos dentro del v-if. La condicion real
         vive en wizardOpen y no debe duplicarse aqui. -->
    <!--
      El wizard necesita SU PROPIO dialogo.

      Era un <div> plano dentro de .flight-search-root, y ese contenedor solo se
      ve a traves de los v-dialog: al pasar a 'confirm' el listado se cerraba y
      el wizard se montaba en un contenedor SIN dialogo — presente en el DOM,
      invisible en pantalla. Los logs lo probaron: onSelectRate y step->confirm
      se ejecutaban con cargo_id correcto y aun asi no aparecia nada.
    -->
    <v-dialog :model-value="wizardOpen" max-width="900" scrollable persistent>
      <v-card>
        <v-card-text class="pa-4">
          <FlightSelectionWizard
            v-if="wizardOpen && selectedRate && cargo"
            :rate="selectedRate"
            :current-rate="currentRateSnapshot"
            :shipment-id="Number(cargo.id)"
            :has-active-booking="flightManager.hasActiveBooking"
            :active-booking-id="flightManager.bookingId"
            :busy="persisting"
            :busy-message="persistingMessage"
            :error-msg="persistError"
            @back="backToResults"
            @confirm="performAssignment"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <!--
      ─── Parametros: modal APILADO sobre el de resultados ────────────────
      No usa el canal `activeModal` del ui store porque es un slot unico
      (`activeModal.value = name`): abrir parametros cerraria el listado, justo
      lo contrario de lo que se busca. Un v-dialog local es ademas el patron ya
      usado dentro de este modal (drawer de filtros, detalle de aerolineas).

      El listado sigue montado debajo: cancelar devuelve al operador a sus
      resultados intactos, que antes se perdian al volver al formulario.
    -->
    <v-dialog v-model="paramsOpen" max-width="720" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center py-3 px-4">
          <v-icon icon="mdi-airplane-search" size="20" class="me-2" />
          <span class="text-subtitle-1 font-weight-bold">
            {{ t("cargo.modal.flight_search") }}
          </span>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <FlightSearchParams
            ref="paramsRef"
            v-model="params"
            :can-search="canSearch"
            :searching="searching"
            :min-date="minDate"
            :date-error="dateError"
            :shipment-id="Number(cargo?.id) || undefined"
            @search="startSearch"
            @stop="stopSearch"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <!-- Cancelar NO relanza nada: cierra y deja el listado como estaba. -->
          <v-btn
            v-if="rates.length > 0"
            variant="text"
            @click="paramsOpen = false"
          >
            {{ t("common.cancel") }}
          </v-btn>
          <v-tooltip
            location="top"
            :text="searchBlockedReason || t('cargo.flight.search')"
          >
            <template #activator="{ props: gp }">
              <div v-bind="gp">
                <v-btn
                  color="primary"
                  variant="flat"
                  prepend-icon="mdi-magnify"
                  :loading="searching"
                  :disabled="!canSearch || noSourceSelected || hasDataErrors"
                  @click="startSearch"
                >
                  {{ t("cargo.flight.search") }}
                </v-btn>
              </div>
            </template>
          </v-tooltip>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!--
      ─── Resultados ──────────────────────────────────────────────────────
      Sin nada que mostrar el listado no se pinta: quedaba un modal vacio
      detras del formulario en la primera apertura. Aparece al arrancar la
      busqueda (barra de progreso) o si ya hay tarifas.
    -->
    <!--
      Marco propio del listado (antes lo ponia ModalWrapper, que se abria
      siempre y quedaba vacio detras del formulario). Solo se pinta cuando hay
      algo que enseñar: una busqueda en curso o tarifas ya recibidas.
    -->
    <v-dialog
      :model-value="!wizardOpen && !!lastQuery"
      max-width="1100"
      scrollable
      persistent
    >
      <v-card>
        <v-card-title class="d-flex align-center py-3 px-4">
          <v-icon icon="mdi-airplane-search" size="20" class="me-2" />
          <span class="text-subtitle-1 font-weight-bold">
            {{ t("cargo.modal.flight_search") }}
          </span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            density="comfortable"
            @click="ui.closeModal()"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <!--
        Cabecera de la busqueda en curso. Sustituye al formulario colapsado:
        la ruta se lee de un vistazo y "Modifica" devuelve al paso 1 completo,
        en vez de expandir un formulario a medias sobre los resultados.
      -->
          <!--
        El error tambien se ve AQUI, en el listado.
        `persistError` solo se pintaba dentro del wizard; si el fallo impide
        abrirlo, el mensaje se escribia donde nadie podia verlo — un segundo
        fallo mudo encima del primero.
      -->
          <v-alert
            v-if="persistError && !wizardOpen"
            type="error"
            density="compact"
            variant="tonal"
            class="mb-2"
          >
            {{ persistError }}
          </v-alert>

          <div class="search-summary d-flex align-center ga-2 mb-2">
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-pencil"
              :disabled="searching"
              @click="paramsOpen = true"
            >
              {{ lastQuery?.origin ?? params.origin ?? "—" }}
              → {{ lastQuery?.destination ?? params.destination ?? "—" }} ·
              {{ lastQuery?.weight ?? params.weight ?? "—" }} kg ·
              {{ lastQuery?.date ?? params.date ?? "—" }}
            </v-btn>
            <v-tooltip location="top" :text="t('cargo.flight.search_again')">
              <template #activator="{ props: rp }">
                <v-btn
                  v-bind="rp"
                  size="small"
                  variant="text"
                  icon="mdi-refresh"
                  :disabled="searching"
                  @click="startSearch"
                />
              </template>
            </v-tooltip>
            <v-spacer />
            <span v-if="rates.length" class="text-caption text-medium-emphasis">
              {{ rates.length }} {{ t("cargo.flight.rates_count") }}
            </span>
          </div>

          <!-- Progress bar while streaming -->
          <!--
        Progress exists only while the search runs. Keeping the bar, the phase
        line and the carrier pills on screen afterwards spent ~60px restating
        what the table already shows. On completion it collapses to the single
        count that sits next to the collapsed form.
      -->
          <div v-if="searching" class="my-1">
            <!--
          Reads as "working", not as "stuck".

          The bar used to go indeterminate only while percent was 0, so the
          moment the first carrier answered it froze at whatever number it had
          and sat there for seconds between phases — the search looked hung
          precisely when it was busiest. Now:

           - `stream` keeps the fill animating for as long as the search runs,
             so there is always motion even when the number does not move;
           - `buffer-value` runs slightly ahead of the real value, hinting at
             the work already in flight;
           - the bar stays indeterminate until the FIRST rate arrives, which is
             the only stretch where we genuinely cannot estimate progress.
        -->
            <v-progress-linear
              :model-value="progressPercent"
              :buffer-value="
                searching
                  ? Math.min(100, progressPercent + 12)
                  : progressPercent
              "
              :indeterminate="searching && rates.length === 0"
              :stream="searching && rates.length > 0"
              height="8"
              rounded
              color="primary"
              class="search-progress"
            />
            <!--
          Estado POR FUENTE. Las fases del backend se solapan (realtime y
          klm_live se anuncian a la vez, y klm_quotes abarca casi toda la
          busqueda), asi que una barra "fase N de 7" mentiria: aqui cada fuente
          pedida dice si ya respondio y cuantas tarifas trajo.
        -->
            <div class="d-flex align-center justify-space-between mt-1">
              <span
                class="text-caption text-medium-emphasis d-flex align-center ga-1"
              >
                <!--
                 Sin spinner. La barra de progreso esta 40 px por encima y ya
                 dice que la busqueda sigue viva; repetirlo aqui solo anadia un
                 tercer elemento en movimiento a la misma franja de 60 px.
                -->
                <template v-if="progress?.airline">
                  {{ progress.phase ? `${phaseLabel(progress.phase)} · ` : ""
                  }}{{ progress.airline }}
                </template>
                <template v-else-if="progress?.phase">
                  {{ phaseLabel(progress.phase) }}
                </template>
                <template v-else-if="searching">
                  {{ t("cargo.flight.searching") }}
                </template>
                <template v-else>{{ t("cargo.flight.completed") }}</template>
              </span>
              <span class="text-caption text-medium-emphasis">
                {{ rates.length }} {{ t("cargo.flight.received")
                }}<span v-if="progress?.total">
                  · {{ progress.completed }}/{{ progress.total }}
                  {{ t("cargo.flight.carriers_short") }}</span
                >
              </span>
            </div>
            <!--
          Carrier roll-up. A search hits ~38 carriers and only a few return
          flights; one chip each turned the useful signal into a wall of red.
          Two counters answer "did enough carriers answer?", and the full
          breakdown is one click away.
        -->
            <div
              v-if="searching && airlineStatuses.length"
              class="airline-pills mt-1"
            >
              <v-chip
                size="x-small"
                variant="tonal"
                color="success"
                class="me-1 mb-1"
                @click="airlineDetailOpen = true"
              >
                <v-icon icon="mdi-check-circle" size="12" class="me-1" />
                {{ airlineSummary.withRates.length }}
                {{ t("cargo.flight.carriers_with_rates") }}
              </v-chip>
              <v-chip
                v-if="airlineSummary.without.length"
                size="x-small"
                variant="tonal"
                color="grey"
                class="me-1 mb-1"
                @click="airlineDetailOpen = true"
              >
                <v-icon
                  icon="mdi-minus-circle-outline"
                  size="12"
                  class="me-1"
                />
                {{ airlineSummary.without.length }}
                {{ t("cargo.flight.carriers_without_rates") }}
              </v-chip>
              <v-chip
                v-if="airlineSummary.pending.length"
                size="x-small"
                variant="tonal"
                color="info"
                class="me-1 mb-1"
                @click="airlineDetailOpen = true"
              >
                <v-icon icon="mdi-progress-clock" size="12" class="me-1" />
                {{ airlineSummary.pending.length }}
              </v-chip>
              <v-btn
                size="x-small"
                variant="text"
                density="comfortable"
                class="mb-1"
                @click="airlineDetailOpen = true"
              >
                {{ t("cargo.flight.carriers_detail") }}
              </v-btn>
            </div>

            <!-- Full per-carrier breakdown, on demand -->
            <v-dialog v-model="airlineDetailOpen" max-width="560">
              <v-card>
                <v-card-title class="text-subtitle-1">
                  {{ t("cargo.flight.carriers_detail_title") }}
                  <span class="text-caption text-medium-emphasis ms-2">
                    {{ airlineSummary.total }}
                  </span>
                </v-card-title>
                <v-card-text>
                  <div
                    v-for="group in [
                      {
                        key: 'rates',
                        label: t('cargo.flight.carriers_with_rates'),
                        codes: airlineSummary.withRates,
                        color: 'success',
                        icon: 'mdi-check-circle',
                      },
                      {
                        key: 'pending',
                        label: t('cargo.flight.carriers_pending'),
                        codes: airlineSummary.pending,
                        color: 'info',
                        icon: 'mdi-progress-clock',
                      },
                      {
                        key: 'without',
                        label: t('cargo.flight.carriers_without_rates'),
                        codes: airlineSummary.without,
                        color: 'grey',
                        icon: 'mdi-minus-circle-outline',
                      },
                    ]"
                    :key="group.key"
                  >
                    <template v-if="group.codes.length">
                      <div class="text-caption text-medium-emphasis mt-3 mb-1">
                        {{ group.label }} ({{ group.codes.length }})
                      </div>
                      <div class="d-flex flex-wrap ga-1">
                        <v-chip
                          v-for="code in group.codes"
                          :key="code"
                          size="x-small"
                          variant="tonal"
                          :color="group.color"
                        >
                          <v-icon :icon="group.icon" size="12" class="me-1" />
                          {{ code }}
                        </v-chip>
                      </div>
                    </template>
                  </div>
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn variant="text" @click="airlineDetailOpen = false">
                    {{ t("common.close") }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </div>

          <!--
        Estado POR FUENTE. Las fases del backend se solapan (realtime y
        klm_live se anuncian a la vez, y klm_quotes abarca casi toda la
        busqueda), asi que una barra "fase N de 7" mentiria: aqui cada fuente
        pedida dice si ya respondio y cuantas tarifas trajo.

        Un icono ESTATICO por bloque, no un spinner por bloque: cuatro aros
        girando a la vez, encima de una barra ya animada, no decian cual de las
        cuatro fuentes seguia trabajando porque todos giraban igual. Ahora el
        estado se lee del icono y el color, y el unico movimiento es un latido
        suave sobre la que esta en curso.

        FUERA del `v-if="searching"` a proposito. Con el spinner dentro no
        habia nada que conservar al acabar, pero ahora estos bloques son el
        unico sitio donde se lee "KLM Quote respondio y no trajo ninguna
        tarifa" — y esa respuesta importa justo DESPUES de la busqueda, cuando
        el operador se pregunta por que faltan opciones. Mantenerlos evita
        ademas que la fila salte al desaparecer.
      -->
          <div v-if="sourceProgress.length" class="source-progress mt-1">
            <v-chip
              v-for="sp in sourceProgress"
              :key="sp.key"
              size="x-small"
              variant="tonal"
              :color="sourceColor(sp)"
              :class="[
                'me-1',
                { 'source-chip-running': sp.state === 'running' && searching },
              ]"
            >
              <v-icon :icon="sourceIcon(sp)" size="12" class="me-1" />
              {{ sp.label }}<span v-if="sp.count"> · {{ sp.count }}</span>
            </v-chip>
          </div>

          <v-divider class="my-3" />

          <!-- Error banner -->
          <v-alert
            v-if="lastError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ lastError }}
          </v-alert>

          <v-alert
            v-else-if="searchOutcome === 'cancelled'"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ t("cargo.flight.search_cancelled") }}
          </v-alert>

          <!-- Filters (visible as soon as anything arrives) -->
          <FlightFilters
            v-if="rates.length > 0"
            v-model="filters"
            :rates="rates"
          />

          <!-- Results table -->
          <!--
        Tabs by RATE TYPE — how the row can be acted on, which is the
        distinction that changes what the operator can do. Provider stays a
        filter; type gets tabs because the count IS the answer to the first
        question asked of this screen: "can I book anything?".

        A "Direct booking (0)" tab answers that at a glance, where a dropdown
        filter had to be opened to find out.
      -->
          <v-tabs
            v-if="rates.length > 0"
            v-model="rateTypeTab"
            density="compact"
            class="rate-type-tabs mb-1"
          >
            <v-tab value="direct_booking" :disabled="directBookingCount === 0">
              <v-icon icon="mdi-lightning-bolt" size="14" class="me-1" />
              {{ t("cargo.flight.kind_direct") }}
              <span class="ms-1 text-caption">({{ directBookingCount }})</span>
            </v-tab>
            <v-tab value="published" :disabled="publishedKindCount === 0">
              <v-icon icon="mdi-format-list-bulleted" size="14" class="me-1" />
              {{ t("cargo.flight.kind_published") }}
              <span class="ms-1 text-caption">({{ publishedKindCount }})</span>
            </v-tab>
            <v-tab value="all">
              {{ t("cargo.flight.all_items") }}
              <span class="ms-1 text-caption"
                >({{ filteredRates.length }})</span
              >
            </v-tab>
          </v-tabs>

          <FlightSearchResultsTable
            v-if="filteredRates.length > 0"
            :rates="tabRates"
            :selected-key="selectedKey"
            @select="onSelectRate"
            @detail="openDetail"
          />

          <EmptyState
            v-else-if="
              searchOutcome === 'completed' && rates.length === 0 && !lastError
            "
            icon="mdi-airplane-off"
            :title="t('cargo.flight.no_rates_title')"
            :text="t('cargo.flight.no_rates_text')"
          />

          <div
            v-if="!searching && rates.length === 0 && lastQuery"
            class="d-flex justify-center flex-wrap ga-2 mt-3"
          >
            <v-btn
              variant="tonal"
              prepend-icon="mdi-pencil-outline"
              @click="paramsOpen = true"
            >
              {{ t("cargo.flight.modify_search") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-refresh"
              @click="startSearch"
            >
              {{ t("cargo.flight.search_again") }}
            </v-btn>
          </div>

          <EmptyState
            v-else-if="!searching && !lastQuery"
            icon="mdi-airplane-search"
            :title="t('cargo.flight.enter_params_title')"
            :text="t('cargo.flight.enter_params_text')"
          />

          <!-- Detail dialog (read-only view + 'Seleziona' button that enters
         the confirm wizard — does NOT persist directly). -->
          <FlightDetailDialog
            v-model="detailOpen"
            :rate="detailRate"
            :saving="false"
            @confirm="onSelectRate"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn variant="text" @click="ui.closeModal()">
            {{ t("common.close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@cargo/stores/ui.store";
import { isDirectBooking } from "@cargo/services/flight_search.service";
import EmptyState from "@shared/ui/EmptyState.vue";
import { useCargoFlightSearch } from "./useCargoFlightSearch";
import FlightSearchParams from "./FlightSearchParams.vue";
import FlightSearchResultsTable from "./FlightSearchResultsTable.vue";
import FlightFilters from "./FlightFilters.vue";
import FlightDetailDialog from "./FlightDetailDialog.vue";
import FlightSelectionWizard from "./FlightSelectionWizard.vue";

const { t } = useI18n();
const ui = useUiStore();
const {
  cargo,
  flightManager,
  params,
  filters,
  rates,
  searching,
  searchOutcome,
  lastQuery,
  lastError,
  progress,
  sourceStatus,
  selectedKey,
  step,
  selectedRate,
  persisting,
  persistingMessage,
  persistError,
  detailOpen,
  detailRate,
  canSearch,
  minDate,
  dateError,
  progressPercent,
  realtimeCount,
  publishedCount,
  airlineStatuses,
  airlineSummary,
  airlineDetailOpen,
  filteredRates,
  currentRateSnapshot,
  startSearch,
  stopSearch,
  openDetail,
  onSelectRate,
  backToResults,
  performAssignment,
} = useCargoFlightSearch();

/**

/**
 * Active rate-type tab.
 *
 * Defaults to whichever has something to show: bookable rows first, because a
 * firm price is what the operator can act on right now; the catalogue otherwise.
 * The switch only happens while the tab is empty, so it never overrides a
 * deliberate choice mid-search.
 */
const rateTypeTab = ref<"direct_booking" | "published" | "all">("published");

const directBookingCount = computed(
  () => filteredRates.value.filter((r) => isDirectBooking(r.source)).length,
);
const publishedKindCount = computed(
  () => filteredRates.value.filter((r) => !isDirectBooking(r.source)).length,
);

const tabRates = computed(() => {
  if (rateTypeTab.value === "all") return filteredRates.value;
  const wantDirect = rateTypeTab.value === "direct_booking";
  return filteredRates.value.filter(
    (r) => isDirectBooking(r.source) === wantDirect,
  );
});

watch(directBookingCount, (n) => {
  if (n > 0 && tabRates.value.length === 0) {
    rateTypeTab.value = "direct_booking";
  }
});
/**
 * Nombre legible de la fase SSE.
 *
 * El backend emite identificadores (`klm_quotes`, `courier_live`) que se
 * imprimian crudos junto a un "Fase:" en italiano fijo. Las fases ademas se
 * solapan — `realtime` y `klm_live` arrancan a la vez — asi que esto etiqueta
 * la fase actual sin fingir una secuencia lineal.
 */
function phaseLabel(phase: string): string {
  const key = `cargo.flight.phase_${phase}`;
  const label = t(key);
  return label === key ? phase : label;
}
/**
 * Fuentes pedidas en esta busqueda, con su estado REAL y lo que lleva devuelto
 * cada una.
 *
 * `state` viene del backend (`sourceStatus`), no de contar tarifas. Es lo que
 * permite que un bloque diga "terminada, 0 tarifas" en gris en lugar de girar
 * hasta el final y rematar con un tick verde enganoso.
 *
 * `realtime_direct` figura aqui aunque no traiga tarifas con `source` propio:
 * el formulario la ofrece como quinta casilla y antes buscaba sin dar ninguna
 * senal en el panel.
 */
const sourceProgress = computed(() => {
  const q = lastQuery.value;
  if (!q) return [];
  const defs = [
    {
      key: "published",
      flag: q.include_published,
      label: t("cargo.flight.src_wc_rates"),
    },
    {
      key: "realtime",
      flag: q.include_realtime,
      label: t("cargo.flight.src_wc_quote"),
    },
    {
      key: "realtime_direct",
      flag: q.include_realtime_direct,
      label: t("cargo.flight.src_wc_quote_direct"),
      // Comparte la fase `realtime` del backend: es la misma consulta con otra
      // credencial, no una fase propia.
      statusKey: "realtime",
    },
    { key: "klm", flag: q.include_klm, label: t("cargo.flight.src_klm_rates") },
    {
      key: "klm_quote",
      flag: q.include_klm_quotes,
      label: t("cargo.flight.src_klm_quote"),
    },
  ];
  return (
    defs
      // `undefined` = el servidor aplica su default, que es consultarla.
      .filter((d) => d.flag !== false)
      .map((d) => {
        const count = rates.value.filter((r) => r.source === d.key).length;
        const state = sourceStatus.value[d.statusKey ?? d.key] ?? "pending";
        return { key: d.key, label: d.label, count, state };
      })
  );
});

/** Icono del bloque de fuente segun su estado. Sin tick para "0 tarifas". */
function sourceIcon(sp: { state: string; count: number }): string {
  if (sp.state === "error") return "mdi-alert-circle";
  if (sp.state === "done")
    return sp.count > 0 ? "mdi-check-circle" : "mdi-minus-circle-outline";
  if (sp.state === "running") return "mdi-radar";
  return "mdi-clock-outline";
}

/** Color del bloque. Verde SOLO cuando de verdad trajo tarifas. */
function sourceColor(sp: { state: string; count: number }): string | undefined {
  if (sp.state === "error") return "error";
  if (sp.state === "done") return sp.count > 0 ? "success" : undefined;
  if (sp.state === "running") return "primary";
  return undefined;
}
/**
 * Dialogo de parametros abierto.
 *
 * Abierto de entrada solo mientras no hay nada que mostrar: con resultados en
 * pantalla se abre bajo demanda desde "Modifica" y se cierra al buscar, de modo
 * que el listado nunca se pierde por entrar a mirar los parametros.
 */
/**
 * UNA sola condicion para el wizard, compartida por los dos v-if.
 *
 * Antes el listado se ocultaba con `step !== 'confirm'` y el wizard se montaba
 * con `step === 'confirm' && selectedRate && cargo?.id`. Dos condiciones
 * distintas para un mismo cambio de pantalla: si faltaba `cargo.id`, el
 * listado se cerraba y el wizard NO aparecia. Modal cerrado, nada transmitido,
 * ningun error. Con una sola fuente de verdad ese hueco no puede existir.
 */
const wizardOpen = computed<boolean>(
  () => step.value === "confirm" && !!selectedRate.value && !!cargo.value?.id,
);

const paramsOpen = ref(true);

/** Cierra el formulario en cuanto arranca una busqueda de verdad. */
watch(searching, (now, before) => {
  if (now && !before) paramsOpen.value = false;
});

/**
 * Cerrar los parametros sin resultados detras cierra el modal ENTERO.
 *
 * Este componente se monta con `v-if="ui.activeModal === 'flight_search'"`, y
 * el unico que repone `activeModal` a null es `ui.closeModal()`. Al cerrar los
 * parametros con ESC o clic fuera solo bajaba `paramsOpen`: el componente
 * seguia montado e invisible con `activeModal` aun en 'flight_search', asi que
 * volver a pulsar "buscar vuelos" reasignaba el MISMO valor, Vue no
 * re-renderizaba y no ocurria nada. Solo se recuperaba recargando la pagina.
 *
 * Si hay resultados detras no se cierra nada: ahi el diseno es justamente que
 * el listado siga en pantalla (es la marcha atras de "Modifica").
 */
watch(paramsOpen, (open) => {
  if (!open && rates.value.length === 0 && !searching.value) {
    ui.closeModal();
  }
});

// Puerta del boton Buscar: depende de las fuentes marcadas, que las conoce el
// formulario.
const paramsRef = ref<InstanceType<typeof FlightSearchParams> | null>(null);
const noSourceSelected = computed<boolean>(
  () => paramsRef.value?.noSourceSelected ?? false,
);
const searchBlockedReason = computed<string>(
  () => paramsRef.value?.searchBlockedReason ?? "",
);
/**
 * Datos del envío insuficientes (peso 0, sin bultos, sin dimensiones…). El
 * servidor responde 422 sin llamar al carrier, así que el botón se bloquea
 * aquí para no gastar el viaje: el detalle ya se lista en el panel.
 */
const hasDataErrors = computed<boolean>(
  () => paramsRef.value?.hasDataErrors ?? false,
);
</script>

<style scoped>
.flight-search-root {
  min-height: 320px;
}
.search-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.airline-pills {
  display: flex;
  flex-wrap: wrap;
}

/*
 * A slow breath on the filled portion. Between phases the bar can hold the
 * same width for seconds; the pulse keeps the whole element alive so the pause
 * reads as "still working" rather than "frozen". Slow and low-contrast on
 * purpose — this sits above a dense table and must not compete with it.
 *
 * Las rayas (`striped`) se quitaron: sumaban una tercera animacion sobre el
 * MISMO elemento que ya lleva `stream` y este latido, y el conjunto vibraba
 * mas de lo que informaba.
 */
.search-progress :deep(.v-progress-linear__determinate) {
  animation: search-pulse 1.6s ease-in-out infinite;
}
@keyframes search-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.72;
  }
}

/*
 * El bloque de la fuente que esta consultando ahora mismo. Sustituye al
 * spinner que llevaba dentro cada chip: el latido distingue el que trabaja sin
 * anadir una pieza giratoria mas por fuente.
 */
.source-chip-running {
  animation: search-pulse 1.6s ease-in-out infinite;
}

/* Respect users who asked the system for less motion. */
@media (prefers-reduced-motion: reduce) {
  .search-progress :deep(.v-progress-linear__determinate),
  .source-chip-running {
    animation: none;
  }
}
</style>
