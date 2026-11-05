<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="onToggle"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ t("payments.online.title") }}
      </v-card-title>

      <!-- Fase 1: formulario (importe) -->
      <v-card-text v-if="phase === 'form'">
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("payments.online.pending", { amount: money(pending) }) }}
        </div>
        <v-radio-group v-model="mode" inline density="comfortable" hide-details>
          <v-radio :label="t('payments.online.full')" value="full" />
          <v-radio :label="t('payments.online.partial')" value="partial" />
        </v-radio-group>
        <v-text-field
          v-if="mode === 'partial'"
          v-model="amountText"
          inputmode="decimal"
          :label="t('payments.online.amount')"
          density="comfortable"
          variant="outlined"
          class="mt-3"
          :error-messages="amountMessage"
        />
        <v-alert
          v-if="errorKey"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ t(errorKey) }}
        </v-alert>
        <div class="text-caption text-medium-emphasis mt-3">
          {{ t("payments.online.hint") }}
        </div>
      </v-card-text>

      <!-- Fase 2: procesando (la autoridad es el webhook; se refresca por GET ?id=) -->
      <v-card-text v-else-if="phase === 'processing'">
        <div class="d-flex align-center ga-3 mb-3">
          <v-progress-circular indeterminate color="primary" size="24" />
          <span>{{ t("payments.online.processing") }}</span>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("payments.online.processing_hint") }}
        </div>
        <v-alert
          v-if="blocked"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("payments.online.popup_blocked") }}
        </v-alert>
        <v-alert
          v-if="expired"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("payments.online.expired") }}
        </v-alert>
        <v-alert
          v-if="gaveUp"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("payments.online.gave_up") }}
        </v-alert>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-if="canReopen"
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-open-in-new"
            @click="openCheckout"
          >
            {{ t("payments.online.open_again") }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :loading="refreshing"
            @click="refreshNow"
          >
            {{ t("payments.online.refresh") }}
          </v-btn>
        </div>
      </v-card-text>

      <!-- Fase 3: resultado terminal -->
      <v-card-text v-else>
        <v-alert
          :type="outcome === 'succeeded' ? 'success' : 'error'"
          variant="tonal"
          density="compact"
        >
          {{ t(`payments.online.result.${outcome}`) }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{
            phase === "form" ? t("common.cancel") : t("payments.online.close")
          }}
        </v-btn>
        <v-btn
          v-if="phase === 'form'"
          color="primary"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t("payments.online.submit") }}
        </v-btn>
        <v-btn
          v-else-if="phase === 'done' && outcome !== 'succeeded'"
          color="primary"
          @click="restart"
        >
          {{ t("payments.online.retry") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Cobro de una factura con tarjeta mediante el Checkout alojado de Stripe.
 *
 * Flujo: (1) la persona confirma el importe pendiente (total o parcial); (2) se crea el cobro en `api_pay_payments`
 * con una clave de idempotencia por intento y se abre `checkout_url` en una ventana nueva (si el navegador la
 * bloquea se ofrece el enlace); (3) el diálogo queda en "procesando" y consulta `GET ?id=` hasta un estado
 * terminal. La AUTORIDAD del resultado es el webhook de Stripe en la API, no el retorno del navegador: por eso se
 * sondea en vez de fiarse de lo que ocurra en la otra ventana.
 *
 * No sustituye a `CollectDialog` (registro contable manual de un cobro ya hecho fuera): aquí se inicia un cobro real.
 *
 * Props: `invoiceId` factura a cobrar; `pending` importe pendiente en unidades (decimal); `currency` divisa solo
 * para mostrar. Eventos: `update:modelValue` y `paid` (cuando el cobro llega a `succeeded`, para recargar cuotas).
 * La lógica pura (validación, clave, clasificación de errores, sondeo) vive en `payOnlineModel.ts`.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  payPayments,
  type PayPayment,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { useToastStore } from "../stores/toast.store";
import {
  POLL_MAX_ATTEMPTS,
  amountForRequest,
  classifyPayError,
  isCheckoutExpired,
  isSafeCheckoutUrl,
  isTerminalStatus,
  newIdempotencyKey,
  pollDelay,
  validatePayAmount,
} from "./payOnlineModel";

const props = defineProps<{
  modelValue: boolean;
  invoiceId: number;
  pending: number;
  currency?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  paid: [];
}>();

const { t } = useI18n();
const toasts = useToastStore();

const phase = ref<"form" | "processing" | "done">("form");
const mode = ref<"full" | "partial">("full");
const amountText = ref("");
const saving = ref(false);
const refreshing = ref(false);
const errorKey = ref<string | null>(null);
const payment = ref<PayPayment | null>(null);
const outcome = ref<"succeeded" | "failed" | "canceled" | "expired">("failed");
const blocked = ref(false);
const gaveUp = ref(false);
/** Clave del intento en curso; se renueva al cambiar la petición (importe) o tras un resultado fallido. */
const idempotencyKey = ref(newIdempotencyKey());

let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

const amountError = computed(() =>
  mode.value === "partial"
    ? validatePayAmount(amountText.value, props.pending)
    : null,
);
const amountMessage = computed(() => {
  // Sin escribir nada todavía solo se bloquea el botón, sin pintar el error.
  if (!amountError.value || amountError.value === "required") return [];
  return [
    t(`payments.online.errors.${amountError.value}`, {
      max: money(props.pending),
    }),
  ];
});
const canSubmit = computed(
  () => props.pending > 0 && !saving.value && (mode.value === "full" || amountError.value === null),
);
const expired = computed(() => isCheckoutExpired(payment.value?.expires_at));
const canReopen = computed(
  () => isSafeCheckoutUrl(payment.value?.checkout_url) && !expired.value,
);

function money(v: number): string {
  const n = Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return props.currency ? `${n} ${props.currency}` : n;
}

function stopPolling(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Vuelve al formulario con estado limpio y una clave nueva (intento nuevo). */
function reset(): void {
  stopPolling();
  phase.value = "form";
  mode.value = "full";
  amountText.value = "";
  errorKey.value = null;
  payment.value = null;
  blocked.value = false;
  gaveUp.value = false;
  attempt = 0;
  idempotencyKey.value = newIdempotencyKey();
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    // Al abrir se empieza un intento limpio; si quedó uno en proceso (se cerró sin terminar) se retoma su sondeo.
    if (phase.value === "processing") {
      attempt = 0;
      void poll();
    } else {
      reset();
    }
  },
);

// Un importe distinto es OTRA petición: reutilizar la clave daría 409. Se renueva (solo antes de enviar).
watch([mode, amountText], () => {
  if (phase.value === "form") {
    idempotencyKey.value = newIdempotencyKey();
    errorKey.value = null;
  }
});

/** Abre la página de pago en ventana nueva; si el navegador la bloquea lo indica para ofrecer el enlace. */
function openCheckout(): void {
  const url = payment.value?.checkout_url;
  if (!isSafeCheckoutUrl(url)) return;
  const w = window.open(url, "_blank", "noopener");
  blocked.value = w === null;
}

function errorMessageKey(err: unknown): string {
  const info = classifyPayError(err);
  switch (info.kind) {
    case "declined":
      return "payments.online.error.declined";
    case "conflict":
      return "payments.online.error.conflict";
    case "invalid":
      return "payments.online.error.invalid";
    case "not_active":
      return "payments.online.error.not_active";
    case "forbidden":
      return "payments.online.error.forbidden";
    default:
      return "payments.online.error.other";
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  saving.value = true;
  errorKey.value = null;
  try {
    const res = await payPayments.create({
      invoice_id: props.invoiceId,
      amount: amountForRequest(mode.value, amountText.value, props.pending),
      currency: props.currency,
      idempotency_key: idempotencyKey.value,
    });
    payment.value = res.payment;
    if (res.alreadyPaid || res.payment.status === "succeeded") {
      finish("succeeded");
      return;
    }
    phase.value = "processing";
    openCheckout();
    schedule();
  } catch (e) {
    const info = classifyPayError(e);
    errorKey.value = errorMessageKey(e);
    // Un 409 por clave repetida con otra petición se resuelve con clave nueva; un 402 también es un intento nuevo.
    if (info.kind === "conflict" || info.kind === "declined") {
      idempotencyKey.value = newIdempotencyKey();
    }
  } finally {
    saving.value = false;
  }
}

/** Programa la próxima consulta de estado, espaciándolas y con tope de intentos. */
function schedule(): void {
  stopPolling();
  if (attempt >= POLL_MAX_ATTEMPTS) {
    gaveUp.value = true;
    return;
  }
  timer = setTimeout(() => void poll(), pollDelay(attempt));
  attempt += 1;
}

/** Consulta `GET ?id=` y cierra si el estado es terminal; un fallo de red solo reintenta en el siguiente turno. */
async function poll(): Promise<void> {
  const id = payment.value?.id;
  if (!id || phase.value !== "processing") return;
  try {
    const fresh = await payPayments.get(id);
    payment.value = { ...payment.value, ...fresh, checkout_url: payment.value?.checkout_url };
    if (isTerminalStatus(fresh.status)) {
      finish(fresh.status as typeof outcome.value);
      return;
    }
  } catch {
    // Se ignora: la autoridad es el webhook y la siguiente consulta lo recogerá.
  }
  schedule();
}

async function refreshNow(): Promise<void> {
  refreshing.value = true;
  gaveUp.value = false;
  attempt = 0;
  try {
    await poll();
  } finally {
    refreshing.value = false;
  }
}

function finish(result: typeof outcome.value): void {
  stopPolling();
  outcome.value = result;
  phase.value = "done";
  if (result === "succeeded") {
    toasts.push("success", t("payments.online.result.succeeded"));
    emit("paid");
  }
}

function restart(): void {
  reset();
}

/** Cerrar no cancela el cobro: si ya hay uno abierto se deja de sondear y el estado final lo fija el webhook. */
function close(): void {
  stopPolling();
  emit("update:modelValue", false);
}

function onToggle(v: boolean): void {
  if (!v) close();
}

// Al volver a la pestaña del ERP tras pagar en la otra ventana se consulta de inmediato.
function onVisible(): void {
  if (document.visibilityState === "visible" && phase.value === "processing") void poll();
}
document.addEventListener("visibilitychange", onVisible);
onBeforeUnmount(() => {
  stopPolling();
  document.removeEventListener("visibilitychange", onVisible);
});
</script>
