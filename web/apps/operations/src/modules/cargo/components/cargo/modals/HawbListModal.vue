<template>
  <ModalWrapper
    name="hawb_list"
    :title="t('cargo.modal.hawb_list')"
    icon="mdi-tag-multiple-outline"
    :max-width="900"
  >
    <div v-if="loading" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <div v-if="creating" class="d-flex align-center ga-2 pb-3">
        <v-autocomplete
          :model-value="null"
          :items="pickItems"
          :loading="searching"
          :search="search"
          item-title="label"
          item-value="id"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          autofocus
          :disabled="hawbStore.saving"
          :label="t('cargo.hawblist.pick_label')"
          :no-data-text="
            searchFailed
              ? t('cargo.hawblist.pick_failed')
              : t('cargo.hawblist.pick_no_data')
          "
          :hint="t('cargo.hawblist.pick_hint')"
          persistent-hint
          prepend-inner-icon="mdi-magnify"
          @update:search="onSearch"
          @update:model-value="onPick"
        />
        <v-btn variant="text" @click="closeCreate">{{
          t("common.cancel")
        }}</v-btn>
      </div>
      <div v-if="rows.length" class="hawb-listing">
        <ListingDataView
          :source="listSource"
          :headers="headers"
          :selected="[]"
          :mode="viewMode"
          :sort-key-map="sortKeyMap"
          :selectable="false"
        >
          <template #cell.awb_number="{ item }">
            <span class="metric-mono">{{
              (item as HawbRow).awb_number || "—"
            }}</span>
          </template>
          <!-- ListingDataView solo pinta las columnas que tienen plantilla `cell.<clave>`. -->
          <template #cell.id_spediz="{ item }">
            <span class="metric-mono">{{
              (item as HawbRow).id_spediz ? `#${(item as HawbRow).id_spediz}` : "—"
            }}</span>
          </template>
          <template #cell.shipper_name="{ item }">
            {{ (item as HawbRow).shipper_name || "—" }}
          </template>
          <template #cell.consignee_name="{ item }">
            {{ (item as HawbRow).consignee_name || "—" }}
          </template>
          <template #cell.pieces="{ item }">
            {{ (item as HawbRow).pieces }} ·
            {{ (item as HawbRow).weight.toFixed(2) }} kg
          </template>
          <template #cell.actions="{ item }">
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-printer"
              :title="t('cargo.hawblist.print_hawb')"
              @click.stop="printHawb(item as HawbRow)"
            />
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-pencil-outline"
              :title="t('cargo.hawb.edit')"
              @click.stop="openEdit(item as HawbRow)"
            />
          </template>
        </ListingDataView>
      </div>

      <EmptyState
        v-else
        icon="mdi-tag-off-outline"
        :title="t('cargo.hawblist.empty_title')"
        :text="t('cargo.hawblist.empty_text')"
      />
    </template>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-spacer />
      <v-btn
        variant="outlined"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="reload"
      >
        {{ t("common.refresh") }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        :disabled="!cargoId"
        @click="openCreate"
      >
        {{ t("cargo.hawblist.new_hawb") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { hawbService, type HawbRow } from "@cargo/services/hawb.service";
import { loadPickItems, type PickItem } from "@cargo/utils/hawbCandidates";
import { consolidationService } from "@cargo/services/consolidation.service";
import { cargoActionsService } from "@cargo/services/cargo_actions.service";
import { useCargoHawbStore } from "@cargo/stores/cargo_hawb.store";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const hawbStore = useCargoHawbStore();
const { id } = storeToRefs(cargoStore);

const cargoId = computed<number | null>(() => {
  if (!id.value) return null;
  const n = Number(id.value);
  return Number.isFinite(n) ? n : null;
});

const rows = ref<HawbRow[]>([]);
const loading = ref(false);

// Shared listing (client-side): this list is read-only, so sorting stays on.
const viewMode = useListViewMode("tmwe:hawb-list-view-mode", "paginated");
const listSource = useClientSideListSource<HawbRow>(() => rows.value, {
  loading: () => loading.value,
  mode: () => viewMode.value,
});
const sortKeyMap: Record<string, string> = {
  awb_number: "awb_number",
  id_spediz: "id_spediz",
  shipper_name: "shipper_name",
  consignee_name: "consignee_name",
};

const headers = computed(() => [
  { title: "AWB", key: "awb_number", sortable: true, width: 150 },
  {
    title: t("cargo.hawblist.col_spediz"),
    key: "id_spediz",
    sortable: true,
    width: 90,
  },
  { title: t("cargo.mawbv2.shipper"), key: "shipper_name", sortable: true },
  { title: t("cargo.mawbv2.consignee"), key: "consignee_name", sortable: true },
  {
    title: t("cargo.hawblist.col_pieces_weight"),
    key: "pieces",
    sortable: false,
    width: 140,
  },
  {
    title: "",
    key: "actions",
    sortable: false,
    width: 80,
    align: "end" as const,
  },
]);

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "hawb_list") void reload();
  },
);

async function reload(): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  try {
    rows.value = await hawbService.list(cargoId.value);
  } finally {
    loading.value = false;
  }
}

// Alta manual: un HAWB cuelga siempre de una expedición (el API exige id_spediz),
// asi que se elige la expedición y se crea la casa; despues se abre el formulario.
const creating = ref(false);
const searching = ref(false);
const search = ref("");
const pickItems = ref<PickItem[]>([]);
/** La búsqueda de candidatos falló (504, red…): se avisa y se sigue ofreciendo el número tecleado (P130). */
const searchFailed = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
/** La búsqueda tarda 13-18 s: una respuesta antigua no debe pisar la de una búsqueda posterior. */
let searchSeq = 0;

async function doSearch(q: string): Promise<void> {
  if (!cargoId.value) return;
  const id = cargoId.value;
  const seq = ++searchSeq;
  searching.value = true;
  // La lista del API solo trae expediciones del propio usuario; las de sus clientes no salen. Un número tecleado se
  // ofrece tal cual y el API valida el acceso al crear (P59). Si la búsqueda falla, el número se sigue ofreciendo.
  const r = await loadPickItems(
    async () => (await consolidationService.attachable(id, q)).items,
    q,
    (n) => t("cargo.hawblist.use_number", { id: n }),
  );
  if (seq !== searchSeq) return; // ya hay una búsqueda más reciente
  pickItems.value = r.items;
  searchFailed.value = r.failed;
  searching.value = false;
}

function onSearch(q: string): void {
  search.value = q ?? "";
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void doSearch(search.value), 250);
}

function openCreate(): void {
  creating.value = true;
  void doSearch("");
}

function closeCreate(): void {
  creating.value = false;
  search.value = "";
  pickItems.value = [];
  searchFailed.value = false;
  searchSeq++; // descarta la respuesta de una búsqueda aún en vuelo
  searching.value = false;
}

async function onPick(spedizId: number | null): Promise<void> {
  if (!spedizId || !cargoId.value) return;
  await hawbStore.load(cargoId.value);
  const created = await hawbStore.create(cargoId.value, {
    id_spediz: Number(spedizId),
  });
  if (!created) return; // el store ya muestra el error del servidor
  closeCreate();
  await reload();
  ui.openHawbFormModal(Number(created.id));
}

async function openEdit(row: HawbRow): Promise<void> {
  if (!cargoId.value) return;
  // HawbFormModal resolves the row from useCargoHawbStore().rows — the LIST
  // above is fed by hawbService (a different source), so that store may be
  // empty. Load it before opening, or the form stays on its skeleton
  // ("Editar HAWB did nothing").
  await hawbStore.load(cargoId.value);
  ui.openHawbFormModal(Number(row.id));
}
async function printHawb(row: HawbRow): Promise<void> {
  // Modern PDF path: GET /api_awb_documents?type=hawb&awb_id=… (replaces the
  // legacy spedyc_pdf_hawb.php). awb_id is required so the worker renders the
  // specific house AWB, not the master.
  if (!cargoId.value) return;
  await cargoActionsService.openPdfHawb(cargoId.value, Number(row.id));
}
</script>

<style scoped>
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}

/* Bound the shared listing to the modal and drop the record-link affordance
   (actions are explicit buttons, not a row click). */
.hawb-listing {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  min-height: 220px;
}
.hawb-listing :deep(.v-data-table__tr),
.hawb-listing :deep(.sdv-tr) {
  cursor: default;
}
</style>
