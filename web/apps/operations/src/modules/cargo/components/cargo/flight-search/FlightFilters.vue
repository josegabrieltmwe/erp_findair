<template>
  <!--
    Trigger row. The panel used to sit expanded inside the modal, costing ~200px
    of a viewport where height is the scarce resource — 13 filter criteria taking
    permanent space for an occasional adjustment.

    A drawer OVERLAYS instead of pushing, so the table never reflows when it
    opens, the sliders get full height, and the operator can watch the table
    change while tuning. A dropdown was the other option but does not scale to
    13 controls, several of them range sliders and chip multiselects: it becomes
    a modal inside the modal, with its own scroll.
  -->
  <div class="filters-bar d-flex align-center ga-2 mb-2">
    <!--
      Ningun campo de filtrado aqui: todos viven en el drawer, que es el unico
      lugar donde se filtra. Sobre la tabla quedan solo el acceso al drawer con
      su contador, el reset y el recuento.
    -->
    <v-btn
      size="small"
      variant="tonal"
      :color="activeFilterCount > 0 ? 'primary' : undefined"
      prepend-icon="mdi-filter-variant"
      @click="drawer = true"
    >
      {{ t("cargo.flight.filters") }}
      <!-- The COUNT, not a dot: "3" says how much is being filtered, a dot only
           says that something is. Hidden at zero to keep the normal case quiet. -->
      <v-badge
        v-if="activeFilterCount > 0"
        :content="activeFilterCount"
        color="primary"
        inline
      />
    </v-btn>

    <!-- One-click reset without opening the drawer. Previously the panel had to
         be expanded just to clear filters. -->
    <v-tooltip
      v-if="activeFilterCount > 0"
      location="top"
      :text="t('cargo.flight.filters_reset')"
    >
      <template #activator="{ props: rp }">
        <v-btn
          v-bind="rp"
          size="x-small"
          variant="text"
          color="error"
          icon="mdi-close-circle-outline"
          @click="resetAll"
        />
      </template>
    </v-tooltip>

    <span class="text-caption text-medium-emphasis">
      {{
        t("cargo.flight.filtered_count", {
          shown: filteredCount,
          total: rates.length,
        })
      }}
    </span>
  </div>

  <!--
    Mismo componente de chips que los listados del ERP: hace visible que hay un
    filtro puesto y permite quitarlo de uno en uno, sin abrir el drawer.
  -->
  <ActiveFilterChips
    :filters="activeFilterChips"
    class="mb-2"
    @remove="removeFilter"
    @clear="resetAll"
  />

  <!--
    v-dialog, not v-navigation-drawer. A navigation drawer anchors itself to the
    application layout, so inside a modal it docked to the page edge and showed
    up on load instead of on demand. A right-anchored dialog gives the same
    side-panel behaviour while staying scoped to the modal that opened it.
  -->
  <v-dialog
    v-model="drawer"
    :width="400"
    scrim
    transition="slide-x-reverse-transition"
    content-class="filters-dialog-right"
  >
    <v-card class="filters-drawer" flat>
      <div class="d-flex align-center pa-3 pb-1">
        <v-icon icon="mdi-filter-variant" size="18" class="me-2" />
        <span class="text-subtitle-2">{{ t("cargo.flight.filters") }}</span>
        <v-spacer />
        <v-btn
          v-if="activeFilterCount > 0"
          size="x-small"
          variant="text"
          color="error"
          prepend-icon="mdi-close"
          @click="resetAll"
        >
          {{ t("cargo.flight.filters_reset") }}
        </v-btn>
        <v-btn
          size="x-small"
          variant="text"
          icon="mdi-close"
          @click="drawer = false"
        />
      </div>
      <v-divider />
      <div class="pa-3">
        <!-- ===== Common filters ===== -->
        <FormSection
          :title="t('cargo.flight.fsec_carriers')"
          icon="mdi-airplane"
          flat
        >
          <v-select
            :model-value="modelValue.carriers"
            :items="availableCarriers"
            :label="t('cargo.offers.carriers')"
            density="compact"
            multiple
            chips
            closable-chips
            clearable
            prepend-inner-icon="mdi-airplane"
            hide-details
            @update:model-value="patch('carriers', $event as string[])"
          />
          <!--
            Two orthogonal axes, not one feed list. The operator picks WHO
            (carrier system) and HOW (bookable vs catalogue); which internal
            feed produced the row is our concern, not theirs.
          -->
          <v-select
            :model-value="modelValue.providers"
            :items="providerOptions"
            :label="t('cargo.flight.provider')"
            density="compact"
            multiple
            chips
            closable-chips
            clearable
            prepend-inner-icon="mdi-domain"
            hide-details
            @update:model-value="
              patch('providers', $event as FlightRateProvider[])
            "
          />
          <v-select
            :model-value="modelValue.kinds"
            :items="kindOptions"
            :label="t('cargo.flight.kind')"
            density="compact"
            multiple
            chips
            closable-chips
            clearable
            prepend-inner-icon="mdi-lightning-bolt"
            hide-details
            @update:model-value="patch('kinds', $event as FlightRateKind[])"
          />
        </FormSection>
        <FormSection
          :title="t('cargo.flight.fsec_route')"
          icon="mdi-map-marker-path"
          flat
        >
          <v-select
            :model-value="modelValue.maxStops"
            :items="stopsOptions"
            :label="t('cargo.flight.max_stops')"
            density="compact"
            clearable
            prepend-inner-icon="mdi-map-marker-path"
            hide-details
            @update:model-value="
              patch('maxStops', ($event as number | null) ?? null)
            "
          />
          <v-switch
            :model-value="modelValue.directOnly"
            :label="t('cargo.flight.only_direct')"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="patch('directOnly', Boolean($event))"
          />

          <!-- ===== Price range (common) ===== -->
          <div class="text-caption mb-1 text-medium-emphasis">
            {{ t("cargo.flight.client_price") }}
            {{ formatRange(modelValue.priceRange, priceBounds, 0) }}
            {{ commonCurrency }}
          </div>
          <v-range-slider
            :model-value="effectivePriceRange"
            :min="priceBounds[0]"
            :max="priceBounds[1]"
            :step="priceStep"
            density="compact"
            hide-details
            thumb-label
            color="primary"
            :disabled="!priceBoundsValid"
            @update:model-value="
              patch('priceRange', $event as [number, number])
            "
          />

          <!-- ===== Transit max (mostly realtime) ===== -->
          <div class="text-caption mb-1 text-medium-emphasis">
            {{
              t("cargo.flight.transit_max_v", {
                v: modelValue.maxTransitHours ?? "—",
              })
            }}
            <span v-if="!hasTransitData" class="ms-1 text-disabled">
              {{ t("cargo.flight.no_realtime") }}
            </span>
          </div>
          <v-slider
            :model-value="modelValue.maxTransitHours ?? transitBounds[1]"
            :min="transitBounds[0]"
            :max="transitBounds[1]"
            step="1"
            density="compact"
            hide-details
            thumb-label
            color="primary"
            :disabled="!hasTransitData"
            @update:model-value="
              patch('maxTransitHours', Math.round($event as number))
            "
          />

          <!-- ===== Realtime-only toggles ===== -->
          <div class="text-caption text-medium-emphasis mb-1">
            <v-icon
              icon="mdi-lightning-bolt"
              size="14"
              color="success"
              class="me-1"
            />
            {{ t("cargo.flight.fsec_realtime") }}
          </div>
        </FormSection>
        <FormSection
          :title="t('cargo.flight.fsec_price')"
          icon="mdi-currency-eur"
          flat
        >
          <div class="d-flex flex-wrap ga-3">
            <v-switch
              :model-value="modelValue.promotionalOnly"
              :label="t('cargo.flight.only_promo')"
              color="success"
              density="compact"
              hide-details
              @update:model-value="patch('promotionalOnly', Boolean($event))"
            />
            <v-switch
              :model-value="modelValue.validNow"
              :label="t('cargo.flight.valid_today')"
              color="primary"
              density="compact"
              hide-details
              @update:model-value="patch('validNow', Boolean($event))"
            />
            <v-select
              :model-value="modelValue.products"
              :items="availableProducts"
              :label="t('cargo.flight.product')"
              density="compact"
              multiple
              chips
              closable-chips
              clearable
              prepend-inner-icon="mdi-package-variant"
              hide-details
              style="min-width: 220px"
              @update:model-value="patch('products', $event as string[])"
            />
            <v-select
              :model-value="modelValue.serviceTypes"
              :items="availableServiceTypes"
              :label="t('cargo.flight.service')"
              density="compact"
              multiple
              chips
              closable-chips
              clearable
              prepend-inner-icon="mdi-tag-outline"
              hide-details
              style="min-width: 220px"
              @update:model-value="patch('serviceTypes', $event as string[])"
            />
          </div>
        </FormSection>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import type { ActiveFilter } from "@shared/listing/types";
import { computed, ref, watch } from "vue";
import type {
  NormalizedRate,
  FlightRateSource,
  FlightRateProvider,
  FlightRateKind,
  FlightFiltersModel,
} from "@cargo/services/flight_search.service";
import {
  emptyFilters,
  matchesFilters,
  filterToday,
  providerOf,
} from "@cargo/services/flight_search.service";

// El modelo vive en el service (lo consumen tambien el composable y el
// listado). Se reexporta para no romper a quien ya lo importaba de aqui.
export type { FlightFiltersModel };

const { t } = useI18n();
const props = defineProps<{
  modelValue: FlightFiltersModel;
  rates: NormalizedRate[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: FlightFiltersModel): void;
}>();

// Drawer closed by default: filtering is an occasional adjustment, not the
// resting state of the screen.
const drawer = ref(false);

function patch<K extends keyof FlightFiltersModel>(
  key: K,
  value: FlightFiltersModel[K],
): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

const availableCarriers = computed<string[]>(() => {
  const set = new Set<string>();
  for (const r of props.rates) if (r.airline_code) set.add(r.airline_code);
  return Array.from(set).sort();
});

// Kept: some callers still filter by raw feed, and the legacy `sources`
// model field is still honoured downstream.
const sourceOptions = computed(() => [
  {
    title: t("cargo.flight.src_wc_quote"),
    value: "realtime" as FlightRateSource,
  },
  {
    title: t("cargo.flight.src_wc_rates"),
    value: "published" as FlightRateSource,
  },
  { title: t("cargo.flight.src_klm_rates"), value: "klm" as FlightRateSource },
  {
    title: t("cargo.flight.src_klm_quote"),
    value: "klm_quote" as FlightRateSource,
  },
  {
    title: t("cargo.flight.src_express"),
    value: "express" as FlightRateSource,
  },
]);

// WHO: the carrier system behind the rate.
/**
 * Proveedores DERIVADOS de los resultados, no una lista fija.
 *
 * Estaba hardcodeado a tres entradas, asi que ofrecia filtrar por KLM en una
 * busqueda que solo habia devuelto WebCargo: elegirlo vaciaba la tabla y
 * parecia un fallo. Misma estrategia que `availableCarriers`.
 */
const PROVIDER_TITLES: Record<string, string> = {
  klm: "KLM/AF",
  webcargo: "WebCargo",
};
const providerOptions = computed(() => {
  const present = new Set(props.rates.map((r) => providerOf(r.source)));
  return [...present].sort().map((value) => ({
    value: value as FlightRateProvider,
    title:
      PROVIDER_TITLES[value] ??
      (value === "express" ? t("cargo.flight.src_express") : String(value)),
  }));
});

// HOW: what the operator can do with it. Direct booking is a firm price with a
// real routing that expires; published is a season tariff with no flight.
const kindOptions = computed(() => [
  {
    title: t("cargo.flight.kind_direct"),
    value: "direct_booking" as FlightRateKind,
  },
  {
    title: t("cargo.flight.kind_published"),
    value: "published" as FlightRateKind,
  },
]);

const stopsOptions = computed(() => [
  { title: t("cargo.flight.stops_direct"), value: 0 },
  { title: t("cargo.flight.stops_max1"), value: 1 },
  { title: t("cargo.flight.stops_max2"), value: 2 },
]);

const hasRealtime = computed(() =>
  props.rates.some((r) => r.source === "realtime"),
);

const availableProducts = computed<string[]>(() => {
  const set = new Set<string>();
  for (const r of props.rates) if (r._product_name) set.add(r._product_name);
  return Array.from(set).sort();
});

const availableServiceTypes = computed<string[]>(() => {
  const set = new Set<string>();
  for (const r of props.rates) if (r._service_type) set.add(r._service_type);
  return Array.from(set).sort();
});

const commonCurrency = computed<string>(() => {
  const first = props.rates.find((r) => r._currency)?._currency ?? "EUR";
  return first;
});

const priceBounds = computed<[number, number]>(() => {
  if (!props.rates.length) return [0, 0];
  let min = Infinity;
  let max = -Infinity;
  for (const r of props.rates) {
    const v = r._client_price_n;
    if (v <= 0) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
  return [Math.floor(min), Math.ceil(max)];
});

const priceBoundsValid = computed(
  () => priceBounds.value[1] > priceBounds.value[0],
);
const priceStep = computed(() => {
  const [lo, hi] = priceBounds.value;
  const span = hi - lo;
  if (span <= 50) return 1;
  if (span <= 500) return 5;
  return 10;
});

const effectivePriceRange = computed<[number, number]>(
  () => props.modelValue.priceRange ?? priceBounds.value,
);

const transitBounds = computed<[number, number]>(() => {
  let min = Infinity;
  let max = -Infinity;
  for (const r of props.rates) {
    const v = Number(r.transit_hours ?? 0);
    if (!v) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 168];
  return [Math.floor(min), Math.ceil(max)];
});

const hasTransitData = computed(
  () => transitBounds.value[0] !== 0 || transitBounds.value[1] !== 168,
);

function formatRange(
  range: [number, number] | null,
  bounds: [number, number],
  digits: number,
): string {
  const r = range ?? bounds;
  return `${r[0].toFixed(digits)} – ${r[1].toFixed(digits)}`;
}

/**
 * How MANY criteria are active, not merely whether any is.
 *
 * The badge shows this number: "3" tells the operator how much of the result
 * set is being narrowed, while a plain dot only says that something is. With 13
 * possible criteria — several of them buried in the drawer — that difference
 * decides whether an unexpected result reads as "no rates" or as "I over-
 * filtered".
 */
const activeFilterCount = computed<number>(() => {
  const m = props.modelValue;
  let n = 0;
  n += m.carriers.length > 0 ? 1 : 0;
  n += m.sources.length > 0 ? 1 : 0;
  n += (m.providers?.length ?? 0) > 0 ? 1 : 0;
  n += (m.kinds?.length ?? 0) > 0 ? 1 : 0;
  n += m.products.length > 0 ? 1 : 0;
  n += m.serviceTypes.length > 0 ? 1 : 0;
  n += m.directOnly ? 1 : 0;
  n += m.promotionalOnly ? 1 : 0;
  n += m.validNow ? 1 : 0;
  n += m.maxStops !== null ? 1 : 0;
  n += m.priceRange !== null ? 1 : 0;
  n += m.maxTransitHours !== null ? 1 : 0;
  return n;
});

const hasActiveFilters = computed(() => {
  const m = props.modelValue;
  return (
    m.carriers.length > 0 ||
    m.sources.length > 0 ||
    m.directOnly ||
    m.maxStops !== null ||
    m.priceRange !== null ||
    m.maxTransitHours !== null ||
    m.promotionalOnly ||
    m.validNow ||
    m.products.length > 0 ||
    m.serviceTypes.length > 0 ||
    (m.providers?.length ?? 0) > 0 ||
    (m.kinds?.length ?? 0) > 0
  );
});

function resetAll(): void {
  emit("update:modelValue", emptyFilters());
}

// Auto-reset price range when bounds shift dramatically (new search).
watch(
  () => priceBounds.value.join("|"),
  () => {
    if (
      props.modelValue.priceRange &&
      (props.modelValue.priceRange[0] < priceBounds.value[0] ||
        props.modelValue.priceRange[1] > priceBounds.value[1])
    ) {
      patch("priceRange", null);
    }
  },
);

const filteredCount = computed<number>(() => {
  const f = props.modelValue;
  const today = filterToday();
  return props.rates.filter((r) => matchesFilters(r, f, today)).length;
});
/** Filtros activos como chips (patron estandar de listados). */
const activeFilterChips = computed<ActiveFilter[]>(() => {
  const f = props.modelValue;
  const out: ActiveFilter[] = [];
  for (const c of f.carriers) {
    out.push({
      field: `carrier:${c}`,
      group: t("cargo.offers.carriers"),
      value: c,
    });
  }
  for (const pr of f.providers) {
    const opt = providerOptions.value.find((o) => o.value === pr);
    out.push({
      field: `provider:${pr}`,
      group: t("cargo.flight.provider"),
      value: opt?.title ?? String(pr),
    });
  }
  return out;
});

/** Quita un solo chip. El resto de criterios sigue gestionandose en el drawer. */
function removeFilter(field: string): void {
  const [kind, raw] = field.split(":");
  if (kind === "carrier") {
    patch(
      "carriers",
      props.modelValue.carriers.filter((c) => c !== raw),
    );
  } else if (kind === "provider") {
    patch(
      "providers",
      props.modelValue.providers.filter((x) => String(x) !== raw),
    );
  }
}
</script>

<!--
  Unscoped on purpose: v-dialog teleports its content to the app root, outside
  this component's scope, so a scoped rule would never reach it.
-->
<style>
.filters-dialog-right {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  max-height: 100%;
  border-radius: 0;
}
</style>

<style scoped>
.filters-panel :deep(.v-expansion-panel-title) {
  min-height: 40px;
  padding: 4px 12px;
}
.filters-drawer {
  height: 100%;
  overflow-y: auto;
}
.filters-bar {
  min-height: 32px;
}
.filters-panel :deep(.v-expansion-panel-text__wrapper) {
  padding: 8px 12px 12px;
}
</style>
