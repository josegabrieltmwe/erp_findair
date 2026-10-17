<script setup lang="ts">
import { computed, onActivated, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useCrmStore } from "../stores/crm.store";
import type { CrmPratica, StatoPratica } from "../types";

const store = useCrmStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const indicatorLabel = computed(() => {
  if (store.filters.indicator === "overdue_followups")
    return t("crm.indicator.overdue_followups");
  if (store.filters.indicator === "open_cases")
    return t("crm.indicator.open_cases");
  return "";
});

const statoColor: Record<StatoPratica, string> = {
  A: "success",
  L: "warning",
  C: "grey",
};

/** Icono equivalente a st_open/st_limbo/st_close.png del legacy. */
const statoIcon: Record<StatoPratica, string> = {
  A: "mdi-folder-open-outline",
  L: "mdi-clock-outline",
  C: "mdi-folder-check-outline",
};

// Columnas en el mismo orden que crm_list.php:76-85.
const headers = computed(() => [
  { title: "ID", key: "id", width: 70 },
  { title: t("crm.list.cliente"), key: "id_anagrafica", width: 170 },
  { title: t("crm.list.oggetto"), key: "oggetto" },
  { title: t("crm.list.data_open"), key: "data_open", width: 110 },
  { title: t("crm.list.descriz"), key: "descriz" },
  { title: t("crm.list.contatto"), key: "id_contatto", width: 150 },
  { title: t("crm.list.data_next"), key: "data_next", width: 110 },
  {
    title: t("crm.list.stato"),
    key: "stato_pratica",
    width: 90,
    align: "center" as const,
  },
  {
    title: "",
    key: "actions",
    width: 60,
    sortable: false,
    align: "end" as const,
  },
]);

function statoLabel(s: StatoPratica): string {
  return t(`crm.stato.${s}`);
}

/** `2026-07-21 14:03:00` → `21/07/2026`, replicando CmpList(xformat=data). */
function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.slice(0, 10);
  if (!d || d === "0000-00-00") return "";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : "";
}

function truncate(v: string | null | undefined, max: number): string {
  if (!v) return "";
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/**
 * Legacy crm_list.php:99 — si no hay oggetto, cae a descriz truncado a 77.
 *
 * Y si tampoco hay descriz, el id: 86 de las 186 pratiche abiertas no tienen
 * ninguno de los dos y salían como una celda EN BLANCO, imposible de
 * identificar o de distinguir de la fila de al lado. El legacy tiene el mismo
 * hueco; aquí se cierra porque una fila sin identificador no es clicable con
 * criterio.
 */
function oggettoCell(item: CrmPratica): string {
  if (item.oggetto) return item.oggetto;
  const d = truncate(item.descriz, 77);
  return d !== "" ? d : `#${item.id}`;
}

/** rag_soc del JOIN; si falta, el id crudo como referencia. */
function clienteCell(item: CrmPratica): string {
  return item.cliente_rag_soc
    ? truncate(item.cliente_rag_soc, 25)
    : String(item.id_anagrafica ?? "");
}

function openDetail(_evt: unknown, row: { item: CrmPratica }): void {
  router.push({ name: "crm-detail", params: { id: String(row.item.id) } });
}

async function confirmRemove(item: CrmPratica): Promise<void> {
  if (!window.confirm(t("crm.list.delete_confirm", { id: item.id }))) return;
  await store.removePratica(item.id);
}

function refresh(): void {
  void store.applyFilters();
}

/** v-data-table-server emite page/itemsPerPage/sortBy en un solo evento. */
function onTableOptions(opts: {
  page: number;
  itemsPerPage: number;
  sortBy: { key: string; order?: "asc" | "desc" }[];
}): void {
  const next = opts.sortBy?.[0];
  const current = store.sort;
  const sortChanged =
    (next?.key ?? null) !== (current?.key ?? null) ||
    (next?.order ?? "asc") !== (current?.dir ?? "asc");

  if (sortChanged) {
    void store.setSort(
      next ? { key: next.key, dir: next.order ?? "asc" } : null,
    );
    return;
  }
  if (opts.itemsPerPage !== store.perPage) {
    void store.setPerPage(opts.itemsPerPage);
    return;
  }
  if (opts.page !== store.page) void store.setPage(opts.page);
}

async function applyRouteFilter(): Promise<void> {
  const indicator = String(route.query.indicator ?? "");
  if (indicator === "open_cases" || indicator === "overdue_followups") {
    // Deep-link explícito — siempre gana, incluso en un remount.
    store.filters = { stato_pratica: "A", indicator };
    store.shortcut = null;
    store.hasAppliedInitialFilters = true;
    await store.fetchList();
  } else if (route.query.ti) {
    await store.applyShortcut(route.query.ti);
    store.hasAppliedInitialFilters = true;
  } else if (!store.hasAppliedInitialFilters) {
    // Primera carga real de la sesión (sin ti/indicator en la URL) — mismo
    // default de siempre.
    store.filters = { stato_pratica: "A" };
    store.shortcut = null;
    store.hasAppliedInitialFilters = true;
    await store.fetchList();
  } else {
    // QW7: ya se habían aplicado filtros antes en esta sesión (p.ej. el
    // usuario tipeó una búsqueda y volvió de un detalle) — conservarlos y
    // solo refrescar los datos, en vez de pisarlos con el default.
    await store.fetchList();
  }
}

function clearIndicator(): void {
  const query = { ...route.query };
  delete query.indicator;
  void router.replace({ name: "crm-list", query });
}

// KeepAlive (ver OperationsShell.vue KEEP_ALIVE_INCLUDE): volver de un
// detalle ya no remonta la página, reactiva la instancia existente —
// `hasMountedOnce` evita que `onActivated` repita la carga en la activación
// inicial (Vue la dispara también justo después de `mounted`, la primera vez
// que un componente entra en un KeepAlive).
let hasMountedOnce = false;

onMounted(() => {
  hasMountedOnce = true;
  void store.fetchTypes();
  void applyRouteFilter();
});

onActivated(() => {
  if (!hasMountedOnce) return;
  void applyRouteFilter();
});

// URL = fuente de verdad: soporta navegación SPA, atrás/adelante y cambios de
// indicador sin depender de que Vue desmonte la página. Sin `immediate`: la
// primera carga ya corre desde `onMounted` arriba.
watch(
  () => [route.query.ti, route.query.indicator],
  () => void applyRouteFilter(),
);
</script>

<template>
  <div class="crm-list pa-4">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h5">{{ t("crm.list.title") }}</h2>
      <v-chip
        v-if="store.shortcut"
        class="ml-3"
        color="primary"
        size="small"
        label
        closable
        @click:close="store.applyFilters()"
      >
        {{ t(`crm.shortcut.${store.shortcut}`) }}
      </v-chip>
      <v-chip
        v-if="indicatorLabel"
        class="ml-3"
        color="primary"
        size="small"
        variant="tonal"
        label
        closable
        @click:close="clearIndicator"
      >
        {{ indicatorLabel }}
      </v-chip>
      <v-spacer />
    </div>

    <v-card>
      <v-card-text>
        <div class="d-flex flex-wrap ga-3 mb-2">
          <!--
            Único filtro sin auto-submit: buscar por cada tecla dispararía una
            petición por pulsación. Se confirma con Enter o con la lupa.
          -->
          <v-text-field
            v-model="store.filters.oggetto"
            :label="t('crm.list.search')"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 280px"
            @keyup.enter="refresh"
            @click:clear="refresh"
          >
            <template #append-inner>
              <v-icon
                icon="mdi-magnify"
                :title="t('crm.list.search')"
                style="cursor: pointer"
                @click="refresh"
              />
            </template>
          </v-text-field>
          <v-select
            v-model="store.filters.stato_pratica"
            :items="[
              { title: t('crm.stato.all'), value: '' },
              { title: t('crm.stato.A'), value: 'A' },
              { title: t('crm.stato.L'), value: 'L' },
              { title: t('crm.stato.C'), value: 'C' },
            ]"
            :label="t('crm.list.stato')"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 200px"
            @update:model-value="refresh"
          />
          <v-select
            v-model="store.filters.id_crm_tipo"
            :items="store.types"
            item-title="descr"
            item-value="id"
            :label="t('crm.list.tipo')"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 220px"
            @update:model-value="refresh"
          />
          <v-text-field
            v-model="store.filters.data_open_da"
            :label="t('crm.list.data_open_da')"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 180px"
            @update:model-value="refresh"
          />
          <v-text-field
            v-model="store.filters.data_open_al"
            :label="t('crm.list.data_open_al')"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 180px"
            @update:model-value="refresh"
          />
        </div>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="store.items"
        :items-length="store.total"
        :loading="store.loadingList"
        :page="store.page"
        :items-per-page="store.perPage"
        item-value="id"
        hover
        @click:row="openDetail"
        @update:options="onTableOptions"
      >
        <template #[`item.id_anagrafica`]="{ item }">
          <span :title="item.cliente_rag_soc ?? ''">{{
            clienteCell(item)
          }}</span>
        </template>

        <template #[`item.oggetto`]="{ item }">
          {{ oggettoCell(item) }}
        </template>

        <template #[`item.data_open`]="{ item }">
          {{ fmtDate(item.data_open) }}
        </template>

        <template #[`item.descriz`]="{ item }">
          <span :title="item.descriz ?? ''">{{
            truncate(item.descriz, 150)
          }}</span>
        </template>

        <template #[`item.id_contatto`]="{ item }">
          {{ item.sender_name || item.nome || "" }}
        </template>

        <template #[`item.data_next`]="{ item }">
          {{ fmtDate(item.data_next) }}
        </template>

        <template #[`item.stato_pratica`]="{ item }">
          <v-chip
            :color="statoColor[item.stato_pratica]"
            :title="statoLabel(item.stato_pratica)"
            size="small"
            label
          >
            <v-icon :icon="statoIcon[item.stato_pratica]" size="14" start />
            {{ statoLabel(item.stato_pratica) }}
          </v-chip>
        </template>

        <template #[`item.actions`]="{ item }">
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            density="comfortable"
            :title="t('common.delete')"
            @click.stop="confirmRemove(item)"
          />
        </template>
      </v-data-table-server>
    </v-card>
  </div>
</template>
