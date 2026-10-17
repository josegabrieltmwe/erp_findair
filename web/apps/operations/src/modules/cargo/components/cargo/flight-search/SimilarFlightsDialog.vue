<template>
  <!--
    Los vuelos que la agrupacion pliega detras de su lider.

    `groupBySimilarity` ya calculaba el grupo entero, pero el listado solo
    pintaba al lider y de los demas conservaba el numero: "+ otros 4 vuelos
    similares" era texto muerto. Con la agrupacion encendida por defecto, esos
    vuelos no eran alcanzables por ninguna via — ni siquiera apagando el
    interruptor, que devuelve las ~900 filas sin conservar el grupo.

    Se abre como dialogo y no como fila desplegable a proposito:
    ListingDataView (compartido con /ops/cargo/list y otros listados) no admite
    expansion de filas, y anadirsela para este unico caso tocaria un componente
    base del que cuelgan pantallas ajenas a esta.

    El marcado de cada fila REPLICA la jerarquia del listado (logo + tres lineas
    + precio a la derecha) en vez de la rejilla plana de una linea que tenia
    antes: es la misma decision de compra, y presentarla de dos formas distintas
    obligaba a releerlo todo al saltar de una vista a otra.
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="980"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="group">
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon icon="mdi-set-merge" size="20" class="me-2" />
        <span class="text-subtitle-1 font-weight-bold">
          {{ t("cargo.flight.similar_title") }}
        </span>
        <v-chip size="x-small" variant="tonal" class="ms-2">
          {{ rows.length }}
        </v-chip>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <!--
        POR QUE estan juntos. Sin esto el dialogo es una lista sin criterio: la
        clave de agrupacion es aerolinea + escalas + banda de precio + franja de
        llegada, y decirlo evita que el operador sospeche que se le mezclan
        vuelos que no deberia.
      -->
      <div class="px-4 pb-2 text-caption text-medium-emphasis">
        {{ t("cargo.flight.similar_criteria") }}
      </div>
      <v-divider />

      <v-card-text class="pa-0">
        <div
          v-for="row in rows"
          :key="row.rate._rowKey"
          class="sf-row"
          :class="{ 'sf-row--active': row.rate._rowKey === selectedKey }"
          role="button"
          tabindex="0"
          @click="emit('detail', row.rate)"
          @keydown.enter="emit('detail', row.rate)"
        >
          <!-- ─── Carrier ─────────────────────────────────────────── -->
          <div class="sf-cell sf-cell--carrier">
            <AirlineLogo
              :code="row.rate.airline_code"
              :size="30"
              class="flex-0-0"
            />
            <div class="d-flex flex-column min-w-0">
              <div class="d-flex align-center ga-1 flex-wrap">
                <span class="text-subtitle-2 font-weight-bold">
                  {{ row.rate.airline_code || "—" }}
                </span>
                <!-- Cual de ellos es el que se ve en el listado. -->
                <v-chip
                  v-if="row.isLeader"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="sf-chip-mini"
                >
                  {{ t("cargo.flight.similar_leader") }}
                </v-chip>
              </div>
              <!-- Chip de fuente SIEMPRE, no solo cuando hay mezcla: la clave
                   de agrupacion (aerolinea|escalas|banda|franja) NO incluye la
                   fuente, asi que un grupo puede juntar una tarifa de catalogo
                   con una cotizacion reservable. Sin el chip no habia forma de
                   saber cual de las dos se estaba eligiendo. -->
              <div class="d-flex align-center ga-1 flex-wrap">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="sourceColorFor(String(row.rate.source))"
                  class="sf-chip-mini"
                >
                  {{ sourceShortLabel(String(row.rate.source)) }}
                </v-chip>
                <v-tooltip
                  v-if="isDirectBooking(row.rate.source)"
                  location="top"
                  :text="t('cargo.flight.direct_booking_icon_hint')"
                >
                  <template #activator="{ props: dbProps }">
                    <v-icon
                      v-bind="dbProps"
                      icon="mdi-lightning-bolt-circle"
                      size="14"
                      color="success"
                    />
                  </template>
                </v-tooltip>
              </div>
            </div>
          </div>

          <!-- ─── Vuelo / ruta / horarios ─────────────────────────── -->
          <div class="sf-cell sf-cell--flight">
            <div class="d-flex align-center ga-2 flex-wrap">
              <span
                v-if="flightLabelOf(row.rate)"
                class="text-body-2 font-weight-medium sf-route"
              >
                {{ flightLabelOf(row.rate) }}
              </span>
              <span
                v-if="row.rate.direct_flight"
                class="text-caption text-success"
              >
                <v-icon icon="mdi-airplane" size="12" />
                {{ t("cargo.flight.direct") }}
              </span>
              <!-- `plural`, no el numero crudo: el listado dice «2 escalas» y
                   aqui decia «2» a secas, para el mismo dato. -->
              <span
                v-else-if="row.rate.stopovers"
                class="text-caption text-medium-emphasis"
              >
                <v-icon icon="mdi-map-marker-path" size="12" />
                {{ plural("cargo.flight.stops_n", Number(row.rate.stopovers)) }}
              </span>
            </div>
            <div
              v-if="
                row.rate.departure || row.rate.arrival || row.rate.transit_hours
              "
              class="d-flex align-center ga-2 flex-wrap text-caption text-medium-emphasis"
            >
              <span v-if="row.rate.departure">
                <v-icon icon="mdi-airplane-takeoff" size="12" />
                {{ formatFlightDateTime(String(row.rate.departure)) }}
              </span>
              <span v-if="row.rate.arrival">
                <v-icon icon="mdi-airplane-landing" size="12" />
                {{ formatFlightDateTime(String(row.rate.arrival)) }}
              </span>
              <span v-if="row.rate.transit_hours">
                <v-icon icon="mdi-clock-outline" size="12" />
                {{ formatTransitHours(row.rate.transit_hours) }}
              </span>
            </div>
            <!-- Igual que el listado: si no hay horarios se dice por que, en
                 vez de dejar el hueco. Las tarifas de catalogo no llevan vuelo
                 asignado. -->
            <v-tooltip
              v-else
              location="top"
              :text="
                isDirectBooking(row.rate.source)
                  ? t('cargo.flight.times_unknown')
                  : t('cargo.flight.times_catalogue_hint')
              "
            >
              <template #activator="{ props: nsProps }">
                <span
                  v-bind="nsProps"
                  class="text-caption text-disabled sf-help"
                >
                  <v-icon icon="mdi-clock-outline" size="12" /> —
                </span>
              </template>
            </v-tooltip>
          </div>

          <!-- ─── Precio ──────────────────────────────────────────── -->
          <div class="sf-cell sf-cell--price">
            <!-- `price_incomplete` se respeta: KLM devuelve 0.00 en lo que no
                 se puede comprar, y pintarlo como «EUR 0.00» lo hacia parecer
                 gratis — justo el error contrario al que interesa. -->
            <span
              v-if="row.rate.price_incomplete"
              class="text-body-2 text-medium-emphasis"
            >
              {{ t("cargo.flight.no_price") }}
            </span>
            <template v-else>
              <span
                class="text-body-1 font-weight-bold"
                :class="row.isCheapest ? 'text-success' : ''"
              >
                {{
                  formatRateAmount(row.rate._client_price_n, row.rate._currency)
                }}
              </span>
              <!-- El mas barato del grupo se marca: es la razon por la que
                   merece la pena abrirlo. -->
              <span
                v-if="row.isCheapest"
                class="text-caption text-success d-flex align-center ga-1"
              >
                <v-icon icon="mdi-tag-outline" size="12" />
                {{ t("cargo.flight.similar_cheapest") }}
              </span>
            </template>
          </div>

          <!-- ─── Acciones ────────────────────────────────────────── -->
          <div class="sf-cell sf-cell--actions">
            <!-- Detalle explicito: antes solo se llegaba pulsando la fila, que
                 no se anunciaba por ningun sitio. -->
            <v-btn
              size="small"
              variant="text"
              icon="mdi-information-outline"
              :title="t('cargo.flight.detail')"
              @click.stop="emit('detail', row.rate)"
            />
            <!-- Sin relleno mientras NO esta seleccionado, igual que en el
                 listado: son la misma accion y deben verse igual. -->
            <v-btn
              size="small"
              :variant="row.rate._rowKey === selectedKey ? 'flat' : 'text'"
              :color="row.rate._rowKey === selectedKey ? 'primary' : undefined"
              prepend-icon="mdi-check"
              @click.stop="emit('select', row.rate)"
            >
              {{
                row.rate._rowKey === selectedKey
                  ? t("cargo.flight.selected_short")
                  : t("cargo.flight.action_select")
              }}
            </v-btn>
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-2">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t("common.close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AirlineLogo from "../AirlineLogo.vue";
import {
  flightLabelOf,
  formatFlightDateTime,
  formatTransitHours,
  formatRateAmount,
  sourceColorFor,
  sourceShortLabel,
  isDirectBooking,
  type NormalizedRate,
  type RateGroup,
} from "@cargo/services/flight_search.service";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  group: RateGroup | null;
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "select", rate: NormalizedRate): void;
  (e: "detail", rate: NormalizedRate): void;
}>();

/**
 * Forma plural con el contador tambien disponible como `{n}`.
 *
 * `t(key, n, named)` existe en vue-i18n pero su tipado no expone ese overload,
 * asi que se envuelve aqui igual que en el listado.
 */
function plural(key: string, n: number): string {
  return t(key, { n, count: n, plural: n }, n);
}

/**
 * El lider VA INCLUIDO en la lista, el primero.
 *
 * Es el que el operador acaba de ver en el listado; abrir el grupo y no
 * encontrarlo obligaria a recordarlo de memoria para compararlo con los demas,
 * que es justamente lo que este dialogo existe para evitar.
 */
const rows = computed(() => {
  const g = props.group;
  if (!g) return [];
  const all = [
    { rate: g.leader, isLeader: true },
    ...g.members.map((m) => ({ rate: m, isLeader: false })),
  ];

  /* `> 0` y sin `price_incomplete`: KLM devuelve 0.00 en las opciones NO
     reservables, y tomarlas por las mas baratas marcaria como chollo una
     tarifa que no se puede comprar. */
  let best = Infinity;
  for (const r of all) {
    const p = r.rate._client_price_n;
    if (p > 0 && !r.rate.price_incomplete && p < best) best = p;
  }

  return all.map((r) => ({
    ...r,
    isCheapest:
      best !== Infinity &&
      r.rate._client_price_n === best &&
      !r.rate.price_incomplete,
  }));
});
</script>

<style scoped lang="scss">
/* Rejilla, no `flex-wrap`: con flex cada fila colocaba sus datos donde le
   tocaba segun que campos trajera, asi que ninguna columna coincidia con la de
   la fila de arriba. Los anchos replican los del listado (carrier 220 / precio
   190 / acciones 150) para que saltar de una vista a otra no obligue a buscar
   de nuevo cada dato. */
.sf-row {
  display: grid;
  grid-template-columns: 220px 1fr 190px 150px;
  gap: 12px;
  align-items: start;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}
/* Zebra + hover, como el listado. Antes el unico estilo era `cursor:pointer`,
   asi que las filas se fundian entre si. */
.sf-row:nth-child(odd) {
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.sf-row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
.sf-row--active {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}
.sf-cell {
  display: flex;
  min-width: 0;
  overflow: hidden;
}
.sf-cell--carrier {
  align-items: flex-start;
  gap: 8px;
}
.sf-cell--flight {
  flex-direction: column;
  gap: 2px;
}
.sf-cell--price {
  flex-direction: column;
  align-items: flex-end;
  text-align: end;
}
.sf-cell--actions {
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.sf-route {
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.sf-chip-mini {
  height: 15px;
  font-size: 9px;
  padding-inline: 5px;
  letter-spacing: 0.03em;
}
.sf-help {
  cursor: help;
}
.min-w-0 {
  min-width: 0;
}
/* Interlineado propio, como en el listado: el 1.5 de Vuetify separa demasiado
   dos lineas seguidas de text-caption. */
.sf-cell :deep(.text-caption) {
  line-height: 1.45;
}
/* En pantallas estrechas la rejilla de 4 columnas no cabe: se apila y las
   acciones pasan a la izquierda para quedar alcanzables. */
@media (max-width: 860px) {
  .sf-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .sf-cell--price,
  .sf-cell--actions {
    align-items: flex-start;
    justify-content: flex-start;
    text-align: start;
  }
}
</style>
