<template>
  <div class="ret-page">
    <div class="ret-card">
      <h1 class="ret-title">{{ t("payments.return.title") }}</h1>

      <v-alert
        v-if="view === 'invalid'"
        type="warning"
        variant="tonal"
        density="compact"
      >
        {{ t("payments.return.invalid") }}
      </v-alert>

      <template v-else-if="view === 'checking'">
        <div class="d-flex align-center ga-3 mb-2">
          <v-progress-circular indeterminate color="primary" size="24" />
          <span>{{ t("payments.return.checking") }}</span>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ t("payments.return.checking_hint") }}
        </div>
      </template>

      <v-alert
        v-else-if="view === 'succeeded'"
        type="success"
        variant="tonal"
        density="compact"
      >
        {{ t("payments.return.succeeded") }}
      </v-alert>

      <v-alert
        v-else-if="view === 'gave_up'"
        type="info"
        variant="tonal"
        density="compact"
      >
        {{ t("payments.return.gave_up") }}
      </v-alert>

      <v-alert
        v-else-if="view === 'load_error'"
        type="error"
        variant="tonal"
        density="compact"
      >
        {{ t("payments.return.load_error") }}
      </v-alert>

      <v-alert v-else type="error" variant="tonal" density="compact">
        {{ t(`payments.return.${view}`) }}
      </v-alert>

      <dl v-if="payment && amountText" class="ret-detail">
        <dt>{{ t("payments.return.amount") }}</dt>
        <dd>{{ amountText }}</dd>
        <dt>{{ t("payments.return.reference") }}</dt>
        <dd class="ret-ref">{{ payment.id }}</dd>
      </dl>

      <div class="ret-actions">
        <v-btn
          v-if="view === 'gave_up' || view === 'load_error'"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="refreshing"
          @click="refreshNow"
        >
          {{ t("payments.return.refresh") }}
        </v-btn>
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          :to="{ name: 'payments' }"
        >
          {{ t("payments.return.back") }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Página a la que Stripe devuelve a la persona tras el Checkout alojado (`PAY_RETURN_URL_ERP` =
 * `/payments/return?payment_id=pay_…`, con `pay_result=success|cancel` añadido por la API).
 *
 * `pay_result` NO es la autoridad: solo orienta el texto. El estado real lo fija el webhook de Stripe en la API, así que
 * la página lo consulta con `GET api_pay_payments?id=` y sondea mientras no sea terminal («procesando» es normal: el
 * webhook puede llegar después que el navegador). Con `pay_result=cancel` basta una consulta, no se espera nada.
 * La lógica pura (lectura de la URL, estados terminales, ritmo del sondeo) está en `payOnlineModel.ts`.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  payPayments,
  type PayPayment,
} from "@shared/payment_gateways/services/paymentGateways.service";
import {
  POLL_MAX_ATTEMPTS,
  formatMinorAmount,
  isTerminalStatus,
  parsePayReturn,
  pollDelay,
} from "../components/payOnlineModel";

type View =
  | "invalid"
  | "checking"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired"
  | "gave_up"
  | "load_error";

const { t, locale } = useI18n();
const route = useRoute();
const params = parsePayReturn(route.query);

const payment = ref<PayPayment | null>(null);
const view = ref<View>(params.paymentId ? "checking" : "invalid");
const refreshing = ref(false);
/** Con `pay_result=cancel` la persona volvió sin pagar: una sola consulta, sin espera. */
const maxAttempts = params.result === "cancel" ? 1 : POLL_MAX_ATTEMPTS;

let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

const amountText = computed(() =>
  formatMinorAmount(
    payment.value?.amount_minor,
    payment.value?.currency,
    locale.value,
  ),
);

function stopPolling(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function settle(status: string): void {
  stopPolling();
  view.value = (
    status === "succeeded" || status === "failed" || status === "expired"
      ? status
      : "canceled"
  ) as View;
}

function schedule(): void {
  stopPolling();
  if (attempt >= maxAttempts) {
    // Volvió sin pagar y sigue abierto: es una cancelación; si no, se deja de consultar y se ofrece actualizar.
    view.value = params.result === "cancel" ? "canceled" : "gave_up";
    return;
  }
  timer = setTimeout(() => void poll(), pollDelay(attempt));
  attempt += 1;
}

async function poll(): Promise<void> {
  if (!params.paymentId) return;
  try {
    const fresh = await payPayments.get(params.paymentId);
    payment.value = fresh;
    if (isTerminalStatus(fresh.status)) {
      settle(fresh.status);
      return;
    }
  } catch {
    // Un fallo puntual no cierra: la API puede estar ocupada. Si agota los intentos se avisa de que no se pudo leer.
    if (attempt + 1 >= maxAttempts && !payment.value) {
      stopPolling();
      view.value = "load_error";
      return;
    }
  }
  schedule();
}

async function refreshNow(): Promise<void> {
  refreshing.value = true;
  attempt = 0;
  view.value = "checking";
  try {
    await poll();
  } finally {
    refreshing.value = false;
  }
}

function onVisible(): void {
  if (document.visibilityState === "visible" && view.value === "checking")
    void poll();
}

onMounted(() => {
  if (!params.paymentId) return;
  document.addEventListener("visibilitychange", onVisible);
  void poll();
});
onBeforeUnmount(() => {
  stopPolling();
  document.removeEventListener("visibilitychange", onVisible);
});
</script>

<style scoped>
.ret-page {
  display: flex;
  justify-content: center;
  padding: 32px 16px;
}
.ret-card {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ret-title {
  font-size: 1.25rem;
  font-weight: 600;
}
.ret-detail {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}
.ret-detail dt {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.ret-detail dd {
  margin: 0;
}
.ret-ref {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  word-break: break-all;
}
.ret-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
