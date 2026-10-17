<template>
  <AppDialog
    :open="open"
    :title="t('shipment.service.client_title')"
    icon="mdi-tag-multiple-outline"
    :max-width="980"
    card-class="svc-modal"
    @close="emit('update:open', false)"
  >
    <div class="svc-modal__body">
      <!-- Toolbar: count chip + refresh + search (formerly the dialog header
           band; moved into the body since AppDialog owns the title bar). -->
      <div class="svc-modal__toolbar">
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
          :placeholder="t('shipment.service.search_client_placeholder')"
          prepend-inner-icon="mdi-magnify"
          class="svc-modal__search"
        />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="small"
          density="comfortable"
          :loading="store.loadingClient"
          :title="t('common.refresh')"
          class="ms-1"
          @click="load"
        />
      </div>

      <div class="svc-modal__content">
        <v-skeleton-loader v-if="store.loadingClient" type="table-row@6" />

        <v-alert
          v-else-if="store.error"
          type="error"
          class="mb-2"
          variant="tonal"
        >
          {{ store.error }}
        </v-alert>

        <EmptyState
          v-else-if="!store.clientServices.length"
          icon="mdi-package-variant-closed-remove"
          :title="t('shipment.service.client_empty_title')"
          :text="t('shipment.service.client_empty_text')"
        />

        <template v-else>
          <!-- AVAILABLE -->
          <v-table
            v-if="availableRows.length"
            density="compact"
            class="svc-table"
          >
            <thead>
              <tr>
                <th class="svc-th--svc">
                  {{ t("shipment.service.cols.service") }}
                </th>
                <th class="svc-th--del">
                  {{ t("shipment.service.cols.delivery") }}
                </th>
                <th class="svc-th--forn">
                  {{ t("shipment.service.cols.fornitore") }}
                </th>
                <th class="svc-th--num text-right">
                  {{ t("shipment.service.cols.carico") }}
                </th>
                <th class="svc-th--num text-right">
                  {{ t("shipment.service.cols.fuel") }}
                </th>
                <th class="svc-th--tot text-right">
                  {{ t("shipment.service.cols.total") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in availableRows"
                :key="`${s.service_id}-${s.fornitore_id ?? 0}`"
                class="svc-row svc-row--avail"
                :class="{
                  'svc-row--current': isCurrent(s),
                  'svc-row--loading':
                    store.selecting && selectedId === s.service_id,
                }"
                @click="onPick(s)"
              >
                <td class="svc-td--svc">
                  <div class="d-flex align-center">
                    <v-icon
                      v-if="s.priority"
                      icon="mdi-star-circle"
                      size="14"
                      color="amber-darken-2"
                      class="me-1"
                      :title="t('shipment.service.priority')"
                    />
                    <span class="svc-name">{{
                      cleanDescription(s.description)
                    }}</span>
                    <v-chip
                      v-if="isCurrent(s)"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      class="ms-2"
                    >
                      <v-icon icon="mdi-check" size="12" start />
                      {{ t("shipment.service.current") }}
                    </v-chip>
                  </div>
                </td>
                <td class="svc-td--del">{{ s.delivery_date ?? "—" }}</td>
                <td class="svc-td--forn">
                  <v-chip
                    v-if="s.fornitore_name || s.fornitore_id"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ s.fornitore_name || `#${s.fornitore_id}` }}
                  </v-chip>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="svc-td--num text-right text-medium-emphasis">
                  {{
                    fmt((s.price ?? 0) - (s.fuel_surcharge ?? 0), s.currency)
                  }}
                </td>
                <td class="svc-td--num text-right text-medium-emphasis">
                  {{ fmt(s.fuel_surcharge, s.currency) }}
                </td>
                <td class="svc-td--tot text-right">
                  <span class="svc-total">{{ fmt(s.price, s.currency) }}</span>
                  <!-- Explain this price (legacy DebugPrezzo): step-by-step trace. -->
                  <v-btn
                    icon="mdi-calculator-variant-outline"
                    variant="text"
                    size="x-small"
                    density="comfortable"
                    class="ms-1 svc-explain"
                    :title="t('shipment.service.explain_price')"
                    @click.stop="onExplain(s)"
                  />
                  <v-icon
                    v-if="store.selecting && selectedId === s.service_id"
                    icon="mdi-loading"
                    size="14"
                    class="ms-1 svc-spin"
                  />
                  <v-icon
                    v-else
                    icon="mdi-chevron-right"
                    size="16"
                    class="ms-1 svc-arrow"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <EmptyState
            v-if="!availableRows.length && query"
            icon="mdi-magnify-close"
            :title="t('shipment.service.no_results_title')"
            :text="t('shipment.service.no_results_text', { query })"
            size="small"
            class="svc-empty-search"
          />

          <!-- UNAVAILABLE (collapsible) — same pattern as the fornitore modal. -->
          <v-divider v-if="unavailableRows.length" class="my-3" />
          <div
            v-if="unavailableRows.length"
            class="svc-unavail-header"
            @click="unavailableOpen = !unavailableOpen"
          >
            <v-icon
              :icon="unavailableOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              size="18"
              class="me-1"
            />
            <span>{{ t("shipment.service.unavailable_section") }}</span>
            <v-chip size="x-small" variant="tonal" color="grey" class="ms-2">
              {{ unavailableRows.length }}
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
              <v-table density="compact" class="svc-table svc-table--unavail">
                <tbody>
                  <tr
                    v-for="s in unavailableRows"
                    :key="`unav-${s.service_id}-${s.fornitore_id ?? 0}`"
                    class="svc-row svc-row--unavail svc-row--forceable"
                    :class="{
                      'svc-row--loading':
                        store.selecting && selectedId === s.service_id,
                    }"
                    :title="t('shipment.service.select_anyway_hint')"
                    @click="onPickUnavailable(s)"
                  >
                    <td class="svc-td--svc">
                      <v-icon
                        v-if="s.priority"
                        icon="mdi-star-circle-outline"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      <span class="svc-name">{{
                        cleanDescription(s.description)
                      }}</span>
                    </td>
                    <td class="svc-td--del">{{ s.delivery_date ?? "—" }}</td>
                    <td class="svc-td--forn">
                      <v-chip
                        v-if="s.fornitore_name || s.fornitore_id"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ s.fornitore_name || `#${s.fornitore_id}` }}
                      </v-chip>
                      <span v-else class="text-medium-emphasis">—</span>
                    </td>
                    <td class="svc-td--num text-right text-medium-emphasis">
                      {{
                        fmt(
                          (s.price ?? 0) - (s.fuel_surcharge ?? 0),
                          s.currency,
                        )
                      }}
                    </td>
                    <td class="svc-td--num text-right text-medium-emphasis">
                      {{ fmt(s.fuel_surcharge, s.currency) }}
                    </td>
                    <td class="svc-td--tot text-right">
                      <span class="svc-total svc-total--unavail">
                        {{
                          (s.price ?? 0) > 0 ? fmt(s.price, s.currency) : "—"
                        }}
                      </span>
                      <v-chip
                        size="x-small"
                        color="grey"
                        variant="tonal"
                        class="ms-1"
                      >
                        {{ t("shipment.service.unavailable") }}
                      </v-chip>
                      <v-icon
                        icon="mdi-chevron-right"
                        size="16"
                        class="ms-1 svc-arrow"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-expand-transition>
        </template>
      </div>
    </div>
  </AppDialog>

  <!-- Confirm selecting an unavailable service (legacy allows it: the row is
       clickable just like an available one; we add a confirmation because it's
       an unusual action). -->
  <AppDialog
    :open="confirmOpen"
    :title="t('shipment.service.confirm_client_title')"
    icon="mdi-alert-outline"
    icon-color="warning"
    size="confirm"
    @close="confirmOpen = false"
  >
    <p class="text-body-2 mb-2">
      {{ t("shipment.service.confirm_body_intro") }}
      <strong>{{ t("shipment.service.confirm_body_unavailable") }}</strong>
      {{ t("shipment.service.confirm_client_body_for") }}
    </p>
    <p class="text-body-2 font-weight-medium">
      {{
        pendingUnavailable
          ? cleanDescription(pendingUnavailable.description)
          : ""
      }}
    </p>
    <p class="text-caption text-medium-emphasis mt-2">
      {{ t("shipment.service.confirm_legacy_note") }}
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

  <!-- Price derivation trace panel (legacy DebugPrezzo). -->
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
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useServiceSelectionStore } from "@shipment/stores/service_selection.store";
import type { ClientServiceOption } from "@shipment/services/service_selection.service";
import RateDebugPanel from "./RateDebugPanel.vue";
import { formatMoney } from "@shipment/utils/currency";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const { t } = useI18n();
const shipmentStore = useShipmentStore();
const { id, shipment } = storeToRefs(shipmentStore);
const store = useServiceSelectionStore();

const query = ref("");
const unavailableOpen = ref(false);
const selectedId = ref<number | null>(null);
const confirmOpen = ref(false);
const pendingUnavailable = ref<ClientServiceOption | null>(null);

const currentServiceId = computed<number>(() =>
  Number(shipment.value?.id_servizio ?? 0),
);

function matchesQuery(s: ClientServiceOption): boolean {
  if (!query.value) return true;
  const q = query.value.toLowerCase();
  return (
    String(s.description ?? "")
      .toLowerCase()
      .includes(q) ||
    String(s.fornitore_name ?? "")
      .toLowerCase()
      .includes(q)
  );
}

// Always load with unavailable rows so the collapsible section can render them
// (harmonised with the fornitore modal, which does the same).
const availableRows = computed<ClientServiceOption[]>(() =>
  store.clientServices.filter((s) => s.available && matchesQuery(s)),
);
const unavailableRows = computed<ClientServiceOption[]>(() =>
  store.clientServices.filter((s) => !s.available && matchesQuery(s)),
);
const availableCount = computed<number>(() => availableRows.value.length);

async function load(): Promise<void> {
  if (!id.value) return;
  await store.loadClient(Number(id.value), true);
}

/** Open the price-derivation trace for a service (legacy DebugPrezzo). */
async function onExplain(s: ClientServiceOption): Promise<void> {
  if (!id.value) return;
  await store.explainClientPrice(Number(id.value), s.service_id, s.description);
}

async function onPick(s: ClientServiceOption): Promise<void> {
  if (!id.value) return;
  selectedId.value = s.service_id;
  // Pass fornitore_id when the row already specifies one, so the backend
  // honours the precise pairing instead of running its own selection.
  const ok = await store.selectAndCascade(
    Number(id.value),
    s.service_id,
    s.fornitore_id ?? undefined,
  );
  selectedId.value = null;
  if (ok) emit("update:open", false);
}

/** Clicking an unavailable row opens a confirmation first (legacy allows it). */
function onPickUnavailable(s: ClientServiceOption): void {
  if (!id.value) return;
  pendingUnavailable.value = s;
  confirmOpen.value = true;
}

async function confirmPickUnavailable(): Promise<void> {
  const s = pendingUnavailable.value;
  if (!s) return;
  await onPick(s);
  confirmOpen.value = false;
  pendingUnavailable.value = null;
}

function isCurrent(s: ClientServiceOption): boolean {
  return s.service_id === currentServiceId.value && currentServiceId.value > 0;
}

function cleanDescription(raw?: string): string {
  if (!raw) return "";
  // Strip residual HTML <B>/<b> tags from legacy descr columns.
  return raw.replace(/<\/?[bB]>/g, "").trim();
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
      void load();
    }
  },
);
</script>

<style scoped>
/* Harmonised with ShipmentServiceFornitoreModal (forn-*): same header,
   toolbar, table chrome, clickable rows with chevron, totals and unavailable
   section — so the two service-selection modals feel like one family. */
.svc-modal {
  border-radius: 12px;
}

/* AppDialog wraps the slot in v-card-text.pa-4, so the toolbar/body live
   inside that padding; negative margins let the search band span full width. */
.svc-modal__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -8px -16px 0;
  padding: 10px 16px;
  background: rgba(var(--v-theme-surface-variant), 0.25);
}

.svc-modal__search {
  flex: 1 1 auto;
}

.svc-modal__search :deep(.v-field) {
  border-radius: 8px;
}

.svc-modal__body {
  display: flex;
  flex-direction: column;
}

.svc-modal__content {
  padding-top: 8px;
  max-height: 70vh;
  overflow-y: auto;
}

.svc-table {
  background: transparent;
}

.svc-table :deep(thead) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}

.svc-table :deep(thead th) {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  padding: 8px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  white-space: nowrap;
}

.svc-th--svc {
  width: 34%;
}
.svc-th--del {
  width: 16%;
}
.svc-th--forn {
  width: 16%;
}
.svc-th--num {
  width: 11%;
}
.svc-th--tot {
  width: 18%;
}

/* Service rows */
.svc-row {
  cursor: default;
  transition: background-color 0.15s ease;
}

.svc-row--avail {
  cursor: pointer;
}

.svc-row--avail:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.svc-row--avail:hover .svc-arrow {
  color: rgb(var(--v-theme-primary));
  transform: translateX(2px);
}

.svc-row--current {
  background: rgba(var(--v-theme-primary), 0.08);
}

.svc-row--current:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}

.svc-row--loading {
  background: rgba(var(--v-theme-primary), 0.06);
  pointer-events: none;
}

.svc-row--unavail {
  opacity: 0.55;
}

/* Unavailable rows are still selectable (legacy parity): clickable with a
   subtle hover, brightening slightly so it's clear the action is allowed. */
.svc-row--forceable {
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}
.svc-row--forceable:hover {
  opacity: 0.85;
  background: rgba(var(--v-theme-warning), 0.08);
}
.svc-row--forceable:hover .svc-arrow {
  color: rgb(var(--v-theme-warning));
  transform: translateX(2px);
}

.svc-row :deep(td) {
  padding: 8px !important;
  font-size: 12.5px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.04) !important;
}

.svc-td--svc {
  line-height: 1.3;
}
.svc-name {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.92);
}

.svc-td--del {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: nowrap;
}

.svc-td--num {
  font-feature-settings: "tnum";
  font-size: 12px;
  white-space: nowrap;
}

.svc-td--tot {
  font-feature-settings: "tnum";
  white-space: nowrap;
}

.svc-total {
  font-weight: 600;
  font-size: 13px;
}

.svc-total--unavail {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-weight: 400;
}

.svc-explain {
  opacity: 0.55;
  transition: opacity 0.15s ease;
}
.svc-row--avail:hover .svc-explain {
  opacity: 1;
}

.svc-arrow {
  color: rgba(var(--v-theme-on-surface), 0.4);
  transition:
    transform 0.15s ease,
    color 0.15s ease;
}

.svc-spin {
  animation: svc-spin 0.7s linear infinite;
}

@keyframes svc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Unavailable section */
.svc-unavail-header {
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

.svc-unavail-header:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.svc-table--unavail {
  margin-top: 4px;
}

.svc-empty-search {
  margin: 20px 0;
}
</style>
