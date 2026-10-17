<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { pickupsService } from "../services/pickups.service";
import PickupEditDialog from "../components/PickupEditDialog.vue";
import type { Pickup, PickupFilters } from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

const items = ref<Pickup[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);

const filters = ref<PickupFilters>({
  data_da: new Date().toISOString().slice(0, 10),
  data_a: null,
  affidata: null,
  presa_fissa: null,
});

const editing = ref<Pickup | null>(null);
const dialogOpen = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await pickupsService.list(
      filters.value,
      page.value,
      perPage.value,
    );
    items.value = res.data;
    total.value = res.pagination.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  page.value = 1;
  load();
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(row: Pickup): void {
  editing.value = row;
  dialogOpen.value = true;
}

async function onSaved(): Promise<void> {
  dialogOpen.value = false;
  await load();
}

async function remove(row: Pickup): Promise<void> {
  const ok = await confirm.ask({
    title: t("pickup.list.delete_title"),
    message: t("pickup.list.delete_msg", { id: row.id }),
  });
  if (!ok) return;
  try {
    await pickupsService.remove(row.id);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  }
}

const headers = [
  { title: t("pickup.list.col.id"), key: "id", width: 70 },
  { title: t("pickup.list.col.data"), key: "data" },
  { title: t("pickup.list.col.sede"), key: "id_sede" },
  { title: t("pickup.list.col.autista"), key: "id_contatti" },
  { title: t("pickup.list.col.address"), key: "address_sped" },
  { title: t("pickup.list.col.colli"), key: "n_colli" },
  { title: t("pickup.list.col.peso"), key: "peso" },
  { title: t("pickup.list.col.fixed"), key: "presa_fissa" },
  { title: t("pickup.list.col.affidata"), key: "affidata" },
  { title: "", key: "actions", sortable: false, width: 110 },
];

onMounted(load);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.list.title") }}</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ t("pickup.list.new") }}
      </v-btn>
    </header>

    <div class="pk-filters">
      <v-text-field
        v-model="filters.data_da"
        :label="t('pickup.list.from')"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-text-field
        v-model="filters.data_a"
        :label="t('pickup.list.to')"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-select
        v-model="filters.affidata"
        :items="[
          { title: t('pickup.list.any'), value: null },
          { title: t('pickup.list.yes'), value: 'S' },
          { title: t('pickup.list.no'), value: 'N' },
        ]"
        :label="t('pickup.list.col.affidata')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 160px"
      />
      <v-btn variant="tonal" @click="applyFilters">{{
        t("pickup.list.filter")
      }}</v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <v-data-table-server
      :headers="headers"
      :items="items"
      :items-length="total"
      :loading="loading"
      :items-per-page="perPage"
      :page="page"
      density="compact"
      class="pk-table"
      @update:page="
        (p: number) => {
          page = p;
          load();
        }
      "
      @update:items-per-page="
        (n: number) => {
          perPage = n;
          load();
        }
      "
    >
      <template #[`item.address_sped`]="{ item }">
        {{
          item.address_sped === "S"
            ? t("pickup.list.triangulation")
            : t("pickup.list.at_sede")
        }}
      </template>
      <template #[`item.presa_fissa`]="{ item }">
        <v-chip v-if="item.presa_fissa === 'S'" size="x-small" color="info">{{
          t("pickup.list.fixed")
        }}</v-chip>
        <span v-else>—</span>
      </template>
      <template #[`item.affidata`]="{ item }">
        <v-chip
          size="x-small"
          :color="item.affidata === 'S' ? 'success' : 'default'"
        >
          {{
            item.affidata === "S" ? t("pickup.list.yes") : t("pickup.list.no")
          }}
        </v-chip>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          icon="mdi-pencil"
          size="x-small"
          variant="text"
          @click="openEdit(item)"
        />
        <v-btn
          icon="mdi-delete"
          size="x-small"
          variant="text"
          color="error"
          @click="remove(item)"
        />
      </template>
    </v-data-table-server>

    <PickupEditDialog v-model="dialogOpen" :pickup="editing" @saved="onSaved" />
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.pk-filters .v-text-field {
  max-width: 180px;
}
.pk-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
</style>
