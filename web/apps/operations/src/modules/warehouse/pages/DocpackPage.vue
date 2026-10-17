<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { can } from "../env";
import {
  canPrintWaybill,
  createScanGuard,
  filterMultiparcel,
  filterPendingClients,
  PENDING_DAYS_DEFAULT,
  PENDING_DAYS_OPTIONS,
  pendingNotComplete,
  pendingNotWeighed,
  pendingShipmentUnweighed,
  sortPendingClients,
  summarizePending,
  todayIso,
  unweighedCount,
  type MultiparcelView,
} from "../logic";
import { errMsg, printWaybill } from "../print";
import { warehouseApi } from "../services/warehouse.service";
import { useToastStore } from "../stores/toast.store";
import type {
  Completeness,
  CompletenessItem,
  Parcel,
  PendingClient,
  PendingShipment,
  ValidationResult,
} from "../types";

const { t } = useI18n();
const toast = useToastStore();
const canWrite = can.write();

type View = "pending" | "all" | "orphans" | MultiparcelView;
const view = ref<View>("pending");
const code = ref("");
const scanInput = ref<{ focus: () => void } | null>(null);
const guard = createScanGuard();
const busy = ref(false);
const result = ref<ValidationResult | null>(null);
const completeness = ref<Completeness | null>(null);
const emergency = ref(false);
const assocShipment = ref("");
const assocParcels = ref<Parcel[] | null>(null);
const assocOpen = ref(false);

// listados
const orphans = ref<Parcel[]>([]);
const orphanTotal = ref(0);
const orphanPage = ref(1);
const orphanFilter = ref("");
const date = ref(todayIso());
const dayItems = ref<CompletenessItem[]>([]);

// pendientes por cliente
const pendingDays = ref<number>(PENDING_DAYS_DEFAULT);
const pendingDaysItems: number[] = [...PENDING_DAYS_OPTIONS];
const pendingFilter = ref("");
const pendingClients = ref<PendingClient[]>([]);
const pendingLoaded = ref(false);
const pendingClient = ref<PendingClient | null>(null);
const pendingShipments = ref<PendingShipment[]>([]);
const pendingShipmentsBusy = ref(false);
const pendingRows = computed(() =>
  filterPendingClients(sortPendingClients(pendingClients.value), pendingFilter.value),
);
const pendingTotals = computed(() => summarizePending(pendingRows.value));
const clientsOpen = computed({
  get: () => pendingClient.value !== null,
  set: (v: boolean) => {
    if (!v) pendingClient.value = null;
  },
});

const shipmentId = computed(() => {
  const p = result.value?.parcel;
  return result.value?.source === "spedizioni_colli" && p?.id_spedizione
    ? Number(p.id_spedizione)
    : null;
});
const unweighed = computed(() =>
  completeness.value ? unweighedCount(completeness.value) : 0,
);
const printEnabled = computed(
  () =>
    canWrite &&
    !!shipmentId.value &&
    !busy.value &&
    canPrintWaybill(unweighed.value, emergency.value),
);
const multiRows = computed(() =>
  view.value === "weighed" || view.value === "unweighed"
    ? filterMultiparcel(dayItems.value, view.value)
    : [],
);

function focusScan(): void {
  void nextTick(() => scanInput.value?.focus());
}

async function loadCompleteness(id: number): Promise<void> {
  try {
    completeness.value = await warehouseApi.completeness(id);
  } catch (e) {
    completeness.value = null;
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  }
}

async function scan(raw?: string): Promise<void> {
  const c = raw ?? guard.accept(code.value);
  if (!c) return;
  code.value = c;
  busy.value = true;
  completeness.value = null;
  try {
    result.value = await warehouseApi.lookup(c);
    if (shipmentId.value) await loadCompleteness(shipmentId.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

function skip(): void {
  result.value = null;
  completeness.value = null;
  code.value = "";
  assocShipment.value = "";
  emergency.value = false;
  focusScan();
}

async function reload(): Promise<void> {
  if (code.value) await scan(code.value);
  else if (shipmentId.value) await loadCompleteness(shipmentId.value);
}

async function loadPending(): Promise<void> {
  busy.value = true;
  try {
    const r = await warehouseApi.pendingClients(pendingDays.value);
    pendingClients.value = r.clients;
    pendingLoaded.value = true;
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

async function loadPendingShipments(): Promise<void> {
  const c = pendingClient.value;
  if (!c) return;
  pendingShipmentsBusy.value = true;
  try {
    const r = await warehouseApi.pendingShipments(c.id_cliente, pendingDays.value);
    pendingShipments.value = r.shipments;
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    pendingShipmentsBusy.value = false;
  }
}

function openPendingClient(c: PendingClient): void {
  pendingClient.value = c;
  pendingShipments.value = [];
  void loadPendingShipments();
}

/** Carga el envío en la vista de escaneo (completitud + bultos). */
async function openPendingShipment(s: PendingShipment): Promise<void> {
  pendingClient.value = null;
  code.value = "";
  assocShipment.value = "";
  emergency.value = false;
  completeness.value = null;
  result.value = {
    found: true,
    source: "spedizioni_colli",
    parcel: { id_spedizione: s.id } as unknown as Parcel,
  };
  view.value = "all";
  await loadCompleteness(s.id);
}

async function printPending(s: PendingShipment): Promise<void> {
  await print(s.id);
  await loadPendingShipments();
  void loadPending();
}

async function print(id: number | null = shipmentId.value): Promise<void> {
  if (!id) return;
  busy.value = true;
  try {
    await printWaybill(id);
    const parcels = await warehouseApi.shipmentParcels(id);
    const ids = parcels.map((p) => Number(p.id)).filter((n) => n > 0);
    if (ids.length) await warehouseApi.markPrinted(ids);
    toast.push("success", t("warehouse.docpack.printed"));
    if (id === shipmentId.value) await loadCompleteness(id);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.docpack.print_failed")));
  } finally {
    busy.value = false;
  }
}

async function showAssociations(): Promise<void> {
  if (!shipmentId.value) return;
  try {
    assocParcels.value = await warehouseApi.shipmentParcels(shipmentId.value);
    assocOpen.value = true;
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  }
}

async function associate(): Promise<void> {
  const orphanId = result.value?.parcel?.id;
  const sid = Number(assocShipment.value);
  if (!orphanId || !Number.isInteger(sid) || sid <= 0) {
    toast.push("warning", t("warehouse.docpack.shipment_invalid"));
    return;
  }
  busy.value = true;
  try {
    const c = await warehouseApi.completeness(sid);
    if (c.status === "not_found") {
      toast.push("warning", t("warehouse.docpack.shipment_not_found"));
      return;
    }
    await warehouseApi.associate(Number(orphanId), sid);
    toast.push("success", t("warehouse.docpack.associated"));
    await scan(code.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
  } finally {
    busy.value = false;
  }
}

async function autoMatch(): Promise<void> {
  const sid = Number(assocShipment.value);
  if (!Number.isInteger(sid) || sid <= 0) {
    toast.push("warning", t("warehouse.docpack.shipment_invalid"));
    return;
  }
  busy.value = true;
  try {
    await warehouseApi.autoMatch(sid);
    toast.push("success", t("warehouse.docpack.auto_done"));
    await scan(code.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
  } finally {
    busy.value = false;
  }
}

async function loadOrphans(): Promise<void> {
  busy.value = true;
  try {
    const r = await warehouseApi.listOrphans(orphanPage.value, 20, orphanFilter.value);
    orphans.value = r.items;
    orphanTotal.value = r.total;
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

async function loadDay(): Promise<void> {
  busy.value = true;
  try {
    dayItems.value = await warehouseApi.completenessByDate(date.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

watch(view, (v) => {
  if (v === "pending") void loadPending();
  else if (v === "orphans") void loadOrphans();
  else if (v === "weighed" || v === "unweighed") void loadDay();
  else focusScan();
});
watch(pendingDays, () => {
  if (view.value === "pending") {
    void loadPending();
    void loadPendingShipments();
  }
});
watch(date, () => {
  if (view.value === "weighed" || view.value === "unweighed") void loadDay();
});
onMounted(() => {
  if (view.value === "pending") void loadPending();
  else focusScan();
});
</script>

<template>
  <div class="wh-page">
    <h1 class="text-h6 mb-4">{{ t("warehouse.docpack.title") }}</h1>
    <v-alert v-if="!canWrite" type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("warehouse.common.read_only") }}
    </v-alert>

    <v-btn-toggle v-model="view" mandatory divided class="mb-4">
      <v-btn value="pending">{{ t("warehouse.docpack.view_pending") }}</v-btn>
      <v-btn value="all">{{ t("warehouse.docpack.view_all") }}</v-btn>
      <v-btn value="orphans">{{ t("warehouse.docpack.view_orphans") }}</v-btn>
      <v-btn value="weighed">{{ t("warehouse.docpack.view_weighed") }}</v-btn>
      <v-btn value="unweighed">{{ t("warehouse.docpack.view_unweighed") }}</v-btn>
    </v-btn-toggle>

    <!-- Pendientes por cliente -->
    <template v-if="view === 'pending'">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ t("warehouse.docpack.pending_hint") }}
      </div>
      <div class="d-flex flex-wrap ga-2 align-center mb-3">
        <v-text-field
          v-model="pendingFilter"
          :label="t('warehouse.docpack.pending_search')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          style="max-width: 280px"
        />
        <v-select
          v-model="pendingDays"
          :items="pendingDaysItems"
          :label="t('warehouse.docpack.pending_days')"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 130px"
        />
        <v-btn
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="busy"
          @click="loadPending"
          >{{ t("warehouse.docpack.pending_refresh") }}</v-btn
        >
      </div>
      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-chip size="small"
          >{{ t("warehouse.docpack.pending_customers") }}:
          {{ pendingTotals.customers }}</v-chip
        >
        <v-chip size="small"
          >{{ t("warehouse.docpack.pending_shipments") }}:
          {{ pendingTotals.shipments }}</v-chip
        >
        <v-chip size="small" :color="pendingTotals.unweighed > 0 ? 'warning' : undefined"
          >{{ t("warehouse.docpack.pending_unweighed") }}:
          {{ pendingTotals.unweighed }}</v-chip
        >
      </div>
      <v-progress-linear v-if="busy" indeterminate />
      <div
        v-if="!busy && pendingLoaded && !pendingRows.length"
        class="text-medium-emphasis"
      >
        {{ t("warehouse.docpack.pending_empty") }}
      </div>
      <v-table v-else-if="pendingRows.length" density="compact" hover>
        <thead>
          <tr>
            <th>{{ t("warehouse.docpack.pending_customer") }}</th>
            <th>{{ t("warehouse.docpack.pending_shipments") }}</th>
            <th>{{ t("warehouse.docpack.pending_parcels") }}</th>
            <th>{{ t("warehouse.docpack.pending_unweighed") }}</th>
            <th>{{ t("warehouse.docpack.pending_unprinted") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in pendingRows"
            :key="c.id_cliente"
            style="cursor: pointer"
            @click="openPendingClient(c)"
          >
            <td>{{ c.rag_soc }}</td>
            <td>{{ c.shipments }}</td>
            <td>{{ c.parcels }}</td>
            <td :class="{ 'text-warning': c.unweighed > 0 }">{{ c.unweighed }}</td>
            <td>{{ c.unprinted }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>

    <!-- Escaneo -->
    <template v-else-if="view === 'all'">
      <v-text-field
        ref="scanInput"
        v-model="code"
        :label="t('warehouse.weighing.marker')"
        :hint="t('warehouse.weighing.marker_hint')"
        persistent-hint
        autofocus
        variant="outlined"
        prepend-inner-icon="mdi-barcode-scan"
        :loading="busy"
        class="mb-3"
        @keyup.enter="scan()"
      />

      <v-card v-if="result" variant="outlined" class="mb-3">
        <v-card-text>
          <v-alert
            v-if="!result.found"
            type="warning"
            variant="tonal"
            density="compact"
          >
            {{ t("warehouse.weighing.not_found") }}
          </v-alert>
          <template v-else>
            <div class="text-subtitle-1">
              {{ t("warehouse.docpack.parcel") }} {{ code }}
              <v-chip
                v-if="result.source === 'orphan'"
                size="x-small"
                color="warning"
                class="ml-2"
                >{{ t("warehouse.weighing.orphan_tag") }}</v-chip
              >
            </div>
            <div class="text-body-2 text-medium-emphasis">
              <span v-if="shipmentId"
                >{{ t("warehouse.docpack.shipment") }} #{{ shipmentId }} ·
              </span>
              {{ result.parcel?.peso ?? "-" }} kg
            </div>

            <!-- Huérfano: asociar -->
            <div v-if="result.source === 'orphan'" class="mt-3">
              <div class="text-caption mb-1">
                {{ t("warehouse.docpack.associate_hint") }}
              </div>
              <div class="d-flex ga-2 align-center">
                <v-text-field
                  v-model="assocShipment"
                  :label="t('warehouse.docpack.shipment_id')"
                  inputmode="numeric"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="max-width: 220px"
                  @keyup.enter="associate"
                />
                <v-btn
                  color="primary"
                  :disabled="!canWrite || busy"
                  @click="associate"
                  >{{ t("warehouse.docpack.associate") }}</v-btn
                >
                <v-btn
                  variant="tonal"
                  :disabled="!canWrite || busy"
                  @click="autoMatch"
                  >{{ t("warehouse.docpack.auto_match") }}</v-btn
                >
              </div>
            </div>

            <!-- Completitud -->
            <div v-if="completeness" class="mt-3">
              <v-chip
                :color="completeness.status === 'complete' ? 'success' : 'warning'"
                size="small"
                class="mr-2"
                >{{ t(`warehouse.docpack.status_${completeness.status}`) }}</v-chip
              >
              <span class="text-body-2">
                {{
                  t("warehouse.docpack.weighed_of", {
                    w: completeness.colli_weighed ?? 0,
                    n: completeness.colli_total ?? 0,
                  })
                }}
                ·
                {{
                  t("warehouse.docpack.expected", {
                    n: completeness.colli_expected ?? 0,
                  })
                }}
              </span>
              <v-alert
                v-if="unweighed > 0"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                {{ t("warehouse.docpack.unweighed_warning", { n: unweighed }) }}
              </v-alert>
            </div>
          </template>
        </v-card-text>
      </v-card>

      <v-checkbox
        v-model="emergency"
        :label="t('warehouse.docpack.emergency')"
        density="compact"
        hide-details
        :disabled="!canWrite"
      />
      <div class="d-flex flex-wrap ga-2 mt-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-printer"
          :disabled="!printEnabled"
          :loading="busy"
          @click="print()"
          >{{ t("warehouse.docpack.print") }}</v-btn
        >
        <v-btn variant="tonal" prepend-icon="mdi-refresh" :disabled="!code" @click="reload">{{
          t("warehouse.docpack.reload")
        }}</v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-skip-next" @click="skip">{{
          t("warehouse.docpack.skip")
        }}</v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-link-variant"
          :disabled="!shipmentId"
          @click="showAssociations"
          >{{ t("warehouse.docpack.associations") }}</v-btn
        >
      </div>
      <div v-if="result?.found && !shipmentId && result.source !== 'orphan'" class="text-caption mt-2">
        {{ t("warehouse.docpack.print_needs_shipment") }}
      </div>
    </template>

    <!-- Huérfanos -->
    <template v-else-if="view === 'orphans'">
      <div class="d-flex ga-2 mb-3">
        <v-text-field
          v-model="orphanFilter"
          :label="t('warehouse.docpack.filter_marker')"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 260px"
          @keyup.enter="orphanPage = 1; loadOrphans()"
        />
        <v-btn variant="tonal" @click="orphanPage = 1; loadOrphans()">{{
          t("warehouse.common.search")
        }}</v-btn>
      </div>
      <v-progress-linear v-if="busy" indeterminate />
      <div v-if="!busy && !orphans.length" class="text-medium-emphasis">
        {{ t("warehouse.docpack.no_orphans") }}
      </div>
      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t("warehouse.weighing.marker") }}</th>
            <th>kg</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orphans" :key="o.id">
            <td>{{ o.sticker ?? o.segnacollo ?? o.id }}</td>
            <td>{{ o.peso ?? "-" }}</td>
            <td>
              <v-btn
                size="x-small"
                variant="text"
                @click="view = 'all'; scan(String(o.sticker ?? o.segnacollo ?? ''))"
                >{{ t("warehouse.docpack.open") }}</v-btn
              >
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-pagination
        v-if="orphanTotal > 20"
        v-model="orphanPage"
        :length="Math.ceil(orphanTotal / 20)"
        density="compact"
        @update:model-value="loadOrphans"
      />
    </template>

    <!-- Multibulto pesados / sin pesar -->
    <template v-else>
      <v-text-field
        v-model="date"
        type="date"
        :label="t('warehouse.common.date')"
        variant="outlined"
        density="compact"
        hide-details
        class="mb-3"
        style="max-width: 200px"
      />
      <v-progress-linear v-if="busy" indeterminate />
      <div v-if="!busy && !multiRows.length" class="text-medium-emphasis">
        {{ t("warehouse.docpack.no_multiparcel") }}
      </div>
      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t("warehouse.docpack.shipment") }}</th>
            <th>{{ t("warehouse.docpack.col_expected") }}</th>
            <th>{{ t("warehouse.docpack.col_registered") }}</th>
            <th>{{ t("warehouse.docpack.col_weighed") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in multiRows" :key="r.id">
            <td>#{{ r.id }}</td>
            <td>{{ r.completeness.expected }}</td>
            <td>{{ r.completeness.colli_total }}</td>
            <td>{{ r.completeness.colli_weighed }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>

    <v-dialog v-model="clientsOpen" max-width="760">
      <v-card :title="t('warehouse.docpack.pending_shipments_of', { name: pendingClient?.rag_soc ?? '' })">
        <v-card-text>
          <v-checkbox
            v-model="emergency"
            :label="t('warehouse.docpack.emergency')"
            density="compact"
            hide-details
            :disabled="!canWrite"
          />
          <v-progress-linear v-if="pendingShipmentsBusy" indeterminate />
          <div
            v-else-if="!pendingShipments.length"
            class="text-medium-emphasis"
          >
            {{ t("warehouse.docpack.pending_empty") }}
          </div>
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th>{{ t("warehouse.docpack.pending_rif") }}</th>
                <th>{{ t("warehouse.docpack.pending_declared") }} / {{ t("warehouse.docpack.pending_registered") }}</th>
                <th>{{ t("warehouse.docpack.pending_weighed") }}</th>
                <th>{{ t("warehouse.docpack.pending_unprinted") }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in pendingShipments" :key="s.id">
                <td>
                  {{ s.RIF_cliente || "-" }}
                  <div class="text-caption text-medium-emphasis">#{{ s.id }}</div>
                </td>
                <td :class="{ 'text-warning': pendingNotComplete(s) }">
                  {{ s.declared_parcels }} / {{ s.parcels }}
                </td>
                <td :class="{ 'text-warning': pendingNotWeighed(s) }">
                  {{ s.weighed }}/{{ s.parcels }}
                </td>
                <td>{{ s.unprinted }}</td>
                <td class="text-no-wrap">
                  <v-btn size="x-small" variant="text" @click="openPendingShipment(s)">{{
                    t("warehouse.docpack.open")
                  }}</v-btn>
                  <v-btn
                    size="x-small"
                    variant="tonal"
                    prepend-icon="mdi-printer"
                    :disabled="
                      !canWrite ||
                      busy ||
                      !canPrintWaybill(pendingShipmentUnweighed(s), emergency)
                    "
                    @click="printPending(s)"
                    >{{ t("warehouse.docpack.print") }}</v-btn
                  >
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="clientsOpen = false">{{ t("warehouse.common.close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="assocOpen" max-width="520">
      <v-card :title="t('warehouse.docpack.associations')">
        <v-card-text>
          <div v-if="!assocParcels?.length">
            {{ t("warehouse.docpack.no_parcels") }}
          </div>
          <v-table v-else density="compact">
            <tbody>
              <tr v-for="p in assocParcels" :key="p.id">
                <td>#{{ p.n_collo ?? p.id }}</td>
                <td>{{ p.sticker ?? "" }}</td>
                <td>{{ p.peso ?? "-" }} kg</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="assocOpen = false">{{ t("warehouse.common.close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.wh-page {
  padding: 24px;
  max-width: 880px;
}
</style>
