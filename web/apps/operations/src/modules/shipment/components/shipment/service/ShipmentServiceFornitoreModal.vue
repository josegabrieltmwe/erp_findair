<template>
  <AppDialog
    :open="open"
    :title="t('shipment.service.fornitore_title')"
    icon="mdi-truck-outline"
    :max-width="980"
    card-class="forn-modal"
    @close="emit('update:open', false)"
  >
    <!-- Toolbar: count chip, manual refresh and search. The dialog title +
           close X now come from AppDialog; the refresh action moves here. -->
    <div class="forn-modal__toolbar">
      <v-chip
        v-if="availableCount > 0"
        size="x-small"
        variant="tonal"
        color="primary"
        class="me-2"
      >
        {{ t("shipment.service.available_count", { count: availableCount }) }}
      </v-chip>
      <v-text-field
        v-model="query"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        :placeholder="t('shipment.service.search_fornitore_placeholder')"
        prepend-inner-icon="mdi-magnify"
        class="forn-modal__search"
      />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        size="small"
        density="comfortable"
        :loading="store.loadingFornitore"
        :title="t('common.refresh')"
        class="ms-2"
        @click="load(true)"
      />
    </div>

    <!-- Servicio económico (id_servforn_eco): id del servicio de courier más
         barato retenido para recálculos. En el legacy es un campo numérico
         simple (spedy_form Cmp("id_servforn_eco")), fijado normalmente al
         insertar desde B2B. Editable aquí para paridad; se persiste on-blur. -->
    <div class="forn-modal__eco">
      <v-text-field
        v-model="ecoService.local"
        type="number"
        min="0"
        density="compact"
        variant="outlined"
        hide-details
        :label="t('shipment.service.economic_service')"
        prepend-inner-icon="mdi-tag-arrow-down-outline"
        class="forn-modal__eco-field"
        @blur="ecoService.commit"
      />
    </div>

    <v-divider class="mb-2" />

    <!-- Body -->
    <div class="forn-modal__body">
      <v-skeleton-loader
        v-if="store.loadingFornitore && !store.fornitoreServices.length"
        type="table-row@8"
      />

      <v-alert
        v-else-if="store.error"
        type="error"
        variant="tonal"
        class="mb-2"
      >
        {{ store.error }}
      </v-alert>

      <EmptyState
        v-else-if="!store.fornitoreServices.length"
        icon="mdi-truck-remove-outline"
        :title="t('shipment.service.fornitore_empty_title')"
        :text="t('shipment.service.fornitore_empty_text')"
      />

      <template v-else>
        <!-- AVAILABLE -->
        <v-table
          v-if="availableRows.length"
          density="compact"
          class="forn-table"
          :class="{ 'forn-table--filtered': query.length > 0 }"
        >
          <thead>
            <tr>
              <th
                class="forn-th--svc forn-th--sortable"
                :class="sortClass('svc')"
                @click="toggleSort('svc')"
              >
                {{ t("shipment.service.cols.service") }}
                <v-icon
                  :icon="sortIcon('svc')"
                  size="12"
                  class="forn-sort-icon"
                />
              </th>
              <th
                class="forn-th--del forn-th--sortable"
                :class="sortClass('del')"
                @click="toggleSort('del')"
              >
                {{ t("shipment.service.cols.delivery") }}
                <v-icon
                  :icon="sortIcon('del')"
                  size="12"
                  class="forn-sort-icon"
                />
              </th>
              <th
                class="forn-th--num forn-th--sortable text-right"
                :class="sortClass('cost')"
                @click="toggleSort('cost')"
              >
                <v-icon
                  :icon="sortIcon('cost')"
                  size="12"
                  class="forn-sort-icon"
                />
                {{ t("shipment.service.cols.cost") }}
              </th>
              <th class="forn-th--num text-right">
                {{ t("shipment.service.cols.fuel") }}
              </th>
              <th
                class="forn-th--tot forn-th--sortable text-right"
                :class="sortClass('tot')"
                @click="toggleSort('tot')"
              >
                <v-icon
                  :icon="sortIcon('tot')"
                  size="12"
                  class="forn-sort-icon"
                />
                {{ t("shipment.service.cols.total") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Grouped view (default, no active sort) -->
            <template v-if="!sortKey">
              <template
                v-for="grp in availableRows"
                :key="`avail-${grp.fornitore_id}`"
              >
                <tr class="forn-group-row">
                  <td colspan="5">
                    <v-icon
                      icon="mdi-truck"
                      size="14"
                      class="me-1 text-medium-emphasis"
                    />
                    <span class="forn-group-name">{{
                      grp.fornitore_name
                    }}</span>
                    <v-chip
                      size="x-small"
                      variant="text"
                      class="ms-1 text-medium-emphasis"
                    >
                      {{ grp.services.length }}
                    </v-chip>
                    <v-chip
                      v-if="grp.fornitore_id === currentFornitoreId"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      class="ms-2"
                    >
                      <v-icon icon="mdi-check" size="12" start />
                      {{ t("shipment.service.current") }}
                    </v-chip>
                  </td>
                </tr>
                <tr
                  v-for="svc in grp.services"
                  :key="svcKey(grp, svc)"
                  class="forn-row forn-row--avail"
                  :class="{
                    'forn-row--current': isCurrentService(grp, svc),
                    'forn-row--loading': selectedKey === svcKey(grp, svc),
                  }"
                  @click="onPick(grp, svc)"
                >
                  <td class="forn-td--svc">
                    <div class="d-flex align-center">
                      <v-icon
                        v-if="svc.prioritario"
                        icon="mdi-star-circle"
                        size="14"
                        color="amber-darken-2"
                        class="me-1"
                        :title="t('shipment.service.priority')"
                      />
                      <span class="forn-svc-name">{{
                        cleanDescription(svc.description)
                      }}</span>
                    </div>
                  </td>
                  <td class="forn-td--del">{{ formatDelivery(svc) }}</td>
                  <td class="forn-td--num text-right text-medium-emphasis">
                    {{
                      fmt(svc.cost - (svc.fuel_surcharge ?? 0), svc.currency)
                    }}
                  </td>
                  <td class="forn-td--num text-right text-medium-emphasis">
                    {{ fmt(svc.fuel_surcharge, svc.currency) }}
                  </td>
                  <td class="forn-td--tot text-right">
                    <span class="forn-total">{{
                      fmt(svc.cost, svc.currency)
                    }}</span>
                    <!-- Explain this cost (legacy DebugPrezzo quale=F). -->
                    <v-btn
                      icon="mdi-calculator-variant-outline"
                      variant="text"
                      size="x-small"
                      density="comfortable"
                      class="ms-1 forn-explain"
                      :title="t('shipment.service.explain_price')"
                      @click.stop="onExplain(grp, svc)"
                    />
                    <v-icon
                      v-if="selectedKey === svcKey(grp, svc)"
                      icon="mdi-loading"
                      size="14"
                      class="ms-2 forn-spin"
                    />
                    <v-icon
                      v-else
                      icon="mdi-chevron-right"
                      size="16"
                      class="ms-1 forn-arrow"
                    />
                  </td>
                </tr>
              </template>
            </template>

            <!-- Flat sorted view -->
            <template v-else>
              <tr
                v-for="row in availableSortedFlat"
                :key="svcKey(row.grp, row.svc)"
                class="forn-row forn-row--avail forn-row--flat"
                :class="{
                  'forn-row--current': isCurrentService(row.grp, row.svc),
                  'forn-row--loading': selectedKey === svcKey(row.grp, row.svc),
                }"
                @click="onPick(row.grp, row.svc)"
              >
                <td class="forn-td--svc">
                  <div class="d-flex align-center">
                    <v-icon
                      v-if="row.svc.prioritario"
                      icon="mdi-star-circle"
                      size="14"
                      color="amber-darken-2"
                      class="me-1"
                      :title="t('shipment.service.priority')"
                    />
                    <div class="forn-svc-stack">
                      <span class="forn-svc-name">{{
                        cleanDescription(row.svc.description)
                      }}</span>
                      <span class="forn-svc-forn">
                        <v-icon icon="mdi-truck" size="11" class="me-1" />{{
                          row.grp.fornitore_name
                        }}
                        <v-chip
                          v-if="row.grp.fornitore_id === currentFornitoreId"
                          size="x-small"
                          color="primary"
                          variant="tonal"
                          class="ms-1"
                        >
                          {{ t("shipment.service.current") }}
                        </v-chip>
                      </span>
                    </div>
                  </div>
                </td>
                <td class="forn-td--del">{{ formatDelivery(row.svc) }}</td>
                <td class="forn-td--num text-right text-medium-emphasis">
                  {{
                    fmt(
                      row.svc.cost - (row.svc.fuel_surcharge ?? 0),
                      row.svc.currency,
                    )
                  }}
                </td>
                <td class="forn-td--num text-right text-medium-emphasis">
                  {{ fmt(row.svc.fuel_surcharge, row.svc.currency) }}
                </td>
                <td class="forn-td--tot text-right">
                  <span class="forn-total">{{
                    fmt(row.svc.cost, row.svc.currency)
                  }}</span>
                  <!-- Explain this cost (legacy DebugPrezzo quale=F). -->
                  <v-btn
                    icon="mdi-calculator-variant-outline"
                    variant="text"
                    size="x-small"
                    density="comfortable"
                    class="ms-1 forn-explain"
                    :title="t('shipment.service.explain_price')"
                    @click.stop="onExplain(row.grp, row.svc)"
                  />
                  <v-icon
                    v-if="selectedKey === svcKey(row.grp, row.svc)"
                    icon="mdi-loading"
                    size="14"
                    class="ms-2 forn-spin"
                  />
                  <v-icon
                    v-else
                    icon="mdi-chevron-right"
                    size="16"
                    class="ms-1 forn-arrow"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </v-table>

        <EmptyState
          v-if="!availableRows.length && query"
          icon="mdi-magnify-close"
          :title="t('shipment.service.no_results_title')"
          :text="t('shipment.service.no_results_text', { query })"
          size="small"
          class="forn-empty-search"
        />

        <!-- UNAVAILABLE (collapsible) -->
        <v-divider v-if="unavailableRows.length" class="my-3" />
        <div
          v-if="unavailableRows.length"
          class="forn-unavail-header"
          @click="unavailableOpen = !unavailableOpen"
        >
          <v-icon
            :icon="unavailableOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'"
            size="18"
            class="me-1"
          />
          <span>{{ t("shipment.service.unavailable_section") }}</span>
          <v-chip size="x-small" variant="tonal" color="grey" class="ms-2">
            {{ unavailableCountTotal }}
          </v-chip>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">
            {{
              unavailableOpen
                ? t("shipment.service.hide")
                : t("shipment.service.show")
            }}
          </span>
        </div>

        <v-expand-transition>
          <div v-show="unavailableOpen && unavailableRows.length">
            <v-table density="compact" class="forn-table forn-table--unavail">
              <tbody>
                <template
                  v-for="grp in unavailableRows"
                  :key="`unav-${grp.fornitore_id}`"
                >
                  <tr class="forn-group-row forn-group-row--unavail">
                    <td colspan="5">
                      <v-icon
                        icon="mdi-truck-remove-outline"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      <span class="forn-group-name">{{
                        grp.fornitore_name
                      }}</span>
                      <v-chip
                        size="x-small"
                        variant="text"
                        class="ms-1 text-medium-emphasis"
                      >
                        {{ grp.services.length }}
                      </v-chip>
                    </td>
                  </tr>
                  <tr
                    v-for="svc in grp.services"
                    :key="svcKey(grp, svc)"
                    class="forn-row forn-row--unavail forn-row--forceable"
                    :class="{
                      'forn-row--loading': selectedKey === svcKey(grp, svc),
                    }"
                    :title="
                      t('shipment.service.select_anyway_forn_hint', {
                        reason: reasonLabel(svc),
                      })
                    "
                    @click="onPickUnavailable(grp, svc)"
                  >
                    <td class="forn-td--svc">
                      <v-icon
                        v-if="svc.prioritario"
                        icon="mdi-star-circle-outline"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      <span class="forn-svc-name">{{
                        cleanDescription(svc.description)
                      }}</span>
                    </td>
                    <td class="forn-td--del">{{ formatDelivery(svc) }}</td>
                    <td class="forn-td--num text-right text-medium-emphasis">
                      {{
                        fmt(svc.cost - (svc.fuel_surcharge ?? 0), svc.currency)
                      }}
                    </td>
                    <td class="forn-td--num text-right text-medium-emphasis">
                      {{ fmt(svc.fuel_surcharge, svc.currency) }}
                    </td>
                    <td class="forn-td--tot text-right">
                      <span class="forn-total forn-total--unavail">
                        {{ svc.cost > 0 ? fmt(svc.cost, svc.currency) : "—" }}
                      </span>
                      <v-chip
                        v-for="reason in svc.unavailable_reasons ?? []"
                        :key="reason"
                        size="x-small"
                        variant="tonal"
                        :color="reasonColor(reason)"
                        class="ms-1 forn-reason-chip"
                      >
                        {{ reason }}
                      </v-chip>
                      <v-icon
                        icon="mdi-chevron-right"
                        size="16"
                        class="ms-1 forn-arrow"
                      />
                    </td>
                  </tr>
                </template>
              </tbody>
            </v-table>
            <div class="forn-legend">
              <span class="forn-legend__title">{{
                t("shipment.service.legend")
              }}</span>
              <span
                v-for="entry in usedReasons"
                :key="entry.code"
                class="forn-legend__item"
              >
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="reasonColor(entry.code)"
                >
                  {{ entry.code }}
                </v-chip>
                {{ entry.label }}
              </span>
            </div>
          </div>
        </v-expand-transition>
      </template>
    </div>
  </AppDialog>

  <!-- Confirm selecting an unavailable fornitore service (legacy allows it). -->
  <AppDialog
    :open="confirmOpen"
    :title="t('shipment.service.confirm_forn_title')"
    icon="mdi-alert-outline"
    icon-color="warning"
    size="confirm"
    @close="confirmOpen = false"
  >
    <p class="text-body-2 mb-2">
      {{ t("shipment.service.confirm_body_intro") }}
      <strong>{{ t("shipment.service.confirm_body_unavailable") }}</strong
      >:
    </p>
    <p class="text-body-2 font-weight-medium">
      {{ pendingSvc ? cleanDescription(pendingSvc.svc.description) : "" }}
      <span v-if="pendingSvc" class="text-medium-emphasis"
        >— {{ pendingSvc.grp.fornitore_name }}</span
      >
    </p>
    <div v-if="pendingReasons.length" class="mt-2 d-flex flex-wrap ga-1">
      <v-chip
        v-for="r in pendingReasons"
        :key="r"
        size="x-small"
        variant="tonal"
        :color="reasonColor(r)"
      >
        {{ r }} · {{ reasonDictLabel(r) }}
      </v-chip>
    </div>
    <p class="text-caption text-medium-emphasis mt-3">
      {{ t("shipment.service.confirm_forn_legacy_note") }}
    </p>
    <template #actions>
      <v-btn
        variant="text"
        :disabled="store.selecting"
        @click="confirmOpen = false"
        >{{ t("common.cancel") }}</v-btn
      >
      <v-spacer />
      <v-btn
        color="warning"
        variant="flat"
        :loading="store.selecting"
        @click="confirmPickUnavailable"
      >
        {{ t("shipment.service.select_anyway") }}
      </v-btn>
    </template>
  </AppDialog>

  <!-- Price-derivation trace panel (legacy DebugPrezzo quale=F). -->
  <RateDebugPanel
    v-model="store.debugOpen"
    :service-name="store.debugServiceName"
    :trace="store.debugTrace"
    :loading="store.debugLoading"
  />
</template>

<script setup lang="ts">
import AppDialog from "@shared/ui/AppDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useServiceSelectionStore } from "@shipment/stores/service_selection.store";
import type { FornitoreServiceOption } from "@shipment/services/service_selection.service";
import RateDebugPanel from "./RateDebugPanel.vue";
import { formatMoney } from "@shipment/utils/currency";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const { t, locale } = useI18n();
const shipmentStore = useShipmentStore();
const { id, shipment } = storeToRefs(shipmentStore);
const store = useServiceSelectionStore();

// "Servicio económico" (id_servforn_eco): id del servicio de courier más barato
// retenido para recálculos. Campo numérico plano (paridad legacy), persistido
// on-blur vía store.update. El whitelist backend acepta int >= 0.
const ecoService = useFieldBinding("id_servforn_eco", "");

const query = ref("");
const unavailableOpen = ref(false);
const selectedKey = ref<string | null>(null);
const confirmOpen = ref(false);
const pendingSvc = ref<FlatRow | null>(null);
const pendingReasons = computed<string[]>(
  () => pendingSvc.value?.svc.unavailable_reasons ?? [],
);

// Sort state. `null` = grouped view (default); otherwise rows are flattened
// across fornitori and sorted by the chosen column. Cycle on header click:
// off → asc → desc → off.
type SortKey = "svc" | "del" | "cost" | "tot";
type SortDir = "asc" | "desc";
const sortKey = ref<SortKey | null>(null);
const sortDir = ref<SortDir>("asc");

function toggleSort(k: SortKey): void {
  if (sortKey.value !== k) {
    sortKey.value = k;
    sortDir.value = "asc";
  } else if (sortDir.value === "asc") {
    sortDir.value = "desc";
  } else {
    sortKey.value = null;
    sortDir.value = "asc";
  }
}

function sortIcon(k: SortKey): string {
  if (sortKey.value !== k) return "mdi-unfold-more-horizontal";
  return sortDir.value === "asc" ? "mdi-arrow-up" : "mdi-arrow-down";
}

function sortClass(k: SortKey): Record<string, boolean> {
  return { "forn-th--sorted": sortKey.value === k };
}

// Reasons taxonomy — paridad legacy `multiinf[]` (spedy_importo_funz_fornitore.php
// líneas 268, 294-304). Cada token tiene un color; la etiqueta humana se
// resuelve por i18n (shipment.service.reasons.*).
const REASON_COLOR: Record<string, string> = {
  DSP: "orange",
  LKD: "grey",
  SNK: "blue-grey",
  BNK: "blue-grey",
  ADR: "red",
  ICE: "cyan",
  PRV: "purple",
  GDO: "purple",
  CPN: "purple",
  SPD: "purple",
  COD: "amber-darken-2",
  SDA: "grey",
  DIM: "red",
  LVL: "grey",
};

/** Human label for a reason code, resolved via i18n with a generic fallback. */
function reasonText(code: string): string {
  const key = `shipment.service.reasons.${code}`;
  const label = t(key);
  return label === key ? t("shipment.service.reasons.default") : label;
}

const currentFornitoreId = computed<number>(() =>
  Number(shipment.value?.id_fornitore ?? 0),
);
const currentServiceForn = computed<number>(() =>
  Number(shipment.value?.id_servizio_fornitore ?? 0),
);

function isCurrentService(
  grp: FornitoreServiceOption,
  svc: FornitoreServiceOption["services"][number],
): boolean {
  return (
    grp.fornitore_id === currentFornitoreId.value &&
    Number(svc.id_servizio_fornitore) === currentServiceForn.value
  );
}

function matchesQuery(text: string): boolean {
  if (!query.value) return true;
  return text.toLowerCase().includes(query.value.toLowerCase());
}

const availableRows = computed<FornitoreServiceOption[]>(() => {
  return store.fornitoreServices
    .map((grp) => ({
      ...grp,
      services: grp.services.filter(
        (s) =>
          s.available &&
          (matchesQuery(grp.fornitore_name) ||
            matchesQuery(String(s.description))),
      ),
    }))
    .filter((g) => g.services.length > 0);
});

const unavailableRows = computed<FornitoreServiceOption[]>(() => {
  return store.fornitoreServices
    .map((grp) => ({
      ...grp,
      services: grp.services.filter(
        (s) =>
          !s.available &&
          (matchesQuery(grp.fornitore_name) ||
            matchesQuery(String(s.description))),
      ),
    }))
    .filter((g) => g.services.length > 0);
});

const availableCount = computed<number>(() =>
  availableRows.value.reduce((acc, g) => acc + g.services.length, 0),
);

type FlatRow = {
  grp: FornitoreServiceOption;
  svc: FornitoreServiceOption["services"][number];
};

function deliverySortValue(
  svc: FornitoreServiceOption["services"][number],
): number {
  const date = svc.delivery_date;
  if (!date || date === "0000-00-00") return Number.MAX_SAFE_INTEGER;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const time = svc.delivery_time;
  if (time) {
    const tm = /^(\d{2}):(\d{2})/.exec(time);
    if (tm) return t + Number(tm[1]) * 60 + Number(tm[2]);
  }
  return t;
}

const availableSortedFlat = computed<FlatRow[]>(() => {
  if (!sortKey.value) return [];
  const flat: FlatRow[] = [];
  for (const grp of availableRows.value) {
    for (const svc of grp.services) flat.push({ grp, svc });
  }
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  flat.sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    switch (key) {
      case "svc":
        av = cleanDescription(String(a.svc.description)).toLowerCase();
        bv = cleanDescription(String(b.svc.description)).toLowerCase();
        break;
      case "del":
        av = deliverySortValue(a.svc);
        bv = deliverySortValue(b.svc);
        break;
      case "cost":
        av = Number(a.svc.cost ?? 0) - Number(a.svc.fuel_surcharge ?? 0);
        bv = Number(b.svc.cost ?? 0) - Number(b.svc.fuel_surcharge ?? 0);
        break;
      case "tot":
        av = Number(a.svc.cost ?? 0);
        bv = Number(b.svc.cost ?? 0);
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return flat;
});

// Cuenta total non-disponibili sin aplicar el filtro de búsqueda — para que
// el contador del header refleje el universo completo de unavailable cuando
// el toggle se expande, no la subset filtrada (que sería confusa).
const unavailableCountTotal = computed<number>(() => {
  return store.fornitoreServices.reduce(
    (acc, g) => acc + g.services.filter((s) => !s.available).length,
    0,
  );
});

const usedReasons = computed<Array<{ code: string; label: string }>>(() => {
  const seen = new Set<string>();
  for (const g of unavailableRows.value) {
    for (const s of g.services) {
      for (const r of s.unavailable_reasons ?? []) seen.add(r);
    }
  }
  return Array.from(seen).map((c) => ({
    code: c,
    label: reasonText(c),
  }));
});

function reasonLabel(svc: FornitoreServiceOption["services"][number]): string {
  const reasons = svc.unavailable_reasons ?? [];
  if (!reasons.length) return t("shipment.service.reasons.default");
  return reasons.map((r) => `${r}: ${reasonText(r)}`).join(" · ");
}

function reasonColor(code: string): string {
  return REASON_COLOR[code] ?? "grey";
}

function cleanDescription(raw?: string): string {
  if (!raw) return "";
  // Strip residual HTML <B>/<b> tags from legacy descr columns.
  return raw.replace(/<\/?[bB]>/g, "").trim();
}

// Relative day labels resolve via i18n; absolute dates use the active locale.
function formatDelivery(
  svc: FornitoreServiceOption["services"][number],
): string {
  const date = svc.delivery_date;
  const time = svc.delivery_time;
  if (!date || date === "0000-00-00") return "—";
  // Parse YYYY-MM-DD (with optional time)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(dt.getTime())) return date;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  let label: string;
  if (diff === 0) label = t("shipment.service.delivery_today");
  else if (diff === 1) label = t("shipment.service.delivery_tomorrow");
  else {
    label = new Intl.DateTimeFormat(String(locale.value), {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(dt);
  }

  if (time) {
    // Normalize "HH:MM" or "HH:MM:SS" → "HH:MM"
    const tm = time.slice(0, 5);
    if (tm !== "00:00" && tm !== "23:59") label += ` · ${tm}`;
  }
  return label;
}

function svcKey(
  forn: FornitoreServiceOption,
  svc: FornitoreServiceOption["services"][number],
): string {
  return `${forn.fornitore_id}:${svc.id_servizio_fornitore}`;
}

async function load(force = false): Promise<void> {
  if (!id.value) return;
  // El segundo arg de loadFornitore es includeUnavailable: siempre lo
  // pedimos true para poder mostrar la sección colapsable abajo. El backend
  // de todos modos cachea la respuesta unificada.
  await store.loadFornitore(Number(id.value), true);
  if (force) {
    // Limpia query cuando forzamos refresh manual.
    query.value = "";
  }
}

async function onPick(
  forn: FornitoreServiceOption,
  svc: FornitoreServiceOption["services"][number],
): Promise<void> {
  if (!id.value) return;
  // Asignación MANUAL del servicio del courier (paridad legacy FornSet →
  // spedy_update_forn_set.php): se asigna el id_servizio_fornitore de la fila
  // clicada y NO se toca id_servizio (el servicio comercial se mantiene).
  //
  // El bug anterior recascadeaba el id_servizio comercial actual pasándole el
  // fornitore; cuando ese fornitore no ofrecía el comercial vigente (p.ej. DHL
  // no sirve el comercial "5"), el motor no resolvía id_servizio_fornitore y lo
  // dejaba en 0 → la etiqueta fallaba con "No service type selected".
  const isf = Number(svc.id_servizio_fornitore ?? 0);
  if (isf <= 0) {
    store.error = t("shipment.service.must_select_client_first");
    return;
  }
  selectedKey.value = svcKey(forn, svc);
  const ok = await store.assignFornitoreService(
    Number(id.value),
    forn.fornitore_id,
    {
      id_servizio_fornitore: isf,
      cost: svc.cost,
      fuel_surcharge: svc.fuel_surcharge,
      currency: svc.currency,
      zone_code: svc.zone_code as string | undefined,
    },
  );
  selectedKey.value = null;
  if (ok) emit("update:open", false);
}

/** Open the price-derivation trace for a fornitore service (legacy DebugPrezzo). */
async function onExplain(
  forn: FornitoreServiceOption,
  svc: FornitoreServiceOption["services"][number],
): Promise<void> {
  if (!id.value) return;
  await store.explainFornitorePrice(
    Number(id.value),
    forn.fornitore_id,
    Number(svc.id_servizio_fornitore),
    cleanDescription(svc.description),
  );
}

/** Clicking an unavailable row opens a confirmation first (legacy allows it). */
function onPickUnavailable(
  forn: FornitoreServiceOption,
  svc: FornitoreServiceOption["services"][number],
): void {
  if (!id.value) return;
  pendingSvc.value = { grp: forn, svc };
  confirmOpen.value = true;
}

async function confirmPickUnavailable(): Promise<void> {
  const p = pendingSvc.value;
  if (!p) return;
  await onPick(p.grp, p.svc);
  confirmOpen.value = false;
  pendingSvc.value = null;
}

function reasonDictLabel(code: string): string {
  return reasonText(code);
}

function fmt(v?: number, currency = "EUR"): string {
  if (v == null || Number.isNaN(v)) return "—";
  return formatMoney(v, currency);
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      query.value = "";
      unavailableOpen.value = false;
      sortKey.value = null;
      sortDir.value = "asc";
      void load();
    }
  },
);
</script>

<style scoped>
.forn-modal {
  border-radius: 12px;
}

.forn-modal__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.forn-modal__search {
  flex: 1 1 auto;
}

.forn-modal__eco {
  margin-bottom: 8px;
}

.forn-modal__eco-field {
  max-width: 260px;
}

.forn-modal__eco-field :deep(.v-field) {
  border-radius: 8px;
}

.forn-modal__search :deep(.v-field) {
  border-radius: 8px;
}

.forn-modal__body {
  max-height: 70vh;
  overflow-y: auto;
}

/* Tabla principal — paridad visual con cliente modal pero con sticky header
   y agrupación por fornitore inline. */
.forn-table {
  background: transparent;
}

.forn-table :deep(thead) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}

.forn-table :deep(thead th) {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  padding: 8px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  white-space: nowrap;
}

.forn-th--svc {
  width: 38%;
}
.forn-th--del {
  width: 22%;
}
.forn-th--num {
  width: 11%;
}
.forn-th--tot {
  width: 18%;
}

.forn-th--sortable {
  cursor: pointer;
  user-select: none;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.forn-th--sortable:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.forn-th--sorted {
  color: rgb(var(--v-theme-primary));
}

.forn-sort-icon {
  opacity: 0.55;
  margin-left: 2px;
  vertical-align: middle;
}

.forn-th--sortable:hover .forn-sort-icon,
.forn-th--sorted .forn-sort-icon {
  opacity: 1;
}

/* Flat sorted view — show fornitore inline under service description */
.forn-svc-stack {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.forn-svc-forn {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: inline-flex;
  align-items: center;
  margin-top: 1px;
}

.forn-row--flat :deep(td) {
  padding: 10px 8px !important;
}

/* Header de grupo (fornitore) — fila separadora ligera */
.forn-group-row td {
  background: rgba(var(--v-theme-primary), 0.04);
  padding: 6px 8px !important;
  font-size: 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06) !important;
}

.forn-group-row--unavail td {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.forn-group-name {
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}

/* Filas de servicio */
.forn-row {
  cursor: default;
  transition: background-color 0.15s ease;
}

.forn-row--avail {
  cursor: pointer;
}

.forn-row--avail:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.forn-row--avail:hover .forn-arrow {
  color: rgb(var(--v-theme-primary));
  transform: translateX(2px);
}

.forn-row--current {
  background: rgba(var(--v-theme-primary), 0.08);
}

.forn-row--current:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}

.forn-row--loading {
  background: rgba(var(--v-theme-primary), 0.06);
  pointer-events: none;
}

.forn-row--unavail {
  opacity: 0.55;
}

/* Unavailable rows are still selectable (legacy parity): clickable with a
   subtle warning-tinted hover. */
.forn-row--forceable {
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}
.forn-row--forceable:hover {
  opacity: 0.85;
  background: rgba(var(--v-theme-warning), 0.08);
}
.forn-row--forceable:hover .forn-arrow {
  color: rgb(var(--v-theme-warning));
  transform: translateX(2px);
}

.forn-row :deep(td) {
  padding: 8px !important;
  font-size: 12.5px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.04) !important;
}

.forn-td--svc {
  line-height: 1.3;
}
.forn-svc-name {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.92);
}

.forn-td--del {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: nowrap;
}

.forn-td--num {
  font-feature-settings: "tnum";
  font-size: 12px;
  white-space: nowrap;
}

.forn-td--tot {
  font-feature-settings: "tnum";
  white-space: nowrap;
}

.forn-total {
  font-weight: 600;
  font-size: 13px;
}

.forn-total--unavail {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-weight: 400;
}

.forn-explain {
  opacity: 0.5;
  transition: opacity 0.15s ease;
}
.forn-row--avail:hover .forn-explain,
.forn-row--forceable:hover .forn-explain {
  opacity: 1;
}

.forn-arrow {
  color: rgba(var(--v-theme-on-surface), 0.4);
  transition:
    transform 0.15s ease,
    color 0.15s ease;
}

.forn-spin {
  animation: forn-spin 0.7s linear infinite;
}

@keyframes forn-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Sección unavailable */
.forn-unavail-header {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.75);
  border-radius: 6px;
}

.forn-unavail-header:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.forn-table--unavail {
  margin-top: 4px;
}

.forn-reason-chip {
  font-feature-settings: normal;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.forn-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px 4px 4px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.forn-legend__title {
  font-weight: 600;
}
.forn-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.forn-empty-search {
  margin: 20px 0;
}
</style>
