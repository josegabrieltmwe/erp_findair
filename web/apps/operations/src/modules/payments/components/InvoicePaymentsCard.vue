<template>
  <v-card variant="flat" class="inv-pay-card">
    <v-card-title class="text-subtitle-1 d-flex align-center">
      <v-icon icon="mdi-cash-multiple" size="20" class="me-2" />
      {{ t("payments.invoice.title") }}
      <v-chip v-if="data" size="x-small" class="ms-2" variant="tonal">{{
        data.payments.length
      }}</v-chip>
    </v-card-title>
    <v-divider />
    <div v-if="loading" class="d-flex justify-center pa-6">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>
    <div v-else-if="failed" class="pa-4 text-medium-emphasis">
      {{ t("payments.invoice.load_failed") }}
    </div>
    <div
      v-else-if="data && !data.payments.length"
      class="pa-4 text-medium-emphasis"
    >
      {{ t("payments.invoice.empty") }}
    </div>
    <template v-else-if="data">
      <v-table density="comfortable">
        <thead>
          <tr>
            <th>{{ t("payments.col.due") }}</th>
            <th class="text-end">{{ t("payments.col.amount") }}</th>
            <th>{{ t("payments.col.method") }}</th>
            <th>{{ t("payments.col.status") }}</th>
            <th>{{ t("payments.col.closed") }}</th>
            <th v-if="canCollect"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in data.payments" :key="p.id">
            <td>{{ p.scadenza }}</td>
            <td class="text-end">{{ money(p.importo) }}</td>
            <td>{{ methodLabel(p.id_pagam_metodi) }}</td>
            <td>
              <v-chip
                :color="statusColor(statusOf(p))"
                size="small"
                label
                variant="tonal"
              >
                {{ t(`payments.status.${statusOf(p)}`) }}
              </v-chip>
            </td>
            <td>{{ isOpenRow(p) ? "—" : p.data_close }}</td>
            <td v-if="canCollect" class="text-end">
              <v-btn
                v-if="isOpenRow(p)"
                size="small"
                variant="tonal"
                color="primary"
                @click="openCollect(p)"
              >
                {{ t("payments.actions.collect") }}
              </v-btn>
              <v-btn
                v-else
                size="small"
                variant="text"
                :loading="reopening === p.id"
                @click="reopen(p)"
              >
                {{ t("payments.actions.reopen") }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-divider />
      <div class="d-flex flex-wrap ga-6 pa-4 text-body-2">
        <span
          >{{ t("payments.invoice.collected") }}:
          <strong>{{ money(data.total_paid) }}</strong></span
        >
        <span
          >{{ t("payments.invoice.pending") }}:
          <strong>{{ money(data.total_pending) }}</strong></span
        >
        <span
          >{{ t("payments.invoice.balance") }}:
          <strong>{{ money(data.balance) }}</strong></span
        >
      </div>
    </template>

    <CollectDialog
      v-model="collectOpen"
      :payment="target"
      :methods="methods"
      :currency="data?.currency"
      @collected="load"
    />
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { paymentsApi } from "../services/payments.service";
import { useToastStore } from "../stores/toast.store";
import { isOpenRow } from "../stores/payments.store";
import CollectDialog from "./CollectDialog.vue";
import type {
  InvoicePaymentRow,
  InvoicePayments,
  PaymentMethod,
  PaymentStatus,
} from "../types";

const props = defineProps<{ invoiceId: number; canCollect: boolean }>();
const { t } = useI18n();
const toasts = useToastStore();

const data = ref<InvoicePayments | null>(null);
const methods = ref<PaymentMethod[]>([]);
const loading = ref(false);
const failed = ref(false);
const collectOpen = ref(false);
const target = ref<InvoicePaymentRow | null>(null);
const reopening = ref<number | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const res = await paymentsApi.forInvoice(props.invoiceId);
    data.value = {
      ...res,
      payments: (res.payments ?? []).map((p) => ({
        ...p,
        importo: Number(p.importo),
      })),
    };
  } catch {
    failed.value = true;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

function statusOf(p: InvoicePaymentRow): PaymentStatus {
  if (p.status) return p.status;
  if (!isOpenRow(p)) return "paid";
  return p.scadenza && p.scadenza < new Date().toISOString().slice(0, 10)
    ? "overdue"
    : "pending";
}

function statusColor(s: PaymentStatus): string {
  return ({ paid: "success", overdue: "error", pending: "warning" } as const)[
    s
  ];
}

function money(v: number | string): string {
  const n = Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${data.value?.currency ?? ""}`.trim();
}

function methodLabel(id: number | null): string {
  if (!id) return "—";
  return methods.value.find((m) => m.id === Number(id))?.label ?? `#${id}`;
}

function openCollect(p: InvoicePaymentRow): void {
  target.value = p;
  collectOpen.value = true;
}

async function reopen(p: InvoicePaymentRow): Promise<void> {
  if (!window.confirm(t("payments.invoice.reopen_confirm"))) return;
  reopening.value = p.id;
  try {
    await paymentsApi.reopen(p.id);
    toasts.push("success", t("payments.invoice.reopen_done"));
    await load();
  } catch (e) {
    toasts.push("error", e instanceof Error ? e.message : String(e));
  } finally {
    reopening.value = null;
  }
}

watch(
  () => props.invoiceId,
  () => void load(),
);
onMounted(async () => {
  void load();
  try {
    methods.value = await paymentsApi.methods();
  } catch {
    methods.value = [];
  }
});
</script>

<style scoped>
.inv-pay-card {
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}
</style>
