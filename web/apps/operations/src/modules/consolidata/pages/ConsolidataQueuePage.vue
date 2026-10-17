<template>
  <div class="cons-page">
    <div class="d-flex align-center justify-space-between">
      <h2 class="text-h6 mb-1">{{ t("consolidata.queue.title") }}</h2>
      <v-btn variant="tonal" prepend-icon="mdi-calculator-variant-outline" :to="{ name: 'consolidata-quote' }">
        {{ t("consolidata.quote.navLink") }}
      </v-btn>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ t("consolidata.queue.subtitle") }}
    </p>

    <ConsolidataApiError :error="store.error" @close="store.clearError()" />

    <section class="d-flex flex-wrap ga-3 align-center mb-3">
      <v-select
        v-model="local.stato"
        :items="stateItems"
        :label="t('consolidata.queue.filterState')"
        density="comfortable"
        hide-details
        style="max-width: 200px"
      />
      <v-select
        v-model="local.assegnato_a"
        :items="assigneeItems"
        :label="t('consolidata.queue.filterAssignee')"
        density="comfortable"
        hide-details
        style="max-width: 220px"
      />
      <v-text-field
        v-model.number="local.id_cliente"
        :label="t('consolidata.queue.filterClient')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        style="max-width: 180px"
        @keyup.enter="apply"
      />
      <v-btn color="primary" :loading="store.loading" @click="apply">{{
        t("consolidata.common.apply")
      }}</v-btn>
      <v-btn variant="text" @click="reset">{{
        t("consolidata.common.clear")
      }}</v-btn>
    </section>

    <v-table density="comfortable">
      <thead>
        <tr>
          <th>#</th>
          <th>{{ t("consolidata.queue.colTitle") }}</th>
          <th>{{ t("consolidata.queue.colClient") }}</th>
          <th>{{ t("consolidata.queue.colState") }}</th>
          <th class="text-right">{{ t("consolidata.queue.colTotal") }}</th>
          <th class="text-right">{{ t("consolidata.queue.colShipments") }}</th>
          <th>{{ t("consolidata.queue.colAssignee") }}</th>
          <th>{{ t("consolidata.queue.colUpdated") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="it in store.items"
          :key="it.id"
          class="cons-row"
          @click="open(it.id)"
        >
          <td>{{ it.id }}</td>
          <td>{{ it.titolo }}</td>
          <td>{{ it.cliente_nome || `#${it.id_cliente}` }}</td>
          <td>
            <v-chip size="small" :color="stateColor(it.stato)">{{
              t(stateI18nKey(it.stato))
            }}</v-chip>
            <v-chip
              v-if="it.risposta_at"
              size="x-small"
              class="ml-1"
              color="success"
              variant="tonal"
            >
              {{ t("consolidata.queue.answered") }}
            </v-chip>
          </td>
          <td class="text-right">{{ money(it.totale, it.valuta) }}</td>
          <td class="text-right">{{ it.n_spedizioni }}</td>
          <td>
            {{
              it.assegnato_a
                ? `#${it.assegnato_a}`
                : t("consolidata.queue.unassigned")
            }}
          </td>
          <td>{{ shortDate(it.modif_datetime) }}</td>
          <td class="text-right">
            <v-btn
              v-if="!it.assegnato_a"
              size="small"
              variant="tonal"
              :loading="takingId === it.id"
              @click.stop="takeAndOpen(it.id)"
            >
              {{ t("consolidata.actions.take") }}
            </v-btn>
          </td>
        </tr>
        <tr v-if="!store.loading && !store.items.length">
          <td colspan="9" class="text-center text-medium-emphasis py-6">
            {{ t("consolidata.queue.empty") }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <div class="d-flex justify-space-between align-center mt-3">
      <span class="text-body-2">{{
        t("consolidata.queue.total", { n: store.count })
      }}</span>
      <v-pagination
        v-model="pageModel"
        :length="store.maxPage"
        density="comfortable"
        total-visible="5"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "../components/ConsolidataApiError.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { shortDate, stateColor, stateI18nKey } from "../logic";
import { PROJECT_STATES, type QueueFilters } from "../types";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";

const { t } = useI18n();
const router = useRouter();
const store = useConsolidataStore();
const local = reactive<QueueFilters>({ ...store.filters });
const takingId = ref<number | null>(null);

const stateItems = computed(() => [
  { title: t("consolidata.queue.allStates"), value: "" },
  ...PROJECT_STATES.map((s) => ({ title: t(stateI18nKey(s)), value: s })),
]);
const assigneeItems = computed(() => [
  { title: t("consolidata.queue.assigneeAll"), value: "" },
  { title: t("consolidata.queue.assigneeMe"), value: "me" },
  { title: t("consolidata.queue.assigneeNone"), value: "none" },
]);

const pageModel = computed({
  get: () => store.page,
  set: (p: number) => {
    store.page = p;
    void store.fetchQueue();
  },
});

function money(v: number, cur: string): string {
  return `${v.toFixed(2)} ${cur}`;
}

function apply(): void {
  store.setFilters({ ...local, id_cliente: local.id_cliente || null });
  void store.fetchQueue();
}

function reset(): void {
  Object.assign(local, { stato: "P", assegnato_a: "", id_cliente: null });
  apply();
}

function open(id: number): void {
  void router.push({ name: "consolidata-detail", params: { id } });
}

async function takeAndOpen(id: number): Promise<void> {
  takingId.value = id;
  try {
    // La asignación la valida el API (already_assigned si otro se adelantó).
    await consolidataService.take(id);
    open(id);
  } catch (err) {
    await store.fetchQueue();
    if (err instanceof ConsolidataRequestError) store.error = err.info;
  } finally {
    takingId.value = null;
  }
}

onMounted(() => {
  void store.fetchQueue();
});
</script>

<style scoped>
.cons-page {
  padding: 16px;
}
.cons-row {
  cursor: pointer;
}
</style>
