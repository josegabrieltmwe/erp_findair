<template>
  <v-card :border="!embedded" :flat="embedded" rounded="lg">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-table-edit" size="18" class="me-2" />
      {{ t("cargo.charges.title") }}
      <v-chip size="x-small" color="primary" variant="tonal" class="ms-2">
        {{ store.total }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-plus"
        @click="openAdd"
      >
        {{ t("cargo.charges.add_row") }}
      </v-btn>
    </v-card-title>
    <v-divider v-if="!embedded" />

    <!-- Embedded (tab) mode: header lives in the modal frame; keep just the
         "add row" action in a slim toolbar. -->
    <div v-if="embedded" class="d-flex align-center justify-end px-1 pb-2">
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-plus"
        @click="openAdd"
      >
        {{ t("cargo.charges.add_row") }}
      </v-btn>
    </div>

    <v-skeleton-loader v-if="store.loading" type="table-tbody" />

    <EmptyState
      v-else-if="!store.rows.length"
      icon="mdi-table-search"
      :title="t('cargo.charges.empty_title')"
      :text="t('cargo.charges.empty_text')"
      density="compact"
    />

    <!-- Shared listing component (same as the offers table and the anagrafica
         sub-lists) so the charge detail matches the project style. Inline
         editors + delete live in #cell.* slots; rows are not clickable. -->
    <div v-else class="charges-listing">
      <ListingDataView
        :source="listSource"
        :headers="headers"
        :selected="[]"
        :mode="viewMode"
        :sort-key-map="sortKeyMap"
        :selectable="false"
      >
        <template #cell.tipo="{ item }">
          <v-chip
            size="x-small"
            :color="tipoColor((item as CargoChargeRow).tipo)"
            variant="tonal"
          >
            {{ (item as CargoChargeRow).tipo }}
          </v-chip>
        </template>

        <template #cell.code="{ item }">
          <v-text-field
            :model-value="(item as CargoChargeRow).code"
            variant="plain"
            density="compact"
            hide-details
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: string) => onPatch((item as CargoChargeRow).id, { code: v })
            "
          />
        </template>

        <template #cell.nome="{ item }">
          <v-text-field
            :model-value="(item as CargoChargeRow).nome"
            variant="plain"
            density="compact"
            hide-details
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: string) => onPatch((item as CargoChargeRow).id, { nome: v })
            "
          />
        </template>

        <template #cell.costo_unit="{ item }">
          <v-text-field
            :model-value="(item as CargoChargeRow).costo_unit"
            type="number"
            variant="plain"
            density="compact"
            hide-details
            step="0.01"
            class="text-right"
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: string) =>
                onPatch((item as CargoChargeRow).id, { costo_unit: Number(v) })
            "
          />
        </template>

        <template #cell.costo_min="{ item }">
          <v-text-field
            :model-value="(item as CargoChargeRow).costo_min"
            type="number"
            variant="plain"
            density="compact"
            hide-details
            step="0.01"
            class="text-right"
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: string) =>
                onPatch((item as CargoChargeRow).id, { costo_min: Number(v) })
            "
          />
        </template>

        <template #cell.costo_max="{ item }">
          <v-text-field
            :model-value="(item as CargoChargeRow).costo_max"
            type="number"
            variant="plain"
            density="compact"
            hide-details
            step="0.01"
            class="text-right"
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: string) =>
                onPatch((item as CargoChargeRow).id, { costo_max: Number(v) })
            "
          />
        </template>

        <template #cell.somma="{ item }">
          <v-switch
            :model-value="(item as CargoChargeRow).somma === 'S'"
            density="compact"
            color="primary"
            hide-details
            inset
            class="d-inline-flex"
            :disabled="store.saving.has((item as CargoChargeRow).id)"
            @change="
              (v: boolean) =>
                onPatch((item as CargoChargeRow).id, { somma: v ? 'S' : 'N' })
            "
          />
        </template>

        <template #cell.actions="{ item }">
          <v-btn
            icon="mdi-trash-can-outline"
            size="small"
            variant="text"
            color="error"
            density="comfortable"
            :loading="store.saving.has((item as CargoChargeRow).id)"
            @click="confirmRemove(item as CargoChargeRow)"
          />
        </template>
      </ListingDataView>
    </div>

    <!-- Add dialog -->
    <v-dialog v-model="addOpen" max-width="520">
      <v-card>
        <v-card-title>{{ t("cargo.charges.add_dialog_title") }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="newRow.tipo"
            :label="t('cargo.col.type')"
            :items="tipoOptions"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-select
            v-model="newRow.type"
            :label="t('cargo.charges.unit')"
            :items="['kg', 'box', 'fix']"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model="newRow.code"
            :label="t('cargo.col.code')"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model="newRow.nome"
            :label="t('cargo.col.description')"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model.number="newRow.costo_unit"
            :label="t('cargo.col.unit_cost')"
            type="number"
            step="0.01"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <div class="d-flex ga-2 mb-2">
            <v-text-field
              v-model.number="newRow.costo_min"
              :label="t('cargo.charges.min')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
            <v-text-field
              v-model.number="newRow.costo_max"
              :label="t('cargo.charges.max')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
          </div>
          <v-switch
            v-model="newRowSomma"
            :label="t('cargo.charges.include_in_total')"
            color="primary"
            density="compact"
            hide-details
            inset
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="addOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            :loading="adding"
            @click="submitAdd"
          >
            {{ t("cargo.charges.add") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import { ref, watch, onMounted, reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoChargesStore } from "@cargo/stores/cargo_charges.store";
import type {
  CargoChargeRow,
  CargoChargeCreate,
  CargoChargePatch,
  CargoChargeTipo,
} from "@cargo/services/cargo_charges.types";

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const { t } = useI18n();
const cargo = useCargoStore();
const { id } = storeToRefs(cargo);
const store = useCargoChargesStore();

// Shared listing wiring (client-side rows, non-sortable — inline editors).
const headers = computed(() => [
  { title: t("cargo.col.type"), key: "tipo", sortable: false, width: 64 },
  { title: t("cargo.col.code"), key: "code", sortable: false, width: 96 },
  { title: t("cargo.col.description"), key: "nome", sortable: false },
  {
    title: t("cargo.col.unit_cost"),
    key: "costo_unit",
    sortable: false,
    width: 100,
    align: "end" as const,
  },
  {
    title: t("cargo.charges.min"),
    key: "costo_min",
    sortable: false,
    width: 96,
    align: "end" as const,
  },
  {
    title: t("cargo.charges.max"),
    key: "costo_max",
    sortable: false,
    width: 96,
    align: "end" as const,
  },
  {
    title: "Σ",
    key: "somma",
    sortable: false,
    width: 64,
    align: "center" as const,
  },
  {
    title: "",
    key: "actions",
    sortable: false,
    width: 52,
    align: "end" as const,
  },
]);
const sortKeyMap: Record<string, string> = {};
const viewMode = useListViewMode("tmwe:cargo-charges-view-mode", "infinite");
const listSource = useClientSideListSource<CargoChargeRow>(() => store.rows, {
  loading: () => store.loading,
  mode: () => viewMode.value,
});

const tipoOptions = computed<{ title: string; value: CargoChargeTipo }[]>(
  () => [
    { title: t("enums.charge_tipo.base_price"), value: "P" },
    { title: t("enums.charge_tipo.surcharge"), value: "S" },
    { title: t("enums.charge_tipo.currency"), value: "V" },
    { title: t("enums.charge_tipo.misc"), value: "M" },
  ],
);

function tipoColor(tipo: string): string {
  switch (tipo) {
    case "P":
      return "primary";
    case "S":
      return "amber";
    case "V":
      return "cyan";
    case "M":
      return "grey";
    default:
      return "grey";
  }
}

async function load(): Promise<void> {
  if (!id.value) return;
  await store.load(Number(id.value));
}

async function onPatch(
  item_id: number,
  patch: CargoChargePatch,
): Promise<void> {
  if (!id.value) return;
  await store.update(Number(id.value), item_id, patch);
}

async function confirmRemove(row: CargoChargeRow): Promise<void> {
  if (!id.value) return;
  if (
    !window.confirm(
      t("cargo.charges.remove_confirm", {
        name: row.nome || row.code || `#${row.id}`,
      }),
    )
  )
    return;
  await store.remove(Number(id.value), row.id);
}

// --- Add dialog ---
const addOpen = ref(false);
const adding = ref(false);
const newRow = reactive<CargoChargeCreate>({
  tipo: "S",
  type: "fix",
  code: "",
  nome: "",
  costo_unit: 0,
  costo_min: 0,
  costo_max: 0,
});
const newRowSomma = ref(true);

function openAdd(): void {
  Object.assign(newRow, {
    tipo: "S",
    type: "fix",
    code: "",
    nome: "",
    costo_unit: 0,
    costo_min: 0,
    costo_max: 0,
  });
  newRowSomma.value = true;
  addOpen.value = true;
}

async function submitAdd(): Promise<void> {
  if (!id.value) return;
  adding.value = true;
  try {
    const created = await store.create(Number(id.value), {
      ...newRow,
      somma: newRowSomma.value ? "S" : "N",
    });
    if (created) addOpen.value = false;
  } finally {
    adding.value = false;
  }
}

onMounted(load);
watch(id, load);
</script>

<style scoped lang="scss">
/* The shared ListingDataView owns the visual style. Here we only adapt it
   for an editable list inside a modal: bound the height for internal scroll
   and stop rows from reading as clickable records (inputs own the row). */
.charges-listing {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  min-height: 200px;
}

.charges-listing :deep(.sdv-tr) {
  cursor: default;
}
.charges-listing :deep(.sdv-tr:hover) {
  transform: none;
  box-shadow: none;
}

/* Keep the plain inline inputs compact within the shared cell padding. */
.charges-listing :deep(td .v-input) {
  --v-input-padding-top: 0;
  margin-top: 0;
}
.charges-listing :deep(td .v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: 28px;
}
</style>
