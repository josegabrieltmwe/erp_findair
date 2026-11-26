<template>
  <!--
    «Cobrar postfacturación» (P148) para los clientes que pagan con tarjeta. Va dentro de la caja de postfacturación del
    envío (express y cargo). Sin permiso de lectura de pasarelas (403) no se pinta nada.
  -->
  <div v-if="visible" class="bpc-panel" data-testid="postcharge-panel">
    <div class="d-flex align-center mb-1">
      <v-icon icon="mdi-credit-card-clock-outline" size="18" class="me-2" />
      <span class="text-subtitle-2">{{ t("payments.postcharge.title") }}</span>
      <v-progress-circular
        v-if="loading"
        indeterminate
        size="14"
        width="2"
        class="ms-2"
      />
    </div>

    <v-alert
      v-if="loadError"
      type="error"
      variant="tonal"
      density="compact"
      data-testid="postcharge-load-error"
    >
      {{ t(`payments.postcharge.errors.${loadError}`) }}
    </v-alert>

    <!-- Postfacturación existente: el cliente paga con tarjeta (solo existen para esos clientes). -->
    <div v-else-if="current" data-testid="postcharge-current">
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <v-chip
          :color="postchargeStatusColor(current.status)"
          size="small"
          label
          variant="tonal"
          data-testid="postcharge-status"
        >
          {{ t(`payments.postcharge.status.${statusKey(current.status)}`) }}
        </v-chip>
        <span
          class="text-body-2 font-weight-medium"
          data-testid="postcharge-total"
        >
          {{ money(current.total) }}
        </span>
        <span class="text-caption text-medium-emphasis">
          {{
            t("payments.postcharge.net_vat", {
              net: money(current.net),
              vat: money(current.vat),
            })
          }}
        </span>
      </div>
      <div class="text-caption">
        <div data-testid="postcharge-method">
          {{ t("payments.postcharge.field.method") }}:
          {{ t(`payments.postcharge.method.${methodKey(current.method)}`) }}
        </div>
        <div v-if="current.description">
          {{ t("payments.postcharge.field.description") }}:
          {{ current.description }}
        </div>
        <div v-if="current.invoice_id" data-testid="postcharge-invoice">
          {{ t("payments.postcharge.field.invoice") }}: #{{
            current.invoice_id
          }}
        </div>
        <div v-if="current.crm_id" data-testid="postcharge-crm">
          {{ t("payments.postcharge.field.crm") }}: #{{ current.crm_id }}
        </div>
        <div class="text-medium-emphasis">
          {{ t("payments.postcharge.field.created") }}:
          {{ fmtDate(current.created_at) }}
          <template v-if="current.updated_at">
            · {{ t("payments.postcharge.field.updated") }}:
            {{ fmtDate(current.updated_at) }}
          </template>
        </div>
        <div
          v-if="current.error"
          class="text-warning"
          data-testid="postcharge-error"
        >
          {{ t("payments.postcharge.field.error") }}: {{ current.error }}
        </div>
      </div>
    </div>

    <!-- Sin postfacturación: el API dijo que este cliente se factura de la forma habitual. -->
    <v-alert
      v-else-if="standard"
      type="info"
      variant="tonal"
      density="compact"
      data-testid="postcharge-not-card"
    >
      {{ t("payments.postcharge.errors.not_card") }}
    </v-alert>

    <!-- Sin postfacturación: se ofrece iniciarla. El API decide si el cliente paga con tarjeta. -->
    <div v-else-if="canWrite" data-testid="postcharge-start-block">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ t("payments.postcharge.intro") }}
      </div>
      <div class="d-flex align-center flex-wrap ga-2">
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-credit-card-check-outline"
          :disabled="!!block || loading"
          data-testid="postcharge-start"
          @click="askStart"
        >
          {{ t("payments.postcharge.start") }}
        </v-btn>
        <span
          v-if="block"
          class="text-caption text-medium-emphasis"
          data-testid="postcharge-block"
        >
          {{ t(`payments.postcharge.block.${block}`) }}
        </span>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmOpen"
      :title="t('payments.postcharge.confirm.title')"
      :confirm-label="t('payments.postcharge.confirm.submit')"
      :cancel-label="t('common.cancel')"
      :loading="starting"
      max-width="520"
      @confirm="doStart"
      @cancel="confirmOpen = false"
    >
      <div class="text-body-2 mb-2">
        {{
          t("payments.postcharge.confirm.amount", { amount: money(postAmount) })
        }}
      </div>
      <ul class="text-body-2 bpc-list mb-2">
        <li>{{ t("payments.postcharge.confirm.with_auth") }}</li>
        <li>{{ t("payments.postcharge.confirm.without_auth") }}</li>
      </ul>
      <v-alert
        v-if="startError"
        type="error"
        variant="tonal"
        density="compact"
        data-testid="postcharge-start-error"
      >
        {{ t(`payments.postcharge.errors.${startError}`) }}
      </v-alert>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Panel «Cobrar postfacturación» de un envío (P148). Contrato: `api_booking_postcharge` (docs/contrato-con-api.md).
 *
 *  - GET al montar (y al cambiar de envío): si hay postfacturación, se muestra estado, total, vía, factura, práctica CRM
 *    e incidencia. 403 (sin `payment_gateways:read`) oculta el panel entero.
 *  - Sin postfacturación y con `payment_gateways:write`: botón que pide confirmación y explica las dos vías (con
 *    autorización de cobro: aviso, cobro tras el preaviso y luego factura; sin ella: postfactura que el cliente paga
 *    antes de volver a reservar). Deshabilitado si el envío no está facturado, ya tiene la 2ª factura o no hay importe.
 *  - El ERP no sabe si el cliente paga con tarjeta: un 409 `NOT_CARD_CUSTOMER` se explica y se recuerda por cliente
 *    durante la sesión (ver `bookingPostchargeModel.ts`).
 */
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConfirmDialog from "@shared/ui/ConfirmDialog.vue";
import { useAccess } from "@shared/composables/useAccess";
import { useToastStore } from "@shared/stores/toast.store";
import {
  BOOKING_POSTCHARGE_STATUSES,
  bookingPostcharges,
  type BookingPostcharge,
  type BookingPostchargeKind,
} from "@shared/payment_gateways/services/paymentGateways.service";
import {
  classifyPostchargeError,
  formatPostchargeAmount,
  isKnownStandardCustomer,
  postchargeBlock,
  postchargeStatusColor,
  rememberStandardCustomer,
  type PostchargeErrorKind,
} from "./bookingPostchargeModel";
import {
  canViewSurcharges,
  canWriteSurcharges,
  formatApiDateTime,
} from "./surchargesModel";

const props = defineProps<{
  kind: BookingPostchargeKind;
  shipmentId: number | null | undefined;
  customerId?: number | null;
  /** `id_fattura_a`. */
  invoiceId?: string | number | null;
  /** `id_fattura_a2`. */
  postInvoiceId?: string | number | null;
  /** Importe pendiente de postfacturar (euros). */
  postAmount?: number | null;
}>();

const { t, locale } = useI18n();
const { access } = useAccess();
const toasts = useToastStore();

const current = ref<BookingPostcharge | null>(null);
const loading = ref(false);
const loadError = ref<PostchargeErrorKind | null>(null);
const hidden = ref(false);
const standard = ref(false);
const confirmOpen = ref(false);
const starting = ref(false);
const startError = ref<PostchargeErrorKind | null>(null);

const canWrite = computed(() => canWriteSurcharges(access.value));
const block = computed(() =>
  postchargeBlock({
    invoiceId: props.invoiceId,
    postInvoiceId: props.postInvoiceId,
    postAmount: props.postAmount,
  }),
);
// Visible si hay algo que enseñar: la postfacturación, un error de carga, el aviso de «cliente normal» o el botón.
const visible = computed(
  () =>
    !hidden.value &&
    !!props.shipmentId &&
    canViewSurcharges(access.value) &&
    (!!current.value || !!loadError.value || standard.value || canWrite.value),
);

function money(v: string | number | null | undefined): string {
  return formatPostchargeAmount(
    v,
    current.value?.currency ?? "EUR",
    String(locale.value),
  );
}

function fmtDate(v: string | null | undefined): string {
  return formatApiDateTime(v, String(locale.value));
}

/** Un estado nuevo del API no rompe la plantilla: cae en «otro». */
function statusKey(s: string): string {
  return (BOOKING_POSTCHARGE_STATUSES as readonly string[]).includes(s)
    ? s
    : "other";
}

function methodKey(m: string): string {
  return m === "authorization" || m === "invoice" ? m : "other";
}

async function load(): Promise<void> {
  current.value = null;
  loadError.value = null;
  hidden.value = false;
  standard.value = isKnownStandardCustomer(props.customerId);
  if (!props.shipmentId || !canViewSurcharges(access.value)) return;
  loading.value = true;
  try {
    current.value = await bookingPostcharges.get(props.kind, props.shipmentId);
    if (current.value) standard.value = false;
  } catch (e) {
    const kind = classifyPostchargeError(e);
    // Sin permiso o envío que no es suyo: el panel no aplica a esta persona.
    if (kind === "forbidden" || kind === "not_found") hidden.value = true;
    else loadError.value = kind;
  } finally {
    loading.value = false;
  }
}

function askStart(): void {
  startError.value = null;
  confirmOpen.value = true;
}

async function doStart(): Promise<void> {
  if (!props.shipmentId) return;
  starting.value = true;
  startError.value = null;
  try {
    const res = await bookingPostcharges.start(props.kind, props.shipmentId);
    current.value = res;
    confirmOpen.value = false;
    if (res.replayed)
      toasts.push("info", t("payments.postcharge.done.replayed"));
    else if (res.status === "notified")
      toasts.push("success", t("payments.postcharge.done.notified"));
    else toasts.push("success", t("payments.postcharge.done.invoiced"));
  } catch (e) {
    const kind = classifyPostchargeError(e);
    if (kind === "not_card") {
      rememberStandardCustomer(props.customerId);
      standard.value = true;
      confirmOpen.value = false;
    } else {
      startError.value = kind;
    }
  } finally {
    starting.value = false;
  }
}

watch(
  () => [props.kind, props.shipmentId] as const,
  () => void load(),
);
onMounted(() => void load());
</script>

<style scoped>
.bpc-panel {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 12px;
  margin-top: 8px;
}
.bpc-list {
  padding-inline-start: 20px;
}
</style>
