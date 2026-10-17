<template>
  <div class="aging-page">
    <div class="aging-toolbar">
      <v-btn variant="text" icon="mdi-arrow-left" :to="{ name: 'payments' }" />
      <h1 class="text-h6 mb-0">{{ t("payments.aging.title") }}</h1>
      <v-spacer />
      <div class="aging-customer">
        <CustomerPicker
          :model-value="store.customerId"
          :label="t('payments.list.customer')"
          @update:model-value="store.setCustomer"
        />
      </div>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        @click="store.load()"
      />
    </div>

    <v-progress-linear v-if="store.loading" indeterminate />
    <v-alert v-if="store.error" type="error" variant="tonal" density="compact">
      {{ t("payments.list.load_failed") }}
    </v-alert>

    <template v-if="store.data">
      <v-row>
        <v-col cols="12" sm="6">
          <v-card variant="tonal" color="primary" class="pa-4 text-center">
            <div class="text-caption mb-1">
              {{ t("payments.aging.total_outstanding") }}
            </div>
            <div class="text-h5">
              {{ money(store.data.summary.total_outstanding) }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card variant="tonal" color="error" class="pa-4 text-center">
            <div class="text-caption mb-1">
              {{ t("payments.aging.total_overdue") }}
            </div>
            <div class="text-h5">
              {{ money(store.data.summary.total_overdue) }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col v-for="b in bandList" :key="b.key" cols="6" md="3">
          <v-card
            variant="outlined"
            class="pa-4 aging-band"
            :class="{ 'aging-band--empty': !b.count }"
            @click="goToList(b)"
          >
            <div class="text-caption text-medium-emphasis">
              {{ t(`payments.aging.band_${b.key}`) }}
            </div>
            <div class="text-h6 mt-1">{{ money(b.amount) }}</div>
            <div class="text-caption">
              {{ t("payments.aging.count", { count: b.count }) }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-card variant="flat" class="aging-card">
        <v-card-title class="text-subtitle-1">{{
          t("payments.aging.by_customer")
        }}</v-card-title>
        <v-divider />
        <v-data-table
          :headers="customerHeaders"
          :items="store.data.by_customer"
          :items-per-page="25"
          :no-data-text="t('payments.list.empty')"
          density="comfortable"
          hover
          class="aging-table"
          @click:row="onCustomerRow"
        >
          <template #[`item.total`]="{ item }">{{
            money(item.total)
          }}</template>
          <template #[`item.overdue`]="{ item }">
            <span
              :class="{ 'text-error font-weight-medium': item.overdue > 0 }"
              >{{ money(item.overdue) }}</span
            >
          </template>
        </v-data-table>
      </v-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAgingStore } from "../stores/aging.store";
import CustomerPicker from "../components/CustomerPicker.vue";
import { agingBandQuery } from "../components/agingBands";
import type { AgingBandKey, AgingCustomerRow } from "../types";

const { t } = useI18n();
const router = useRouter();
const store = useAgingStore();

const BANDS: { key: AgingBandKey }[] = [
  { key: "0_30" },
  { key: "31_60" },
  { key: "61_90" },
  { key: "90_plus" },
];

const bandList = computed(() =>
  BANDS.map((b) => ({
    ...b,
    count: Number(store.data?.bands?.[b.key]?.count ?? 0),
    amount: Number(store.data?.bands?.[b.key]?.amount ?? 0),
  })),
);

const customerHeaders = computed(() => [
  { title: t("payments.col.customer"), key: "rag_soc" },
  { title: t("payments.aging.col_total"), key: "total", align: "end" as const },
  {
    title: t("payments.aging.col_overdue"),
    key: "overdue",
    align: "end" as const,
  },
]);

function money(v: number | string): string {
  return Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Abre el listado de cuotas abiertas del tramo (mismo criterio que el informe). */
function goToList(band: { key: AgingBandKey }): void {
  const query: Record<string, string> = {
    statop: "O",
    view: "credit",
    ...agingBandQuery(band.key),
  };
  if (store.customerId) query.customer = String(store.customerId);
  void router.push({ name: "payments", query });
}

function onCustomerRow(_e: Event, ctx: { item: AgingCustomerRow }): void {
  goToCustomer(ctx.item);
}

function goToCustomer(c: AgingCustomerRow): void {
  void router.push({
    name: "payments",
    query: { customer: String(c.id_anagrafica), statop: "O", view: "credit" },
  });
}

onMounted(() => void store.load());
</script>

<style scoped>
.aging-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.aging-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.aging-customer {
  min-width: 260px;
}
.aging-band {
  cursor: pointer;
}
.aging-band--empty {
  opacity: 0.6;
}
.aging-card {
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}
.aging-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
