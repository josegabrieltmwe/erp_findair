<template>
  <div class="pf-page">
    <!-- ── Filtros ─────────────────────────────────────────── -->
    <section class="pf-filters">
      <v-text-field
        v-model.number="local.id_spedizione"
        :label="t('proforma.proforma.shipmentId')"
        type="number"
        density="comfortable"
        clearable
        class="pf-filter-field"
        @keyup.enter="applyFilters"
      />
      <v-text-field
        v-model="local.date_from"
        :label="t('proforma.proforma.fromDate')"
        type="date"
        density="comfortable"
        clearable
        class="pf-filter-field"
      />
      <v-text-field
        v-model="local.date_to"
        :label="t('proforma.proforma.toDate')"
        type="date"
        density="comfortable"
        clearable
        class="pf-filter-field"
      />
      <div class="pf-filter-actions">
        <v-btn color="primary" :loading="store.loading" @click="applyFilters">
          {{ t("proforma.proforma.applyFilters") }}
        </v-btn>
        <v-btn variant="text" @click="clearFilters">{{
          t("proforma.proforma.clearFilters")
        }}</v-btn>
      </div>
    </section>

    <!-- ── Toolbar ─────────────────────────────────────────── -->
    <div class="pf-toolbar">
      <div class="pf-toolbar-title">
        <span class="pf-count">{{ store.total }}</span>
        <span class="pf-count-label">{{ t("proforma.proforma.title") }}</span>
      </div>
      <v-spacer />
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        @click="refresh"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ t("proforma.proforma.new") }}
      </v-btn>
    </div>

    <!-- ── Filtros activos (click-to-filter) ──────────────────── -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <!-- ── Tabla ───────────────────────────────────────────── -->
    <v-data-table
      :headers="headers"
      :items="store.items"
      :loading="store.loading"
      :no-data-text="t('common.noData')"
      item-value="id"
      class="pf-table"
      hover
    >
      <template #[`item.id_spedizione`]="{ item }">
        <button
          v-if="item.id_spedizione"
          type="button"
          class="filterable"
          :title="t('proforma.proforma.filterClick.byShipment')"
          @click.stop="setFilterFromCell('id_spedizione', item.id_spedizione)"
        >
          {{ item.id_spedizione }}
        </button>
        <span v-else>—</span>
      </template>

      <template #[`item.iso_paese_origine`]="{ item }">
        <button
          v-if="item.iso_paese_origine"
          type="button"
          class="filterable"
          :title="t('proforma.proforma.filterClick.byOrigin')"
          @click.stop="
            setFilterFromCell('iso_paese_origine', item.iso_paese_origine)
          "
        >
          {{ item.iso_paese_origine }}
        </button>
        <span v-else>—</span>
      </template>

      <template #[`item.motivo`]="{ item }">
        {{ item.motivo_descr || item.motivo || "—" }}
      </template>

      <template #[`item.id_valuta`]="{ item }">
        {{ item.currency_code || "—" }}
      </template>

      <template #[`item.actions`]="{ item }">
        <CmRowActions :actions="rowActions(item)" />
      </template>
    </v-data-table>

    <!-- ── Paginación ──────────────────────────────────────── -->
    <div v-if="pageCount > 1" class="pf-pagination">
      <v-pagination
        :model-value="store.page"
        :length="pageCount"
        :total-visible="7"
        density="comfortable"
        @update:model-value="goToPage"
      />
    </div>

    <!-- ── Diálogo crear/editar ────────────────────────────── -->
    <ProformaEditDialog
      v-model="dialogOpen"
      :proforma-id="editingId"
      @saved="onSaved"
    />

    <!-- ── Diálogo duplicar ────────────────────────────────── -->
    <v-dialog v-model="dupOpen" max-width="440">
      <v-card>
        <v-card-title>{{ t("proforma.proforma.duplicateTitle") }}</v-card-title>
        <v-card-text>
          <p class="pf-dup-hint">{{ t("proforma.proforma.duplicateHint") }}</p>
          <v-text-field
            v-model.number="dupTarget"
            :label="t('proforma.proforma.duplicateTarget')"
            type="number"
            :error-messages="dupError"
            density="comfortable"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dupOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn color="primary" :loading="store.saving" @click="runDuplicate">
            {{ t("proforma.proforma.duplicate") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { useProformaStore } from "../stores/proforma.store";
import ProformaEditDialog from "../components/ProformaEditDialog.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import CmRowActions, {
  type RowAction,
} from "@shared/anagrafiche/components/CmRowActions.vue";
import { mdiPencil, mdiContentCopy, mdiDeleteOutline } from "@mdi/js";
import type { ActiveFilter } from "@shared/listing/types";
import { emptyFilters, type Proforma, type ProformaFilters } from "../types";

const { t } = useI18n();

/** Acciones de fila: editar (visible) + duplicar/eliminar en kebab. */
function rowActions(item: Proforma): RowAction[] {
  return [
    {
      key: "edit",
      title: t("common.edit"),
      icon: mdiPencil,
      onClick: () => openEdit(item),
    },
    {
      key: "duplicate",
      title: t("proforma.proforma.duplicate"),
      icon: mdiContentCopy,
      onClick: () => openDuplicate(item),
    },
    {
      key: "delete",
      title: t("common.delete"),
      icon: mdiDeleteOutline,
      color: "error",
      divider: true,
      onClick: () => confirmDelete(item),
    },
  ];
}
const store = useProformaStore();
const toast = useToastStore();
const confirm = useConfirmStore();

const local = reactive<ProformaFilters>(emptyFilters());

const headers = computed(() => [
  { title: "ID", key: "id", width: 90 },
  { title: t("proforma.proforma.shipment"), key: "id_spedizione", width: 140 },
  { title: t("proforma.proforma.date"), key: "data", width: 120 },
  { title: t("proforma.proforma.reason"), key: "motivo", width: 160 },
  {
    title: t("proforma.proforma.origin"),
    key: "iso_paese_origine",
    width: 110,
  },
  { title: t("proforma.proforma.currency"), key: "id_valuta", width: 100 },
  { title: t("proforma.proforma.ref"), key: "RIF_cliente" },
  {
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end" as const,
    width: 150,
  },
]);

const pageCount = computed(() => store.pagination?.total_pages ?? 1);

// ── Diálogos ─────────────────────────────────────────────────
const dialogOpen = ref(false);
const editingId = ref<number | null>(null);
const dupOpen = ref(false);
const dupSource = ref<number | null>(null);
const dupTarget = ref<number | null>(null);
const dupError = ref<string[]>([]);

function applyFilters(): void {
  store.setFilters({ ...local });
  void store.fetchList();
}

function clearFilters(): void {
  Object.assign(local, emptyFilters());
  store.resetFilters();
  void store.fetchList();
}

// ── Click-to-filter ──────────────────────────────────────────
// Clicar un valor de celda lo fija en los filtros locales y recarga (AJAX).
// id_spedizione ya estaba soportado; iso_paese_origine se añadió al backend.
function setFilterFromCell(
  field: "id_spedizione" | "iso_paese_origine",
  value: number | string | null,
): void {
  if (value == null || value === "") return;
  if (field === "id_spedizione") local.id_spedizione = Number(value);
  else local.iso_paese_origine = String(value);
  applyFilters();
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  if (local.id_spedizione != null) {
    out.push({
      field: "id_spedizione",
      group: t("proforma.proforma.shipment") as string,
      value: String(local.id_spedizione),
    });
  }
  if (local.iso_paese_origine) {
    out.push({
      field: "iso_paese_origine",
      group: t("proforma.proforma.origin") as string,
      value: local.iso_paese_origine,
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "id_spedizione") local.id_spedizione = null;
  else if (field === "iso_paese_origine") local.iso_paese_origine = null;
  applyFilters();
}

function goToPage(p: number): void {
  store.setPage(p);
  void store.fetchList();
}

function refresh(): void {
  void store.fetchList();
}

function openCreate(): void {
  editingId.value = null;
  dialogOpen.value = true;
}

function openEdit(item: Proforma): void {
  editingId.value = Number(item.id);
  dialogOpen.value = true;
}

function onSaved(mode: "created" | "updated"): void {
  toast.success(t(`proforma.proforma.messages.${mode}`));
}

function openDuplicate(item: Proforma): void {
  dupSource.value = Number(item.id);
  dupTarget.value = null;
  dupError.value = [];
  dupOpen.value = true;
}

async function runDuplicate(): Promise<void> {
  if (!dupTarget.value || dupTarget.value <= 0) {
    dupError.value = [t("proforma.proforma.validation.targetRequired")];
    return;
  }
  if (!dupSource.value) return;
  await store.duplicate(dupSource.value, dupTarget.value);
  dupOpen.value = false;
  toast.success(t("proforma.proforma.messages.duplicated"));
}

async function confirmDelete(item: Proforma): Promise<void> {
  const ok = await confirm.ask({
    title: t("common.delete"),
    message: t("proforma.proforma.messages.deleteConfirm"),
    confirmLabel: t("common.delete"),
    variant: "danger",
  });
  if (!ok) return;
  await store.remove(Number(item.id));
  toast.success(t("proforma.proforma.messages.deleted"));
}

onMounted(() => {
  void store.fetchList();
});
</script>

<style scoped>
.pf-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pf-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.pf-filter-field {
  max-width: 200px;
  flex: 1 1 160px;
}
.pf-filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.pf-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pf-toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.pf-count {
  font-size: 1.4rem;
  font-weight: 700;
}
.pf-count-label {
  color: var(--cm-text-secondary, #64748b);
}
.pf-row-actions {
  display: flex;
  justify-content: flex-end;
}
/* Valor clicable-para-filtrar: texto normal hasta hover/focus. Patrón cargo. */
.filterable {
  display: inline-block;
  max-width: 100%;
  padding: 0 2px;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition:
    color 0.12s,
    background 0.12s,
    box-shadow 0.12s;
}
.filterable:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.08);
}
.filterable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
.pf-pagination {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.pf-dup-hint {
  margin-bottom: 16px;
  color: var(--cm-text-secondary, #64748b);
  font-size: 0.9rem;
}
</style>
