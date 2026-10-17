<template>
  <AppDialog
    :open="modelValue && !!rate"
    :title="rate ? rate.airline_code : ''"
    icon="mdi-airplane"
    size="md"
    @close="close"
  >
    <template v-if="rate">
      <!-- Header band -->
      <div
        :style="{
          background:
            rate.source === 'realtime'
              ? 'linear-gradient(135deg,#2E7D32 0%,#43A047 100%)'
              : 'linear-gradient(135deg,#1565C0 0%,#1E88E5 100%)',
          padding: '14px 20px',
          color: 'white',
          borderRadius: '8px',
        }"
        class="mb-4"
      >
        <div class="d-flex align-center">
          <div class="flex-grow-1">
            <div class="d-flex align-center ga-2">
              <span class="text-h6 font-weight-bold" style="color: white">{{
                rate.airline_code
              }}</span>
              <span
                v-if="
                  rate.airline_name && rate.airline_name !== rate.airline_code
                "
                class="text-body-2"
                style="color: rgba(255, 255, 255, 0.9)"
              >
                {{ rate.airline_name }}
              </span>
              <v-chip
                size="x-small"
                variant="flat"
                color="white"
                :style="{
                  color: rate.source === 'realtime' ? '#1B5E20' : '#0D47A1',
                }"
              >
                {{ sourceLabel }}
              </v-chip>
              <v-chip
                v-if="rate._promotional"
                size="x-small"
                variant="flat"
                color="amber-lighten-4"
                style="color: #7c5800"
              >
                <v-icon icon="mdi-tag" size="12" class="me-1" />
                {{ t("cargo.flight.promo") }}
              </v-chip>
            </div>
            <div
              class="text-body-2 mt-1"
              style="color: rgba(255, 255, 255, 0.85)"
            >
              {{ routeSummary }}
              <span v-if="rate._product_name" class="ms-2"
                >· {{ rate._product_name }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Price summary -->
      <div class="d-flex align-center justify-space-between mb-3">
        <div>
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.flight.client_price") }}
          </div>
          <div class="text-h6 font-weight-bold">
            {{ formatRateAmount(rate._client_price_n, rate._currency) }}
          </div>
        </div>
        <div
          v-if="rate._cost_n && rate._cost_n !== rate._client_price_n"
          class="text-end"
        >
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.flight.cost_supplier") }}
          </div>
          <div class="text-body-1 font-weight-medium" style="color: #e65100">
            {{ formatRateAmount(rate._cost_n, rate._currency) }}
          </div>
        </div>
        <div v-if="margin !== null" class="text-end">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.costi.margin") }}
          </div>
          <div class="text-body-1 font-weight-medium" style="color: #2e7d32">
            {{ formatRateAmount(margin, rate._currency) }}
          </div>
        </div>
      </div>

      <v-divider class="mb-3" />

      <!-- Routing / segments — SOLO para fuentes que asignan vuelo.
           Una tarifa de catalogo (`published` / `klm`) no tiene tramos porque
           no tiene vuelo: es un precio de contrato. Pintar aqui la seccion con
           un "sin detalle" hacia creer que el dato faltaba en ESA tarifa, en vez
           de que por esa via no llega nunca. -->
      <template v-if="isBookingKind">
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-airplane" size="16" class="me-1" />
          {{ t("cargo.flight.segments") }} ({{ segments.length || "—" }})
        </div>
        <v-list
          v-if="segments.length"
          density="compact"
          class="rounded border mb-3"
          lines="two"
        >
          <v-list-item v-for="(seg, idx) in segments" :key="idx">
            <template #prepend>
              <v-avatar size="26" color="primary" variant="tonal">
                <span class="text-caption">{{ idx + 1 }}</span>
              </v-avatar>
            </template>
            <v-list-item-title class="d-flex align-center ga-1">
              <strong>{{ seg.carrier }}{{ seg.flight_number ?? "" }}</strong>
              <span>·</span>
              <span>{{ seg.origin ?? "—" }}</span>
              <v-icon icon="mdi-arrow-right" size="14" />
              <span>{{ seg.destination ?? "—" }}</span>
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              <span v-if="seg.departure">{{
                formatDateTime(String(seg.departure))
              }}</span>
              <span v-if="seg.arrival">
                → {{ formatDateTime(String(seg.arrival)) }}</span
              >
              <span v-if="seg.vehicle" class="ms-2 text-medium-emphasis"
                >· {{ seg.vehicle }}</span
              >
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <!-- Aqui el vacio SI es informacion: la fuente asigna vuelo, luego que
             no haya tramos significa que esta tarifa concreta no los informo. -->
        <v-alert
          v-else
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("cargo.flight.no_segment_detail") }}
        </v-alert>
      </template>

      <!-- No reservable: el MOTIVO, no solo el hecho.
           KLM manda `quoteStatusReason` (SOLD_OUT…) en las quotes que rechaza.
           Sin esto el operador ve el boton apagado y no sabe si es cupo, ruta o
           un fallo nuestro. -->
      <v-alert
        v-if="notBookableReason"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ t("cargo.flight.not_bookable") }}:
        <strong>{{ notBookableReason }}</strong>
      </v-alert>

      <!-- Routing metrics -->
      <v-row dense>
        <v-col v-if="rate.direct_flight" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.routing')"
            :value="t('cargo.flight.direct')"
            color="success"
          />
        </v-col>
        <v-col v-else-if="rate.stopovers" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.stopovers')"
            :value="String(rate.stopovers)"
          />
        </v-col>
        <v-col v-if="rate.transit_hours" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.transit')"
            :value="formatTransit(Number(rate.transit_hours))"
          />
        </v-col>
        <v-col v-if="rate.valid_until" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.valid_until')"
            :value="formatDate(String(rate.valid_until))"
          />
        </v-col>
        <!-- Cut-off (latest acceptance). El de `klm_quote` lo dicta la
             aerolinea; el de `realtime` sale de un parametro que enviamos
             nosotros, asi que se marca como estimado en vez de presentar los
             dos como si fueran lo mismo. -->
        <v-col v-if="rate._last_acceptance" cols="6" sm="3">
          <Metric
            :label="
              rate._last_acceptance_estimated
                ? t('cargo.flight.cutoff_estimated')
                : t('cargo.flight.cutoff')
            "
            :value="formatDateTime(rate._last_acceptance)"
            :color="rate._last_acceptance_estimated ? undefined : 'warning'"
          />
        </v-col>
        <v-col v-if="rate.short_id" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.rate_id')"
            :value="String(rate.short_id)"
            mono
          />
        </v-col>
        <v-col v-if="rate.unique_code && !rate.short_id" cols="6" sm="3">
          <Metric
            :label="t('cargo.flight.unique_code')"
            :value="String(rate.unique_code).slice(0, 12)"
            mono
          />
        </v-col>
        <!-- Con qué cuenta se cotizó: propia o delegación de un partner. Al
             auditar un precio o antes de reservar hay que saberlo, porque la
             reserva tiene que ir por la MISMA credencial. -->
        <v-col v-if="accountLabel" cols="12" sm="6">
          <Metric
            :label="t('cargo.flight.quoted_with')"
            :value="accountLabel"
          />
        </v-col>
        <v-col v-if="rate._via.length" cols="12" sm="6">
          <Metric
            :label="t('cargo.flight.via')"
            :value="rate._via.join(' · ')"
          />
        </v-col>
      </v-row>

      <!-- Weight & rate breakdown (mainly realtime) -->
      <template v-if="hasWeights">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-weight-kilogram" size="16" class="me-1" />
          {{ t("cargo.flight.weight_rate") }}
        </div>
        <v-row dense>
          <v-col v-if="rate._chargeable_weight_n" cols="6" sm="3">
            <Metric
              :label="t('cargo.flight.weight_chargeable')"
              :value="`${rate._chargeable_weight_n.toFixed(1)} kg`"
            />
          </v-col>
          <v-col v-if="rate._actual_weight_n" cols="6" sm="3">
            <Metric
              :label="t('cargo.flight.weight_actual')"
              :value="`${rate._actual_weight_n.toFixed(1)} kg`"
            />
          </v-col>
          <v-col v-if="rate._volumetric_weight_n" cols="6" sm="3">
            <Metric
              :label="t('cargo.flight.weight_volum')"
              :value="`${rate._volumetric_weight_n.toFixed(1)} kg`"
            />
          </v-col>
          <v-col v-if="rate._rate_per_kg_n" cols="6" sm="3">
            <Metric
              :label="t('cargo.flight.rate_per_kg')"
              :value="formatRateAmount(rate._rate_per_kg_n, rate._currency)"
            />
          </v-col>
          <v-col v-if="rate._minimum_charge_n" cols="6" sm="3">
            <Metric
              :label="t('cargo.flight.min_charge')"
              :value="formatRateAmount(rate._minimum_charge_n, rate._currency)"
            />
          </v-col>
        </v-row>
      </template>

      <!-- Ventana de validez.
           Significa cosas MUY distintas segun la fuente: en una quote son ~15
           minutos (precio firme que caduca), en una tarifa de catalogo son dias
           o meses. De ahi la nota que acompaña al bloque en el primer caso. -->
      <template v-if="rate._valid_from || rate._valid_to">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-calendar-clock" size="16" class="me-1" />
          {{ t("cargo.flight.validity") }}
        </div>
        <v-row dense>
          <v-col v-if="rate._valid_from" cols="6" sm="4">
            <Metric
              :label="t('cargo.flight.from')"
              :value="formatDate(rate._valid_from)"
            />
          </v-col>
          <v-col v-if="rate._valid_to" cols="6" sm="4">
            <Metric
              :label="t('cargo.flight.to')"
              :value="formatDate(rate._valid_to)"
            />
          </v-col>
        </v-row>
        <div
          v-if="isBookingKind"
          class="text-caption text-medium-emphasis mt-1"
        >
          {{ t("cargo.flight.validity_firm_hint") }}
        </div>
      </template>

      <!-- Realtime extras -->
      <template v-if="isRealtime && (rate._service_type || rate._notes)">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-information-outline" size="16" class="me-1" />
          {{ t("cargo.flight.realtime_details") }}
        </div>
        <v-row dense>
          <v-col v-if="rate._service_type" cols="12" sm="6">
            <Metric
              :label="t('cargo.flight.service')"
              :value="rate._service_type"
            />
          </v-col>
        </v-row>
        <div v-if="rate._notes" class="text-caption text-medium-emphasis mt-2">
          <v-icon icon="mdi-note-text-outline" size="12" class="me-1" />
          {{ rate._notes }}
        </div>
      </template>

      <!-- Surcharges (when present) -->
      <template v-if="surchargeItems.length">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-cash-multiple" size="16" class="me-1" />
          {{ t("cargo.flight.surcharges") }}
        </div>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t("cargo.col.code") }}</th>
              <th>{{ t("cargo.col.description") }}</th>
              <th class="text-end">{{ t("cargo.wcb.col_amount") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, idx) in surchargeItems" :key="idx">
              <td class="text-caption">{{ s.code }}</td>
              <td class="text-caption">{{ s.name }}</td>
              <td class="text-caption text-end">
                {{ formatRateAmount(s.amount, s.currency) }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </template>

    <template #actions>
      <v-btn variant="text" @click="close">{{ t("common.close") }}</v-btn>
      <v-spacer />
      <v-btn
        v-if="rate && !readonly"
        color="primary"
        variant="flat"
        prepend-icon="mdi-arrow-right"
        :loading="saving"
        @click="emit('confirm', rate)"
      >
        {{ t("cargo.flight.select_rate") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import {
  kindOf,
  segmentsFromRate,
  routeEndpoints,
  formatFlightDateTime,
  formatTransitHours,
  formatRateAmount,
  type NormalizedRate,
} from "@cargo/services/flight_search.service";

const { t } = useI18n();
const props = defineProps<{
  modelValue: boolean;
  rate: NormalizedRate | null;
  saving: boolean;
  /**
   * Solo consulta: oculta "Seleccionar tarifa".
   *
   * Se usa al mirar el rate YA asociado a la expedición desde la ficha, donde
   * ofrecer "seleccionar" no significa nada —ya está seleccionado— e invita a
   * repetir una operación de estado. Por defecto false, que es el uso desde
   * los resultados de búsqueda.
   */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm", rate: NormalizedRate): void;
}>();

function close(): void {
  emit("update:modelValue", false);
}

const sourceLabel = computed(() => {
  if (!props.rate) return "";
  if (props.rate.source === "realtime") return "REALTIME";
  if (props.rate.source === "express") return "EXPRESS";
  return "PUBLISHED";
});

/**
 * ¿La fuente asigna un VUELO concreto (`realtime`, `klm_quote`) o es una tarifa
 * de catalogo (`published`, `klm`)?
 *
 * Es la distincion que gobierna que secciones EXISTEN, en vez de decidirlo
 * campo a campo. Un catalogo no tiene tramos ni horarios porque no tiene vuelo
 * asignado — no porque falte el dato en esa tarifa. Mostrando la seccion vacia,
 * el operador no podia distinguir "la aerolinea no lo informo" de "por aqui no
 * viene nunca".
 */
const isBookingKind = computed(
  () => !!props.rate && kindOf(props.rate.source) === "direct_booking",
);

const notBookableReason = computed(
  () => props.rate?._not_bookable_reason ?? "",
);

const segments = computed(() =>
  props.rate ? segmentsFromRate(props.rate) : [],
);

/* Mismo helper que el wizard: una tarifa sin segmentos resolubles mostraba
   "? → ?" en vez de la ruta, que en WebCargo realtime esta disponible pero
   anidada dentro de `connection.connectionSegments.segment[]`. */
const routeSummary = computed<string>(() => {
  if (!props.rate) return "";
  const { origin, destination } = routeEndpoints(props.rate);
  if (!origin && !destination) return "—";
  return `${origin || "—"} → ${destination || "—"}`;
});

const margin = computed<number | null>(() => {
  const r = props.rate;
  if (!r) return null;
  const m = r._client_price_n - r._cost_n;
  if (!r._client_price_n || !r._cost_n || m === 0) return null;
  return m;
});

const surchargeItems = computed(() => props.rate?._surcharges_n ?? []);

const isRealtime = computed(() => props.rate?.source === "realtime");

/**
 * Cuenta con la que se cotizó, en texto legible.
 *
 * El backend manda `account_ref` ({source, ref_id, label}) y el par
 * consultable `credential_source`/`credential_id`. Aquí se usa el `label`,
 * que ya viene formado por quien resolvió la credencial ("deleg AV4939/DQ5108
 * (NL)", "direct 3847024/0012 (IT)", "urn 215292"), en vez de recomponerlo:
 * duplicar ese formato en el front lo dejaría divergiendo del backend.
 */
const accountLabel = computed<string>(() => {
  const r = props.rate as
    | {
        account_owner?: {
          partner_name?: string | null;
          is_house?: boolean;
          relationship?: string | null;
        } | null;
        account_ref?: { label?: string } | string | null;
      }
    | null;

  // Nombre del partner primero: "123Logistix.com B.V." dice de quién es la
  // cuenta, que es la pregunta real; "deleg AV4939/DQ5108 (NL)" identifica la
  // credencial pero obliga a saberse los códigos de memoria.
  const owner = r?.account_owner;
  if (owner?.is_house) return t("cargo.flight.account_house");
  if (owner?.partner_name) {
    // La delegación se marca: cotizar EN NOMBRE DE un partner no es lo mismo
    // que usar una credencial propia, y de eso depende quién factura.
    return owner.relationship === "represented_partner"
      ? t("cargo.flight.account_delegated", { partner: owner.partner_name })
      : owner.partner_name;
  }

  // Sin dueño resuelto se cae al label crudo: peor, pero mejor que nada.
  const ref = r?.account_ref;
  if (!ref) return "";
  if (typeof ref === "string") {
    try {
      return (JSON.parse(ref) as { label?: string }).label ?? "";
    } catch {
      return "";
    }
  }
  return ref.label ?? "";
});
const hasWeights = computed(() => {
  const r = props.rate;
  if (!r) return false;
  return !!(
    r._chargeable_weight_n ||
    r._actual_weight_n ||
    r._volumetric_weight_n ||
    r._rate_per_kg_n
  );
});

const formatDateTime = formatFlightDateTime;
/* OJO: este `formatDate` NO es el del listado — lleva el año (dd/mm/yyyy)
   porque aqui se usa para la validez de la tarifa, donde el año importa. Por
   eso se queda local y no sube al servicio compartido. */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
}
const formatTransit = formatTransitHours;

// Inline metric tile component (kept local to avoid yet another file).
const Metric = (mProps: {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
}) =>
  h("div", { class: "metric-tile" }, [
    h("div", { class: "text-caption text-medium-emphasis" }, mProps.label),
    h(
      "div",
      {
        class: [
          "text-body-2",
          "font-weight-medium",
          mProps.mono ? "metric-mono" : "",
        ],
        style: mProps.color ? { color: `var(--v-theme-${mProps.color})` } : {},
      },
      mProps.value,
    ),
  ]);
</script>

<style scoped>
.metric-tile {
  padding: 6px 0;
}
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
