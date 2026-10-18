<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-merge" size="18" class="me-2" />
      {{ t("cargo.consolidation.title") }}
      <v-chip size="x-small" color="primary" variant="tonal" class="ms-2">
        {{ agg.house_count }}
      </v-chip>
      <v-spacer />
      <div class="text-caption text-medium-emphasis">
        {{ t("cargo.consolidation.chargeable_total") }}:
        <strong>{{ formatKg(agg.chargeable_tot) }}</strong>
        · {{ agg.colli_tot }} {{ t("cargo.consolidation.pieces") }}
      </div>
    </v-card-title>
    <v-divider />

    <!-- Attach an existing express shipment -->
    <div class="px-4 py-3 d-flex align-center ga-2">
      <v-autocomplete
        :model-value="null"
        :items="mergedItems"
        :loading="searching"
        :search="search"
        item-title="label"
        item-value="id"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        :label="t('cargo.consolidation.attach_label')"
        :no-data-text="t('cargo.consolidation.attach_no_data')"
        :hint="t('cargo.consolidation.attach_scope_hint')"
        persistent-hint
        prepend-inner-icon="mdi-magnify"
        @update:search="onSearch"
        @update:model-value="onPick"
      />
    </div>
    <v-divider />

    <v-data-table
      :headers="headers"
      :items="houses"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      :loading="loading"
    >
      <!-- The express id opens its shipment detail (same target as
           CargoLinkedExpressBox): from the consolidation list the operator
           needs to jump to the house, not just read its number. -->
      <template #item.id_spediz="{ item }">
        <a
          :href="shipmentHref(item.id_spediz)"
          class="cons-link d-inline-flex align-center ga-1"
          :title="t('cargo.consolidation.open_express')"
        >
          #{{ item.id_spediz }}
          <v-icon icon="mdi-open-in-new" size="13" />
        </a>
      </template>
      <template #item.peso_real="{ item }">
        <span class="text-right d-block">{{ formatKg(item.peso_real) }}</span>
      </template>
      <template #item.chargeable="{ item }">
        <span class="text-right d-block">{{ formatKg(item.chargeable) }}</span>
      </template>
      <template #item.status="{ item }">
        <v-chip
          v-if="isIncomplete(item.id_spediz)"
          size="x-small"
          color="warning"
          variant="tonal"
          prepend-icon="mdi-alert-outline"
          :title="t('cargo.consolidation.incomplete_hint')"
        >
          {{ t("cargo.consolidation.incomplete") }}
        </v-chip>
        <v-chip v-else size="x-small" color="success" variant="tonal">
          {{ t("cargo.consolidation.complete") }}
        </v-chip>
      </template>
      <template #item.actions="{ item }">
        <v-btn
          v-if="isIncomplete(item.id_spediz)"
          icon="mdi-file-multiple-outline"
          size="small"
          variant="text"
          density="comfortable"
          :title="t('cargo.consolidation.open_hawb')"
          @click="ui.openModal('hawb_list')"
        />
        <v-btn
          icon="mdi-link-variant-off"
          size="small"
          variant="text"
          color="error"
          density="comfortable"
          :title="t('cargo.consolidation.detach')"
          :loading="busyId === item.id_spediz"
          @click="onDetach(item.id_spediz)"
        />
      </template>
      <template #no-data>
        <div class="py-6 text-center text-medium-emphasis text-body-2">
          {{ t("cargo.consolidation.empty") }}
        </div>
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { detailHref } from "@shared/platform/navTargets";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import {
  consolidationService,
  type ConsolidationHouseAgg,
  type ConsolidationAggregate,
  type ConsolidationHouseRow,
  type AttachableShipment,
} from "@cargo/services/consolidation.service";

const { t } = useI18n();
const cargo = useCargoStore();
const ui = useUiStore();
const { id } = storeToRefs(cargo);

const loading = ref(false);
const searching = ref(false);
const busyId = ref<number | null>(null);
const search = ref("");

const houses = ref<ConsolidationHouseAgg[]>([]);
/** Casas completas del servidor, por id de expedición: de ahí sale «incompleta». */
const houseRows = ref<Map<number, ConsolidationHouseRow>>(new Map());
const agg = reactive<ConsolidationAggregate>({
  cargo_id: 0,
  house_count: 0,
  peso_real_tot: 0,
  chargeable_tot: 0,
  colli_tot: 0,
  houses: [],
});

// Remote autocomplete: keep a one-way :model-value and a plain merged-items
// list so Vuetify never resets the selection when items change (project rule
// feedback_vuetify_autocomplete_remote).
interface PickItem {
  id: number;
  label: string;
}
const remoteItems = ref<PickItem[]>([]);
const mergedItems = computed<PickItem[]>(() => remoteItems.value);

const headers = computed(() => [
  { title: t("cargo.consolidation.col_express"), key: "id_spediz", width: 160 },
  {
    title: t("cargo.consolidation.col_weight"),
    key: "peso_real",
    width: 120,
    align: "end" as const,
  },
  {
    title: t("cargo.consolidation.col_chargeable"),
    key: "chargeable",
    width: 140,
    align: "end" as const,
  },
  {
    title: t("cargo.consolidation.col_pieces"),
    key: "colli",
    width: 90,
    align: "end" as const,
  },
  {
    title: t("cargo.consolidation.col_status"),
    key: "status",
    width: 130,
    sortable: false,
  },
  {
    title: "",
    key: "actions",
    width: 104,
    sortable: false,
    align: "end" as const,
  },
]);

/**
 * Detail URL of an express shipment — same target the linked-express box uses,
 * so both entry points land on the shipment SPA.
 */
function shipmentHref(spedizId: number | string): string {
  return detailHref("shipment", spedizId);
}

function formatKg(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return `${n.toFixed(2)} kg`;
}

/** La casa nace vacía al adjuntar (remitente/consignatario se rellenan en el HAWB). */
function isIncomplete(spedizId: number | string): boolean {
  const h = houseRows.value.get(Number(spedizId));
  return !h || !h.shipper_nome || !h.consignee_nome;
}

function cargoId(): number {
  return Number(id.value || 0);
}

async function reload(): Promise<void> {
  if (!cargoId()) return;
  loading.value = true;
  try {
    const view = await consolidationService.get(cargoId());
    houses.value = view.aggregate.houses ?? [];
    houseRows.value = new Map(
      (view.houses ?? []).map((h) => [Number(h.id_spediz), h]),
    );
    Object.assign(agg, view.aggregate);
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearch(q: string): void {
  search.value = q;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void doSearch(q), 250);
}

async function doSearch(q: string): Promise<void> {
  if (!cargoId()) return;
  searching.value = true;
  try {
    const { items } = await consolidationService.attachable(cargoId(), q);
    remoteItems.value = items.map((s: AttachableShipment) => ({
      id: Number(s.id),
      label: labelOf(s),
    }));
  } finally {
    searching.value = false;
  }
}

function labelOf(s: AttachableShipment): string {
  const rif = s.RIF_cliente ? ` · ${s.RIF_cliente}` : "";
  return `#${s.id}${rif} · ${Number(s.peso).toFixed(1)}kg · ${s.colli}c`;
}

async function onPick(spedizId: number | null): Promise<void> {
  if (!spedizId || !cargoId()) return;
  try {
    await consolidationService.attach(cargoId(), Number(spedizId));
    remoteItems.value = [];
    search.value = "";
    await reload();
  } catch {
    // http client surfaces the error toast/event globally.
  }
}

async function onDetach(spedizId: number): Promise<void> {
  if (!cargoId()) return;
  busyId.value = spedizId;
  try {
    await consolidationService.detach(cargoId(), Number(spedizId));
    await reload();
  } finally {
    busyId.value = null;
  }
}

onMounted(reload);
</script>

<style scoped>
/* Link reads as a link on hover but doesn't shout in a dense table. */
.cons-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  font-weight: 500;
}
.cons-link:hover {
  text-decoration: underline;
}
</style>
