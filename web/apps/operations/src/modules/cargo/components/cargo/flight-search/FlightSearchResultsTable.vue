<template>
  <!--
    Answers the three questions an operator opens this list with — what is the
    cheapest, what is the fastest, and how many can I actually book — without
    scanning ~900 rows to find out.
  -->
  <!--
    Barra de pestanas + orden + agrupacion.
    Solo aparece con MAS DE UNA fuente en juego: con una sola, una pestana
    unica no aporta nada y solo roba altura al listado.
  -->
  <div v-if="tabs.length" class="fsrt-toolbar">
    <v-tabs
      :model-value="activeTab?.key"
      density="compact"
      show-arrows
      class="fsrt-tabs"
      @update:model-value="activeTabKey = String($event)"
    >
      <v-tab
        v-for="tb in tabs"
        :key="tb.key"
        :value="tb.key"
        :disabled="tb.disabled"
      >
        {{ t(tb.labelKey) }}
        <v-chip size="x-small" variant="tonal" class="ms-2">{{
          tb.count
        }}</v-chip>
      </v-tab>
    </v-tabs>
    <v-spacer />
    <!-- En "recomendados" el orden lo fija la propia pestana. -->
    <v-select
      v-model="sortBy"
      :items="sortItems"
      :disabled="activeTab?.key === 'recommended'"
      density="compact"
      variant="outlined"
      hide-details
      class="fsrt-sort"
    />
    <v-switch
      v-model="groupSimilar"
      :label="t('cargo.flight.group_similar')"
      density="compact"
      color="primary"
      hide-details
      class="fsrt-group"
    />
  </div>

  <div v-if="summary" class="results-summary mb-2">
    <v-chip size="small" variant="tonal" color="primary" class="me-1">
      <v-icon icon="mdi-lightning-bolt" size="13" class="me-1" />
      {{ summary.bookable }} {{ t("cargo.flight.summary_bookable") }}
    </v-chip>
    <v-chip v-if="summary.cheapest" size="small" variant="tonal" class="me-1">
      <v-icon icon="mdi-tag-outline" size="13" class="me-1" />
      {{ t("cargo.flight.summary_cheapest") }}
      {{ formatRateAmount(summary.cheapest, summary.currency) }}
    </v-chip>
    <v-chip v-if="summary.fastest" size="small" variant="tonal">
      <v-icon icon="mdi-clock-fast" size="13" class="me-1" />
      {{ t("cargo.flight.summary_fastest") }}
      {{ formatTransit(summary.fastest) }}
    </v-chip>
  </div>

  <!--
    Mismo componente base que /ops/cargo/list: hereda cabecera fija, zebra,
    hover, overlay de recarga y el toggle paginado/scroll. Antes era una
    v-data-table pelada que no se parecia a ningun listado del ERP.
  -->
  <ListingDataView
    :source="listSource"
    :headers="headers"
    :selected="[]"
    :mode="viewMode"
    :sort-key-map="sortKeyMap"
    :selectable="false"
    row-key="_rowKey"
    class="flight-results"
    @update:mode="viewMode = $event"
    @row-click="onRowClick"
  >
    <!--
      ZONA 1 — QUIEN vuela.
      Linea 1: codigo IATA (el dato que se busca) + marcadores de tarifa.
      Linea 2: nombre de la aerolinea.
      Linea 3: producto / vuelos agrupados.
      Los distintivos que antes eran chips de texto largo ("Direct booking",
      repetido en 111 filas) pasan a iconos: dicen lo mismo en 16 px y dejan de
      empujar el codigo IATA fuera del golpe de vista.
    -->
    <template #cell.airline="{ item: rawItem }">
      <!-- ListingDataView tipa la fila como IdentifiedRow (solo `id`);
           el cast devuelve la tarifa concreta sin tocar el marcado. -->
      <template v-for="item in [rawItem as NormalizedRate]" :key="item._rowKey">
        <!-- `align-start`, no `align-center`: con el bloque de similares la
             columna crece a cuatro lineas y el logo se iba al centro, asi que
             quedaba a distinta altura que el de las filas vecinas. Anclado
             arriba acompana siempre al codigo IATA, que es su etiqueta. -->
        <div class="d-flex align-start ga-2 fs-zone">
          <!--
          La cola de la aerolínea. Cuando no hay una propia para ese código,
          AirlineLogo cae a la genérica de TMWE, y si esa tampoco carga pinta
          un avión en su propia caja: nunca colapsa, que es lo que descolocaba
          la fila respecto de sus vecinas.

          El código IATA sigue en negrita al lado, no lo sustituye: con 46
          colas y pares visualmente parecidos (LH/LX, AF/KL) la imagen sola
          no identifica de forma fiable.
        -->
          <AirlineLogo :code="item.airline_code" :size="30" class="flex-0-0" />

          <div class="d-flex flex-column min-w-0">
            <!-- L1: identidad + marcadores -->
            <div class="d-flex align-center ga-1">
              <span class="text-subtitle-2 font-weight-bold">{{
                item.airline_code
              }}</span>

              <!--
              Rayo = vuelo PRIORITARIO (el mas barato / el mas rapido de lo
              visible), no "reservable". Antes lo llevaban las 111 filas
              direct-booking a la vez, asi que no señalaba nada.
            -->
              <v-tooltip
                v-if="isPriority(item)"
                location="top"
                :text="t('cargo.flight.priority_hint')"
              >
                <template #activator="{ props: prProps }">
                  <v-icon
                    v-bind="prProps"
                    icon="mdi-lightning-bolt"
                    color="amber-darken-2"
                    size="15"
                  />
                </template>
              </v-tooltip>

              <!--
              Direct booking, ahora icono. Conserva el tooltip con el texto
              completo, asi que la informacion no se pierde: solo deja de
              ocupar 96 px en cada fila.
            -->
              <v-tooltip
                v-if="isDirectBooking(item.source)"
                location="top"
                :text="t('cargo.flight.direct_booking_icon_hint')"
              >
                <template #activator="{ props: bookProps }">
                  <v-icon
                    v-bind="bookProps"
                    icon="mdi-flash-alert"
                    color="primary"
                    size="15"
                  />
                </template>
              </v-tooltip>

              <v-tooltip
                v-if="item._promotional"
                location="top"
                :text="t('cargo.flight.promo_rate')"
              >
                <template #activator="{ props: tipProps }">
                  <v-icon
                    v-bind="tipProps"
                    icon="mdi-tag"
                    color="success"
                    size="14"
                  />
                </template>
              </v-tooltip>
            </div>

            <!-- L2: nombre legible -->
            <span
              v-if="
                item.airline_name && item.airline_name !== item.airline_code
              "
              class="text-caption text-medium-emphasis text-truncate"
            >
              {{ item.airline_name }}
            </span>

            <!-- L3: procedencia de la tarifa y producto, en tono menor -->
            <div class="d-flex align-center ga-1 flex-wrap">
              <!--
              Only worth showing when the list actually mixes sources. On a
              catalogue-only result the same "PUB" chip repeated on all 162 rows
              carries no information and competes with the carrier code, which is
              what the eye is looking for in this column.
            -->
              <v-chip
                v-if="showSourceChip"
                size="x-small"
                variant="tonal"
                :color="sourceColor(item.source)"
                class="fs-chip-mini"
              >
                {{ sourceShort(item.source) }}
              </v-chip>
              <!--
              Con que credencial se cotizo. Mismo criterio que el chip de fuente:
              solo si el listado MEZCLA cuentas, que es cuando el dato distingue
              algo. Con una sola credencial repetirlo en cada fila seria ruido.
            -->
              <v-tooltip
                v-if="showAccountChip && item.account_ref?.label"
                location="top"
                :text="item.account_ref.label"
              >
                <template #activator="{ props: accProps }">
                  <v-chip
                    v-bind="accProps"
                    size="x-small"
                    variant="tonal"
                    class="fs-chip-mini"
                  >
                    {{ accountShort(item) }}
                  </v-chip>
                </template>
              </v-tooltip>
              <span
                v-if="item._product_name"
                class="text-caption text-primary text-truncate"
              >
                {{ item._product_name }}
              </span>
            </div>

            <!--
            Cuantos vuelos casi identicos esconde esta fila, y COMO verlos.

            Era un <span> de texto: anunciaba "+ otros 4 vuelos similares" sin
            ofrecer ninguna manera de abrirlos, y con la agrupacion encendida
            por defecto esos vuelos no se podian alcanzar de ninguna forma.
            Ahora es el boton que los abre.

            `@click.stop` es obligatorio: el <tr> entero lleva `row-click` y sin
            el, abrir el grupo dispararia ademas el detalle del lider.
          -->
            <div
              v-if="similarCount[item._rowKey]"
              class="d-flex align-center ga-1 flex-wrap"
            >
              <v-chip
                size="x-small"
                variant="tonal"
                color="primary"
                link
                class="fs-similar-chip"
                @click.stop="openSimilar(item)"
              >
                <v-icon icon="mdi-chevron-down" size="14" class="me-1" />
                {{
                  t("cargo.flight.similar_n", { n: similarCount[item._rowKey] })
                }}
              </v-chip>
              <!--
              El lider se elige por centroide, no por precio: si el grupo
              esconde algo mas barato hay que decirlo, o plegarlo cuesta dinero
              en silencio.
            -->
              <span
                v-if="groupBestPrice[item._rowKey]"
                class="text-caption text-success font-weight-medium"
              >
                {{ t("cargo.flight.similar_from") }}
                {{
                  formatRateAmount(groupBestPrice[item._rowKey], item._currency)
                }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!--
      ZONA 2 — QUE vuelo es. Ruta, horario y coste unitario en tres lineas.
      Antes eran tres columnas de ancho fijo (160+170+140 px) que en una
      busqueda de catalogo mostraban "—" en las tres. Unidas, el bloque se
      colapsa solo cuando no hay dato en vez de reservar 470 px vacios.
    -->
    <template #cell.flight="{ item: rawItem }">
      <template v-for="item in [rawItem as NormalizedRate]" :key="item._rowKey">
        <div class="d-flex flex-column fs-zone ga-0">
          <!--
          L1: que trayecto es. El par origen→destino NO va aqui: es el mismo
          para las 998 filas —lo fija la busqueda y ya se lee en la cabecera del
          modal—, asi que repetirlo por fila solo gastaria ancho. Lo que si
          distingue una fila de otra es el numero de vuelo y la forma del
          trayecto.
        -->
          <div class="d-flex align-center ga-2 flex-wrap">
            <span
              v-if="flightLabel(item)"
              class="text-body-2 font-weight-bold fs-route"
            >
              {{ flightLabel(item) }}
            </span>
            <span
              v-if="item.direct_flight"
              class="text-caption text-success font-weight-medium"
            >
              <v-icon icon="mdi-airplane" size="12" />
              {{ t("cargo.flight.direct") }}
            </span>
            <span
              v-else-if="item.stopovers"
              class="text-caption text-medium-emphasis"
            >
              <v-icon icon="mdi-map-marker-path" size="12" />
              {{ plural("cargo.flight.stops_n", item.stopovers) }}
            </span>
            <span
              v-if="item._via.length"
              class="text-caption text-medium-emphasis"
            >
              {{ t("cargo.flight.via") }} {{ item._via.join(" · ") }}
            </span>
            <!-- El recuento de tramos solo cuando NO se listan los vuelos: con
                 "KL8623 · KL0083 · KL7035E" delante, "3 tratte" cuenta lo que ya
                 esta a la vista. -->
            <span
              v-else-if="segCount(item) > 1 && !flightLabel(item)"
              class="text-caption text-medium-emphasis"
            >
              {{ plural("cargo.flight.segments_n", segCount(item)) }}
            </span>
          </div>

          <!--
          L2: horarios. La SALIDA lleva la escala semaforo por dias hasta el
          despegue — mismo codigo de color que el countdown del realtime B2B —
          porque en un listado de una semana la fecha por si sola no dice si
          hay margen para preparar la carga.
        -->
          <!-- `_last_acceptance` cuenta para mostrar la linea: hay tarifas con
               cut-off y sin horarios, y sin el en la condicion ese dato se
               perdia justo en las filas donde es lo unico temporal que hay. -->
          <div
            v-if="
              item.departure ||
              item.arrival ||
              item.transit_hours ||
              item._last_acceptance
            "
            class="d-flex align-center ga-3 flex-wrap"
          >
            <v-tooltip
              v-if="item.departure"
              location="top"
              :text="departureHint(item.departure)"
            >
              <template #activator="{ props: depProps }">
                <span
                  v-bind="depProps"
                  class="text-caption font-weight-medium cursor-help"
                  :class="`text-${departureColor(item.departure)}`"
                >
                  <v-icon icon="mdi-airplane-takeoff" size="12" />
                  {{ formatDateTime(String(item.departure)) }}
                </span>
              </template>
            </v-tooltip>
            <span v-if="item.arrival" class="text-caption text-medium-emphasis">
              <v-icon icon="mdi-airplane-landing" size="12" />
              {{ formatDateTime(String(item.arrival)) }}
            </span>
            <span
              v-if="item.transit_hours"
              class="text-caption text-medium-emphasis"
            >
              <v-icon icon="mdi-clock-outline" size="12" />
              {{ formatTransit(item.transit_hours) }}
            </span>
            <!--
            Cut-off: LA fecha que decide si aun se llega a entregar la mercancia
            a tiempo. Estaba normalizado y documentado, pero solo se veia
            abriendo el detalle — un clic por fila para un dato que se compara
            entre filas.

            El `~` marca el estimado: en `realtime` el valor sale de un
            parametro que enviamos nosotros, no de lo que dicta la aerolinea
            para ese vuelo, y pintarlos igual haria pasar una estimacion por un
            compromiso firme. Mismo criterio que CargoFlightManagerCard.
          -->
            <v-tooltip
              v-if="item._last_acceptance"
              location="top"
              :text="
                item._last_acceptance_estimated
                  ? t('cargo.flight.cutoff_estimated')
                  : t('cargo.flight.cutoff')
              "
            >
              <template #activator="{ props: coProps }">
                <span
                  v-bind="coProps"
                  class="text-caption cursor-help"
                  :class="
                    item._last_acceptance_estimated
                      ? 'text-medium-emphasis'
                      : 'text-warning font-weight-medium'
                  "
                >
                  <v-icon icon="mdi-calendar-clock" size="12" />
                  {{ item._last_acceptance_estimated ? "~" : ""
                  }}{{ formatDateTime(String(item._last_acceptance)) }}
                </span>
              </template>
            </v-tooltip>
          </div>
          <!--
          A catalogue rate has no flight assigned, so these are genuinely
          unknown rather than missing. Saying so stops the dash reading as a
          bug — and as a hint that a firm quote would carry the real times.
        -->
          <v-tooltip
            v-else
            location="top"
            :text="
              isDirectBooking(item.source)
                ? t('cargo.flight.times_unknown')
                : t('cargo.flight.times_catalogue_hint')
            "
          >
            <template #activator="{ props: naProps }">
              <span
                v-bind="naProps"
                class="text-caption text-medium-emphasis cursor-help"
              >
                <v-icon icon="mdi-clock-outline" size="12" /> —
              </span>
            </template>
          </v-tooltip>

          <!-- L3: peso tasado y coste unitario, la base del precio de la derecha -->
          <div
            v-if="item._chargeable_weight_n || item._rate_per_kg_n"
            class="d-flex align-center ga-3 flex-wrap"
          >
            <span
              v-if="item._chargeable_weight_n"
              class="text-caption text-medium-emphasis"
            >
              <v-icon icon="mdi-weight-kilogram" size="12" />
              {{
                t("cargo.flight.kg_value", {
                  v: item._chargeable_weight_n.toFixed(1),
                })
              }}
            </span>
            <span
              v-if="item._rate_per_kg_n"
              class="text-caption text-medium-emphasis"
            >
              {{ formatRateAmount(item._rate_per_kg_n, item._currency)
              }}{{ t("cargo.flight.per_kg") }}
            </span>
            <v-tooltip
              v-if="item._minimum_charge_n"
              location="top"
              :text="
                item.minimum_applied
                  ? t('cargo.flight.minimum_applied_hint')
                  : t('cargo.flight.minimum_hint')
              "
            >
              <template #activator="{ props: minProps }">
                <span
                  v-bind="minProps"
                  class="text-caption cursor-help"
                  :class="
                    item.minimum_applied
                      ? 'text-warning font-weight-medium'
                      : 'text-medium-emphasis'
                  "
                >
                  {{
                    t("cargo.flight.min_charge_short", {
                      v: formatRateAmount(
                        item._minimum_charge_n,
                        item._currency,
                      ),
                    })
                  }}
                </span>
              </template>
            </v-tooltip>
          </div>
        </div>
      </template>
    </template>

    <!-- Price -->
    <template #cell._client_price_n="{ item: rawItem }">
      <!-- ListingDataView tipa la fila como IdentifiedRow (solo `id`);
           el cast devuelve la tarifa concreta sin tocar el marcado. -->
      <template v-for="item in [rawItem as NormalizedRate]" :key="item._rowKey">
        <!-- `.fs-zone` como las otras tres celdas: era la unica que no la
             llevaba, asi que no tenia el `min-height` comun y con
             `vertical-align: top` en el <td> el precio quedaba pegado arriba
             mientras carrier y vuelo ocupaban sus 46px. Desalineaba la columna
             que mas se lee, en todas las filas. -->
        <div class="d-flex flex-column align-end fs-zone">
          <!-- price is the column people decide on: it must read first -->
          <span
            v-if="item.price_incomplete"
            class="text-body-2 text-medium-emphasis"
          >
            {{ t("cargo.flight.no_price") }}
          </span>
          <template v-else>
            <span class="text-h6 font-weight-bold price-main">
              {{ formatRateAmount(item._client_price_n, item._currency) }}
            </span>
            <!--
            Cost and margin on ONE line, right under the sale price. An operator
            decides with both numbers, and the margin was only visible by opening
            the detail dialog — a click per row to answer a question asked of
            every row. Visibility rules still apply upstream: a client-level
            session never receives `cost`, so this simply does not render.
          -->
            <span
              v-if="item._cost_n && item._cost_n !== item._client_price_n"
              class="text-caption text-medium-emphasis price-cost"
            >
              <!-- Sin el codigo de moneda: lo lleva el precio de venta justo
                   encima y repetirlo en la linea de coste solo anade ruido. -->
              {{ t("cargo.flight.cost_label") }}
              {{ formatRateNumber(item._cost_n, item._currency) }}
              <span v-if="marginPercent(item) !== null" class="ms-1">
                · +{{ marginPercent(item) }}%
              </span>
            </span>
          </template>
          <div class="d-flex align-center justify-end ga-1 flex-wrap">
            <!--
            L3 de la zona de precio: la VALIDEZ, que antes vivia en su propia
            columna de 130 px. Va pegada al importe porque es su condicion — un
            precio firme que caduca en 18 min y una tarifa de temporada son
            numeros que no se leen igual.
          -->
            <v-chip
              v-if="isDirectBooking(item.source) && item._valid_to"
              size="x-small"
              variant="tonal"
              :color="expiryColor(item._valid_to)"
            >
              <v-icon icon="mdi-timer-outline" size="11" class="me-1" />
              {{ expiryLabel(item._valid_to) }}
            </v-chip>
            <span
              v-else-if="item._valid_from || item._valid_to"
              class="text-caption"
              :class="
                expiresSoon(item._valid_to)
                  ? 'text-warning'
                  : 'text-medium-emphasis'
              "
            >
              <!-- Una sola interpolacion: dos <template> adyacentes se pegaban
                   sin separador y salia "dal 29/03al 24/10". -->
              {{ validityRange(item) }}
            </span>

            <!-- all_in: surcharges are inside the total, not missing from it -->
            <v-tooltip
              v-if="item.all_in"
              location="top"
              :text="t('cargo.flight.all_in_hint')"
            >
              <template #activator="{ props: aiProps }">
                <v-chip
                  v-bind="aiProps"
                  size="x-small"
                  variant="tonal"
                  color="success"
                >
                  {{ t("cargo.flight.all_in") }}
                </v-chip>
              </template>
            </v-tooltip>
            <!--
            "2 surcharges" told the operator a count and nothing else — which
            two, and for how much, needed the detail dialog. The breakdown is
            already on the row, so it goes in a tooltip. Also drops a hardcoded
            Italian string that ignored the locale.
          -->
            <v-tooltip v-else-if="item._surcharges_n.length" location="top">
              <template #activator="{ props: scProps }">
                <span
                  v-bind="scProps"
                  class="text-caption text-medium-emphasis cursor-help"
                >
                  {{
                    t("cargo.flight.surcharges_count", {
                      n: item._surcharges_n.length,
                    })
                  }}
                </span>
              </template>
              <div class="text-caption">
                <div v-for="(sc, i) in item._surcharges_n.slice(0, 8)" :key="i">
                  {{ sc.name || sc.code }}
                  <span v-if="sc.amount">
                    · {{ formatRateAmount(sc.amount, item._currency) }}
                  </span>
                </div>
              </div>
            </v-tooltip>
          </div>
        </div>
      </template>
    </template>

    <!-- Actions -->
    <template #cell.actions="{ item: rawItem }">
      <!-- ListingDataView tipa la fila como IdentifiedRow (solo `id`);
           el cast devuelve la tarifa concreta sin tocar el marcado. -->
      <template v-for="item in [rawItem as NormalizedRate]" :key="item._rowKey">
        <div class="d-flex ga-1 justify-end align-center fs-zone">
          <v-btn
            size="x-small"
            variant="text"
            icon="mdi-information-outline"
            @click.stop="emit('detail', item)"
          />
          <!--
          A direct-booking row leads to a real reservation; a catalogue row is
          only a selection. Same button for both understated the difference.
        -->
          <!-- Sin relleno mientras NO esta seleccionado (`text`): con `tonal`
               cada fila del listado pintaba un bloque de color, y al repetirse
               en todas competian por la atencion con el estado seleccionado,
               que es el unico que deberia destacar. Tampoco `outlined`: el
               borde de 1px mas su padding se comia ancho de columna y
               recortaba la etiqueta.

               El seleccionado sigue siendo `flat` + `primary`, asi que el
               contraste entre ambos estados es ahora mayor, no menor. -->
          <v-btn
            size="small"
            :variant="selectedKey === item._rowKey ? 'flat' : 'text'"
            :color="selectedKey === item._rowKey ? 'primary' : undefined"
            prepend-icon="mdi-check"
            @click.stop="emit('select', item)"
          >
            {{
              selectedKey === item._rowKey
                ? t("cargo.flight.selected_short")
                : t("cargo.flight.action_select")
            }}
          </v-btn>
        </div>
      </template>
    </template>
  </ListingDataView>

  <!--
    Los vuelos plegados detras de un lider. `select` y `detail` se reemiten tal
    cual hacia arriba: elegir uno de los similares debe recorrer exactamente el
    mismo camino que elegirlo desde el listado, sin una segunda via de
    asignacion que mantener.
  -->
  <SimilarFlightsDialog
    v-model="similarOpen"
    :group="similarGroup"
    :selected-key="selectedKey"
    @select="onSimilarSelect"
    @detail="emit('detail', $event)"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import AirlineLogo from "../AirlineLogo.vue";
import {
  segmentsFromRate,
  isDirectBooking,
  buildTabs,
  ratesForTab,
  groupBySimilarity,
  sourceShortLabel,
  sourceColorFor,
  flightLabelOf,
  formatFlightDateTime,
  formatFlightDate,
  formatTransitHours,
  formatRateAmount,
  formatRateNumber,
  type FlightTab,
  type FlightSortBy,
  type NormalizedRate,
  type RateGroup,
} from "@cargo/services/flight_search.service";
import SimilarFlightsDialog from "./SimilarFlightsDialog.vue";

const { t } = useI18n();
const props = defineProps<{
  rates: NormalizedRate[];
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  (e: "select", rate: NormalizedRate): void;
  (e: "detail", rate: NormalizedRate): void;
}>();

/**
 * Bookable rows first, then by client price.
 *
 * Done here rather than through the table's own sort so it survives the user
 * re-sorting by another column, and because KLM returns NOT_BOOKABLE options
 * priced at 0.00 (6 of 52 on a live answer) — sorting on price alone floats
 * those to the top and the "cheapest" option turns out to be unbookable.
 */
/** Headline figures for the strip above the table. */
const summary = computed(() => {
  const rows = props.rates;
  if (!rows.length) return null;

  const priced = rows.filter(
    (r) => !r.price_incomplete && r._client_price_n > 0,
  );
  const transits = rows
    .map((r) => Number(r.transit_hours ?? 0))
    .filter((n) => n > 0);

  return {
    bookable: rows.filter(
      (r) => isDirectBooking(r.source) && !r.price_incomplete,
    ).length,
    cheapest: priced.length
      ? Math.min(...priced.map((r) => r._client_price_n))
      : null,
    fastest: transits.length ? Math.min(...transits) : null,
    currency: rows[0]?._currency ?? "EUR",
  };
});

/* ─── Pestanas por fuente ───
   Se recalculan segun van llegando tarifas por SSE. `activeTabKey` guarda la
   eleccion del operador y se respeta mientras esa pestana siga existiendo; si
   desaparece, se cae a la primera. Asi no se pierde la seleccion a mitad de la
   busqueda. */
const tabs = computed<FlightTab[]>(() => buildTabs(props.rates));
const activeTabKey = ref<string | null>(null);
const activeTab = computed<FlightTab | null>(() => {
  const list = tabs.value;
  if (!list.length) return null;
  return list.find((tb) => tb.key === activeTabKey.value) ?? list[0];
});

/** Orden elegido por el operador. En la pestana "recomendados" manda ella. */
const sortBy = ref<FlightSortBy>("recommended");

/** Agrupar vuelos casi identicos. ON por defecto: es el modo util con 300+. */
const groupSimilar = ref(true);

const sortItems = computed(() => [
  { value: "recommended", title: t("cargo.flight.sort_recommended") },
  { value: "price", title: t("cargo.flight.sort_price") },
  { value: "arrival", title: t("cargo.flight.sort_arrival") },
  { value: "transit", title: t("cargo.flight.sort_transit") },
  { value: "stops", title: t("cargo.flight.sort_stops") },
]);

/**
 * Orden del listado.
 *
 * SIN pestanas —una sola fuente— se conserva EXACTAMENTE el orden de siempre:
 * primero las reservables con precio completo, luego el resto, y dentro de
 * cada bloque por precio. Cambiarlo sin avisar habria alterado lo que el
 * operador ya conoce.
 *
 * `_rowKey` NO se toca al reordenar: la identidad viene del vuelo, no de la
 * posicion, asi que Vue MUEVE la fila en vez de recrearla.
 */
const orderedRates = computed<NormalizedRate[]>(() => {
  if (!tabs.value.length) {
    return [...props.rates].sort((a, b) => {
      const ra = isDirectBooking(a.source) && !a.price_incomplete ? 0 : 1;
      const rb = isDirectBooking(b.source) && !b.price_incomplete ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (a._client_price_n ?? 0) - (b._client_price_n ?? 0);
    });
  }
  return ratesForTab(props.rates, activeTab.value, sortBy.value);
});

/** Grupos del conjunto YA ordenado: agrupar despues de ordenar conserva el
    ranking, porque groupBySimilarity respeta el orden de entrada. */
const groups = computed(() =>
  groupSimilar.value ? groupBySimilarity(orderedRates.value) : [],
);

/**
 * Filas que se pintan: los lideres de cada grupo, o todas si la agrupacion
 * esta apagada. El grupo es una VISTA, no una identidad nueva, asi que
 * `_rowKey` sigue intacto.
 */
const visibleRates = computed<NormalizedRate[]>(() =>
  groupSimilar.value ? groups.value.map((g) => g.leader) : orderedRates.value,
);

/** Cuantos similares esconde cada lider, indexado por `_rowKey`. */
const similarCount = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  for (const g of groups.value) {
    if (g.members.length) out[g.leader._rowKey] = g.members.length;
  }
  return out;
});

/**
 * El GRUPO completo de cada lider, no solo su recuento.
 *
 * `groupBySimilarity` ya devolvia `members`, pero aqui solo se guardaba su
 * longitud para escribir "+ otros N vuelos similares" y el resto se tiraba.
 * Con la agrupacion activa por defecto, esos vuelos no eran alcanzables por
 * ninguna via: el texto no era clicable y apagar el switch devolvia el listado
 * entero sin el grupo. Guardarlos es lo que permite abrirlos.
 */
const groupOf = computed<Record<string, RateGroup>>(() => {
  const out: Record<string, RateGroup> = {};
  for (const g of groups.value) {
    if (g.members.length) out[g.leader._rowKey] = g;
  }
  return out;
});

/**
 * El miembro mas barato de cada grupo, SOLO si bate al lider.
 *
 * El lider se elige por cercania al centroide, no por precio, asi que el vuelo
 * mas barato del grupo puede ser uno de los plegados. Anunciarlo en el chip es
 * la razon de peso para abrirlo: sin esto, esconder los miembros cuesta dinero
 * en silencio.
 */
const groupBestPrice = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  for (const g of groups.value) {
    if (!g.members.length) continue;
    const lead = g.leader._client_price_n;
    // Un lider sin precio utilizable no da con que comparar.
    if (!(lead > 0)) continue;
    let best = lead;
    for (const m of g.members) {
      const p = m._client_price_n;
      // `> 0` a proposito: KLM devuelve 0.00 en las opciones NO reservables, y
      // tomarlas por "las mas baratas" anunciaria un ahorro inexistente.
      if (p > 0 && !m.price_incomplete && p < best) best = p;
    }
    if (best < lead) out[g.leader._rowKey] = best;
  }
  return out;
});

/** Grupo abierto en el dialogo de similares. */
const similarGroup = ref<RateGroup | null>(null);
const similarOpen = ref(false);

function openSimilar(item: NormalizedRate): void {
  const g = groupOf.value[item._rowKey];
  if (!g) return;
  similarGroup.value = g;
  similarOpen.value = true;
}

/**
 * Elegir uno de los similares cierra el dialogo y sigue el camino normal.
 *
 * El wizard de confirmacion se abre por encima de este listado; dejar el
 * dialogo del grupo abierto detras apilaria tres capas sobre el modal y el
 * wizard quedaria por debajo de una de ellas.
 */
function onSimilarSelect(rate: NormalizedRate): void {
  similarOpen.value = false;
  emit("select", rate);
}

/** True once the visible rows come from more than one source. */
const showSourceChip = computed<boolean>(
  () => new Set(props.rates.map((r) => r.source)).size > 1,
);

/**
 * Cuatro zonas, no siete columnas.
 *
 * La rejilla anterior repartia el mismo dato en celdas separadas —ruta en una,
 * horarios en otra, peso en una tercera— y cada una imponia su propio ancho
 * fijo. El resultado era una fila de una sola linea con siete bloques de
 * `text-caption` del mismo tamano: nada destacaba porque todo pesaba igual.
 *
 * Ahora la fila ocupa tres lineas y el contenido se agrupa por lo que el
 * operador pregunta, en el orden en que lo pregunta:
 *
 *   QUIEN vuela   → carrier + logo + procedencia de la tarifa
 *   QUE vuelo es  → ruta, horarios, transito, peso y tarifa/kg
 *   CUANTO cuesta → precio, coste/margen, validez
 *   ACCION        → detalle + asignar
 *
 * La jerarquia la marca la tipografia dentro de cada zona (linea 1 fuerte,
 * lineas 2-3 secundarias), no el ancho de la columna.
 */
const headers = computed(() => [
  {
    title: t("cargo.servizio.carrier"),
    key: "airline",
    sortable: true,
    // 220, no 190: con `table-layout: fixed` el ancho ya no es una sugerencia
    // que la tabla pueda ampliar, asi que tiene que caber de verdad el peor
    // caso — logo (30) + gap (8) + el chip «+N vuelos similares» con su precio
    // debajo. Con 190 ese bloque envolvia a una linea extra y esas filas
    // quedaban mas altas que las vecinas.
    width: 220,
  },
  {
    title: t("cargo.flight.flight_col"),
    key: "flight",
    sortable: false,
    // Zona elastica: absorbe el ancho sobrante en vez de dejar aire muerto
    // entre columnas de ancho fijo.
    width: undefined,
  },
  {
    title: t("cargo.flight.client_price"),
    key: "_client_price_n",
    sortable: true,
    align: "end" as const,
    width: 190,
  },
  {
    title: "",
    key: "actions",
    sortable: false,
    width: 120,
    align: "end" as const,
  },
]);

/**
 * Applied margin as a whole percentage, or null when it cannot be derived.
 *
 * Computed from cost↔client rather than read from a config lookup, so it always
 * matches the two figures actually shown on the row — including rates that
 * arrived pre-marked from the cache.
 */
function marginPercent(r: NormalizedRate): number | null {
  const cost = r._cost_n;
  const client = r._client_price_n;
  if (!cost || !client || cost <= 0 || client <= cost) return null;
  return Math.round(((client - cost) / cost) * 100);
}

function segCount(r: NormalizedRate): number {
  return segmentsFromRate(r).length;
}

/**
 * Forma plural con el contador tambien disponible como `{n}`.
 *
 * `t(key, n, named)` existe en vue-i18n pero su tipado no expone ese overload,
 * asi que se envuelve una sola vez aqui en lugar de repartir casts por la
 * plantilla. El contador va DOS veces a proposito: como selector de rama y
 * como valor interpolable dentro de cada rama.
 */
function plural(key: string, n: number): string {
  return t(key, { n, count: n, plural: n }, n);
}

/* `flightLabel`, `formatDateTime`, `formatDate` y `formatTransit` vivian aqui
   COPIADOS literalmente en SimilarFlightsDialog (y dos de ellos tambien en
   FlightDetailDialog): tres pantallas que muestran el mismo vuelo formateandolo
   cada una por su cuenta. Ahora salen del servicio compartido. */
const flightLabel = flightLabelOf;

/*
 * NOTA: aqui vivia `rowProps()`, que devolvia la clase `row-direct-booking`
 * para tintar las filas reservables. Era codigo muerto: `ListingDataView` no
 * expone ningun hook de clase por fila —ni `row-props` ni equivalente—, asi
 * que la funcion no la llamaba nadie y el resaltado nunca llego a verse.
 *
 * La distincion no se pierde: cada fila reservable lleva su icono de direct
 * booking en la zona de carrier, que ademas es visible en escala de grises.
 */

/* Etiqueta y color del chip de procedencia: definidos en el servicio para que
   el wizard de seleccion muestre exactamente lo mismo que el listado. */
const sourceColor = sourceColorFor;
const sourceShort = sourceShortLabel;

const formatDateTime = formatFlightDateTime;
const formatDate = formatFlightDate;
const formatTransit = formatTransitHours;

/**
 * Ticking clock so the countdown actually counts down. Vue only re-renders on
 * reactive change, so without this the label freezes at render time and a
 * quote can read "12 min" long after it died.
 */
const nowTick = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  tickTimer = setInterval(() => (nowTick.value = Date.now()), 30_000);
});
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});

function minutesLeft(iso: string | null): number | null {
  if (!iso) return null;
  const exp = new Date(iso).getTime();
  if (Number.isNaN(exp)) return null;
  return Math.floor((exp - nowTick.value) / 60_000);
}

/** Countdown for firm quotes: minutes while it matters, then hours/days. */
function expiryLabel(iso: string | null): string {
  const mins = minutesLeft(iso);
  if (mins === null) return "—";
  if (mins <= 0) return t("cargo.flight.expired");
  if (mins < 60) return t("cargo.flight.expires_in_min", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("cargo.flight.expires_in_h", { n: hours });
  return t("cargo.flight.expires_in_d", { n: Math.floor(hours / 24) });
}

function expiryColor(iso: string | null): string {
  const mins = minutesLeft(iso);
  if (mins === null) return "grey";
  if (mins <= 0) return "error";
  if (mins <= 5) return "warning";
  return "success";
}

/**
 * Ventana de validez de una tarifa de catalogo: "dal 29/03 al 24/10".
 *
 * Se compone aqui y no en la plantilla porque cada extremo es opcional: con dos
 * `<template v-if>` contiguos el renderizador no inserta separacion y las dos
 * mitades salian pegadas ("dal 29/03al 24/10").
 */
function validityRange(r: NormalizedRate): string {
  const parts: string[] = [];
  if (r._valid_from) {
    parts.push(
      t("cargo.flight.valid_from_short", { d: formatDate(r._valid_from) }),
    );
  }
  if (r._valid_to) {
    parts.push(
      t("cargo.flight.valid_to_short", { d: formatDate(r._valid_to) }),
    );
  }
  return parts.join(" ");
}

function expiresSoon(iso: string | null): boolean {
  if (!iso) return false;
  const exp = new Date(iso);
  if (Number.isNaN(exp.getTime())) return false;
  const days = (exp.getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 3;
}

/* ─── Urgencia por fecha de SALIDA ────────────────────────────────────────────
   Misma lectura semaforo que el countdown de booking realtime del B2B, pero
   medida en dias hasta el despegue en vez de horas hasta el cut-off: en un
   listado que abarca una semana, una escala en horas marcaria todo en verde.

   Cuenta DIAS DE CALENDARIO, no multiplos de 24 h. Un vuelo que sale manana a
   las 07:00 esta a 19 h — con una division por 86.400.000 caeria en "hoy" y se
   pintaria rojo. El operador razona en dias del calendario, asi que se compara
   la fecha a medianoche.

   Los umbrales viven en un solo sitio porque tres cosas los consumen: el color
   del texto, el icono y el texto del tooltip. */
function daysUntilDeparture(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dep = new Date(String(iso));
  if (Number.isNaN(dep.getTime())) return null;
  const depMidnight = new Date(
    dep.getFullYear(),
    dep.getMonth(),
    dep.getDate(),
  ).getTime();
  const now = new Date(nowTick.value);
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.round((depMidnight - todayMidnight) / 86_400_000);
}

/** grey = sin fecha · error = hoy/pasado · warning = 1-3 dias · success = 4+ */
function departureColor(iso: string | null | undefined): string {
  const d = daysUntilDeparture(iso);
  if (d === null) return "grey";
  if (d <= 0) return "error";
  if (d <= 3) return "warning";
  return "success";
}

function departureHint(iso: string | null | undefined): string {
  const d = daysUntilDeparture(iso);
  if (d === null) return "";
  if (d < 0) return t("cargo.flight.dep_past");
  if (d === 0) return t("cargo.flight.dep_today");
  if (d === 1) return t("cargo.flight.dep_tomorrow");
  return t("cargo.flight.dep_in_days", { n: d });
}

/**
 * Vuelo prioritario: el que merece el rayo.
 *
 * El rayo estaba en el chip "Direct booking", donde no distinguia nada — lo
 * llevaban las 111 filas reservables por igual. Aqui marca lo que de verdad
 * destaca en el conjunto visible: el mas barato y el mas rapido. Se calcula
 * sobre las filas VISIBLES (pestana + agrupacion aplicadas), porque "el mas
 * barato" solo significa algo dentro de lo que el operador esta mirando.
 */
const priorityKeys = computed<Set<string>>(() => {
  const rows = visibleRates.value.filter(
    (r) => isDirectBooking(r.source) && !r.price_incomplete,
  );
  const out = new Set<string>();
  if (!rows.length) return out;

  const priced = rows.filter((r) => r._client_price_n > 0);
  if (priced.length) {
    let best = priced[0];
    for (const r of priced)
      if (r._client_price_n < best._client_price_n) best = r;
    out.add(best._rowKey);
  }

  const timed = rows.filter((r) => Number(r.transit_hours) > 0);
  if (timed.length) {
    let fast = timed[0];
    for (const r of timed)
      if (Number(r.transit_hours) < Number(fast.transit_hours)) fast = r;
    out.add(fast._rowKey);
  }
  return out;
});

function isPriority(r: NormalizedRate): boolean {
  return priorityKeys.value.has(r._rowKey);
}
// ─── Listado estandar del proyecto ──────────────────────────────────────────
// `orderedRates` ya viene ordenado (bookable primero) y filtrado por el
// composable; useClientSideListSource solo lo pagina/ordena en memoria.
const viewMode = useListViewMode("tmwe:flight-search-view-mode", "paginated");
const listSource = useClientSideListSource<NormalizedRate>(
  () => visibleRates.value,
  { mode: () => viewMode.value, initialPerPage: 25 },
);

/**
 * Columnas ordenables. Solo las que son un valor escalar de la fila: las
 * compuestas (ruta, horarios, acciones) no tienen un criterio unico.
 */
// `weight` y `validity` se han retirado: eran restos de la rejilla anterior de
// siete columnas y ya no corresponden a ninguna cabecera, asi que nunca podian
// llegar como criterio de orden. Las dos que quedan son las unicas `sortable`.
const sortKeyMap: Record<string, string> = {
  airline: "airline_code",
  _client_price_n: "_client_price_n",
};

/**
 * Clic en la fila: abre el DETALLE, no selecciona.
 *
 * `ListingDataView` marca cada `<tr>` como `role="button"` con su propio
 * @click, asi que un clic en cualquier celda dispara `row-click`. Antes esto
 * emitia `select`, de modo que pulsar en cualquier punto de la fila arrancaba
 * el flujo de asignacion del vuelo a la expedicion — una accion que escribe en
 * la expedicion, disparada por un clic accidental en una celda cualquiera.
 *
 * Ahora la fila abre el detalle (reversible, y lo que hace `row-click` en el
 * resto del proyecto: abrir un registro) y ASIGNAR queda solo en su boton, que
 * lleva @click.stop para que el <tr> no se ejecute detras.
 *
 * La fila se resuelve por `_rowKey` — derivado de short_id/rate_id, propiedad
 * del vuelo — y no por `id`, que es un correlativo de render. Se mantiene `id`
 * como respaldo por si alguna fila llegara sin clave.
 */
function onRowClick(row: { id: number; _rowKey?: string }): void {
  const hit =
    (row._rowKey
      ? orderedRates.value.find((r) => r._rowKey === row._rowKey)
      : undefined) ?? orderedRates.value.find((r) => r.id === row.id);

  if (!hit) {
    console.error("[flight-search] row not found for selection", row);
    return;
  }
  emit("detail", hit);
}
/**
 * ¿Merece la pena mostrar la cuenta en cada fila?
 *
 * Solo cuando el listado mezcla credenciales — al marcar varias en el panel.
 * Con una sola, la etiqueta seria identica en todas las filas.
 */
const showAccountChip = computed<boolean>(() => {
  const seen = new Set(props.rates.map((r) => r.account_ref?.ref_id ?? 0));
  return seen.size > 1;
});

/** Etiqueta corta de la cuenta: el pais entre parentesis, o "IT" si es directa. */
function accountShort(r: NormalizedRate): string {
  const label = r.account_ref?.label ?? "";
  const m = label.match(/\(([A-Z]{2})\)/);
  return m ? m[1] : "IT";
}
</script>

<style scoped>
/* Pestanas a la izquierda, orden y agrupacion a la derecha. En pantalla
   estrecha cae a dos lineas en vez de comprimir los controles. */
.fsrt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.fsrt-tabs {
  flex: 1 1 auto;
  min-width: 0;
}
.fsrt-sort {
  flex: 0 0 170px;
}
.fsrt-group {
  flex: 0 0 auto;
}
.results-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.price-main {
  line-height: 1.2;
}
.cursor-help {
  cursor: help;
}
/* Las reglas de `tr.row-direct-booking` se han retirado con `rowProps()`:
   nada anadia nunca esa clase al <tr>, asi que eran selectores sin sujeto. */

/*
 * Fila de tres lineas.
 *
 * El alto se pide con padding vertical y no con `height` fija: una fila de
 * catalogo no tiene horarios y se queda en dos lineas, y forzar la altura le
 * dejaria un hueco muerto. `align-items: flex-start` alinea las tres zonas por
 * su primera linea, que es donde estan los datos que se comparan entre filas
 * (codigo IATA, numero de vuelo, precio) — centrarlas verticalmente los
 * desalineaba entre si segun cuantas lineas trajera cada una.
 */
.flight-results :deep(td) {
  vertical-align: top;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}

/*
 * `fixed`, para que los anchos de cabecera se RESPETEN.
 *
 * `ListingDataView` pone el `width` solo en el <th>, y con el algoritmo `auto`
 * del navegador eso es una sugerencia: en cuanto el bloque «+N similares» no
 * cabia en los 190px de la columna carrier, la tabla la ensanchaba — y como es
 * un <table>, TODAS las filas se recolocaban a la vez. Al paginar, las columnas
 * saltaban segun lo que trajera la pagina.
 *
 * Se aplica AQUI y no en ListingDataView a proposito: ese componente lo
 * comparten muchos listados con anchos pensados para el modo `auto`, y
 * cambiarlo alli obligaria a revisarlos todos.
 */
.flight-results :deep(.sdv-table),
.flight-results :deep(.v-table__wrapper > table) {
  table-layout: fixed;
}
/*
 * `flex-start`, NO `center`.
 *
 * El bloque de arriba dice que las zonas se alinean por su primera linea, pero
 * `justify-content: center` hacia lo contrario: en una zona en columna centra
 * el contenido dentro de los 46px, asi que una fila de una linea bajaba su
 * texto al medio mientras una de cuatro empezaba arriba del todo. Con `top` en
 * el <td> y `center` aqui, ninguna primera linea coincidia con la de la fila
 * de al lado — que es justo lo que se compara al leer la tabla.
 */
.fs-zone {
  min-height: 46px;
  justify-content: flex-start;
}
/* Interlineado propio: el de Vuetify (1.5) separa demasiado tres lineas
   seguidas de text-caption y desperdicia el alto que acabamos de ganar. */
.fs-zone :deep(.text-caption),
.fs-zone .text-caption {
  line-height: 1.45;
}
.fs-route {
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
/* Los chips de procedencia son metadato de tercera linea: se encogen para no
   competir con el codigo IATA de la primera. */
.fs-chip-mini {
  height: 15px;
  font-size: 9px;
  padding-inline: 5px;
  letter-spacing: 0.03em;
}
/* El chip de similares se referenciaba en el marcado pero NUNCA se definia:
   se quedaba con el `x-small` de Vuetify (~20px) justo debajo de los
   `.fs-chip-mini` (15px), asi que dos lineas consecutivas de la misma celda
   tenian escalas distintas. Se alinea con ellos, un punto mayor porque este si
   es interactivo y necesita area de click. */
.fs-similar-chip {
  height: 18px;
  font-size: 10px;
  padding-inline: 6px;
  letter-spacing: 0.02em;
}
/* Con `table-layout: fixed` lo que desborda ya no ensancha la columna: hay que
   decirle al contenido que se recorte. Sin esto el texto se saldria de la
   celda en vez de truncar. */
.fs-zone {
  max-width: 100%;
  overflow: hidden;
}
.min-w-0 {
  min-width: 0;
}
</style>
