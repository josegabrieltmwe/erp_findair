<template>
  <div class="selection-wizard">
    <!-- Header -->
    <div class="d-flex align-center ga-2 mb-4">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        size="small"
        :disabled="busy"
        @click="emit('back')"
      />
      <span class="text-body-1 font-weight-bold">{{
        t("cargo.wizard.title")
      }}</span>
      <v-spacer />
      <v-chip
        size="small"
        :color="confirmLevel === 1 ? 'primary' : 'success'"
        variant="tonal"
      >
        {{ t("cargo.flight.step_of", { n: confirmLevel, total: 2 }) }}
      </v-chip>
    </div>

    <!-- LEVEL 1 — side-by-side comparison -->
    <div class="compare-grid">
      <!-- Current rate (if any) -->
      <div v-if="currentRate" class="compare-card">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("cargo.wizard.current_flight") }}
        </div>
        <div class="d-flex align-center ga-2">
          <span class="font-weight-bold">{{
            currentRate.airline_code || "—"
          }}</span>
          <span
            v-if="
              currentRate.airline_name &&
              currentRate.airline_name !== currentRate.airline_code
            "
            class="text-caption text-medium-emphasis"
          >
            {{ currentRate.airline_name }}
          </span>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ currentRouteLabel }}
        </div>
        <div
          v-if="currentRate.transit_hours"
          class="text-caption text-medium-emphasis"
        >
          {{ t("cargo.flight.transit_label") }}:
          {{
            t("cargo.flight.hours_value", {
              v: Number(currentRate.transit_hours).toFixed(1),
            })
          }}
        </div>
        <div class="font-weight-bold mt-1">{{ currentPriceLabel }}</div>
      </div>
      <div v-else class="compare-card compare-card--empty">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("cargo.wizard.current_flight") }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ t("cargo.wizard.no_flight") }}
        </div>
      </div>

      <div class="compare-arrow">
        <v-icon icon="mdi-arrow-right-bold" size="22" color="primary" />
      </div>

      <!-- New rate -->
      <div class="compare-card compare-card--new">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("cargo.wizard.new_flight") }}
        </div>
        <div class="d-flex align-center ga-2">
          <span class="font-weight-bold">{{ rate.airline_code }}</span>
          <span
            v-if="rate.airline_name && rate.airline_name !== rate.airline_code"
            class="text-caption text-medium-emphasis"
          >
            {{ rate.airline_name }}
          </span>
          <!-- Mismo esquema que el listado (WC/WCQ/KL/KLQ/EX): una tarifa KLM
               se anunciaba aqui como "PUB" al confirmarla. -->
          <v-chip
            size="x-small"
            variant="flat"
            :color="sourceColorFor(rate.source)"
          >
            {{ sourceShortLabel(rate.source) }}
          </v-chip>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ newRouteLabel }}
        </div>
        <div
          v-if="rate.transit_hours"
          class="text-caption text-medium-emphasis"
        >
          {{ t("cargo.flight.transit_label") }}:
          {{
            t("cargo.flight.hours_value", {
              v: Number(rate.transit_hours).toFixed(1),
            })
          }}
        </div>
        <div class="font-weight-bold mt-1">{{ newPriceLabel }}</div>
      </div>
    </div>

    <!-- LEVEL 2 — final confirmation -->
    <v-expand-transition>
      <div v-if="confirmLevel >= 2" class="mt-4">
        <v-alert
          type="info"
          density="compact"
          variant="tonal"
          icon="mdi-information-outline"
          class="mb-3"
        >
          <strong>{{
            t("cargo.wizard.will_associate", { id: shipmentId })
          }}</strong
          ><br />
          <span class="text-caption">
            {{ t("cargo.wizard.no_booking_note") }}
          </span>
        </v-alert>

        <v-alert
          v-if="hasActiveBooking"
          type="warning"
          density="compact"
          variant="tonal"
          icon="mdi-alert"
          class="mb-3"
        >
          {{ t("cargo.wizard.active_booking_pre") }} (<span
            class="metric-mono"
            >{{ activeBookingId }}</span
          >)
          {{ t("cargo.wizard.active_booking_post") }}
        </v-alert>

        <v-checkbox
          v-model="confirmCheckbox"
          density="compact"
          color="primary"
          hide-details
          :disabled="busy"
        >
          <template #label>
            <span class="text-body-2">
              {{ t("cargo.wizard.confirm_pre") }}
              <strong>{{ rate.airline_code }}</strong>
              ({{ newRouteLabel }}) {{ t("cargo.wizard.confirm_at") }}
              <strong>{{ newPriceLabel }}</strong>
              {{ t("cargo.wizard.confirm_post") }}
            </span>
          </template>
        </v-checkbox>
      </div>
    </v-expand-transition>

    <v-alert
      v-if="errorMsg"
      type="error"
      density="compact"
      variant="tonal"
      class="mt-3"
    >
      {{ errorMsg }}
    </v-alert>

    <div v-if="busy" class="d-flex align-center justify-center mt-4 ga-2">
      <v-progress-circular indeterminate size="20" width="2" color="primary" />
      <span v-if="busyMessage" class="text-body-2">{{ busyMessage }}</span>
    </div>

    <!-- Actions row -->
    <div class="d-flex align-center mt-4">
      <v-btn variant="text" :disabled="busy" @click="emit('back')">
        {{ t("cargo.wizard.back_to_results") }}
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="confirmLevel === 1"
        color="primary"
        variant="flat"
        prepend-icon="mdi-arrow-right"
        @click="advance"
      >
        {{ t("cargo.wizard.continue") }}
      </v-btn>
      <v-btn
        v-else
        color="warning"
        variant="flat"
        prepend-icon="mdi-check-decagram"
        :loading="busy"
        :disabled="!confirmCheckbox || busy"
        @click="advance"
      >
        {{ t("cargo.wizard.confirm_assign") }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import {
  sourceShortLabel,
  sourceColorFor,
  routeEndpoints,
  formatRateAmount,
  type NormalizedRate,
} from "@cargo/services/flight_search.service";

const { t } = useI18n();
const props = defineProps<{
  rate: NormalizedRate;
  /** Snapshot of the rate currently associated with the cargo (if any).
   *  Built by the parent from cargo store (flight_num1, terminal_part/dest,
   *  carico_volo, etc.). */
  currentRate?: {
    airline_code?: string;
    airline_name?: string;
    origin?: string;
    destination?: string;
    transit_hours?: number;
    price?: number;
    currency?: string;
  } | null;
  shipmentId: number;
  hasActiveBooking: boolean;
  activeBookingId?: string | null;
  busy: boolean;
  busyMessage?: string;
  errorMsg?: string | null;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "confirm"): void;
}>();

const confirmLevel = ref<1 | 2>(1);
const confirmCheckbox = ref(false);

/**
 * Reiniciar el wizard SOLO si el operador eligió otro vuelo.
 *
 * Antes observaba `props.rate` — la REFERENCIA del objeto — y eso lo rompía:
 * la búsqueda por SSE sigue viva con el wizard abierto, y cuando llega una
 * actualización de la tarifa seleccionada el composable la sustituye
 * (`rates.value[existing] = n`) por un objeto NUEVO con el mismo vuelo. El
 * watcher se disparaba, volvía al paso 1 y desmarcaba la casilla.
 *
 * Con la casilla desmarcada, `advance()` sale sin emitir `confirm`: el wizard
 * se cierra, no sale ninguna petición y no hay ningún error. Es exactamente el
 * sintoma reportado — "hago click, cierra el wizard pero no persiste nada ni
 * envia peticion AJAX" — y por eso aparecía sobre todo con aerolíneas lentas:
 * su actualización llega al final del stream, cuando el operador ya está
 * confirmando.
 *
 * Observando el identificador del vuelo, un refresco del mismo vuelo no toca
 * el wizard y el precio se mantiene al día por debajo.
 */
watch(
  () => props.rate?.short_id ?? props.rate?._rowKey ?? null,
  (next, prev) => {
    if (next === prev) {
      return;
    }
    confirmLevel.value = 1;
    confirmCheckbox.value = false;
  },
);

function advance(): void {
  if (confirmLevel.value === 1) {
    confirmLevel.value = 2;
    return;
  }
  if (confirmCheckbox.value) {
    emit("confirm");
  }
}

/**
 * Ruta del vuelo YA asignado. Viene del store del cargo (terminal_part/dest),
 * no de un rate, asi que se lee tal cual — pero sin inventar "?" por un
 * extremo ausente: si solo se conoce uno, se muestra ese.
 */
const currentRouteLabel = computed<string>(() => {
  const c = props.currentRate;
  if (!c) return "—";
  const o = c.origin ?? "";
  const d = c.destination ?? "";
  if (!o && !d) return "—";
  return `${o || "—"} → ${d || "—"}`;
});

/**
 * Ruta del vuelo elegido.
 *
 * Antes leia `rate.origin` / `rate.destination` de la raiz, campos que no
 * existen en ninguna fuente: en WebCargo realtime el itinerario vive dentro de
 * `connection.connectionSegments.segment[]`, asi que el operador confirmaba la
 * asignacion viendo "? → ?" — justo en la pantalla donde hay que comprobar que
 * el vuelo es el correcto. `routeEndpoints` resuelve las cuatro formas.
 */
const newRouteLabel = computed<string>(() => {
  const { origin, destination } = routeEndpoints(props.rate);
  if (!origin && !destination) return "—";
  return `${origin || "—"} → ${destination || "—"}`;
});

const currentPriceLabel = computed<string>(() => {
  const c = props.currentRate;
  if (!c?.price) return "—";
  return formatRateAmount(c.price, c.currency);
});

const newPriceLabel = computed<string>(() => {
  const r = props.rate;
  return formatRateAmount(r._client_price_n, r._currency);
});
</script>

<style scoped>
.selection-wizard {
  padding: 8px 4px;
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: stretch;
}
.compare-card {
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
}
.compare-card--new {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary)) inset;
}
.compare-card--empty {
  border-style: dashed;
  opacity: 0.65;
}
.compare-arrow {
  display: grid;
  place-items: center;
}
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
