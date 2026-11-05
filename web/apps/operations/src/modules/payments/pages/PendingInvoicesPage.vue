<template>
  <div class="pend-page">
    <div class="pend-toolbar">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        :to="{ name: 'payments' }"
      >
        {{ t("payments.pending.back") }}
      </v-btn>
      <h1 class="pend-title">{{ t("payments.pending.title") }}</h1>
      <v-chip v-if="!loading && !errorKind" size="small" variant="tonal">{{
        total
      }}</v-chip>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        {{ t("payments.pending.refresh") }}
      </v-btn>
    </div>

    <div class="text-body-2 text-medium-emphasis">
      {{ t("payments.pending.intro") }}
    </div>

    <!-- Error: nunca se pinta una lista vacía ante un fallo (diría «no hay nada pendiente»). -->
    <v-alert
      v-if="errorKind"
      :type="errorKind === 'forbidden' ? 'warning' : 'error'"
      variant="tonal"
      density="compact"
    >
      {{ t(`payments.pending.error.${errorKind}`) }}
    </v-alert>

    <div v-else-if="loading && !rows.length" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <v-alert
      v-else-if="!rows.length"
      type="success"
      variant="tonal"
      density="compact"
    >
      {{ t("payments.pending.empty") }}
    </v-alert>

    <template v-else>
      <v-table density="comfortable" class="pend-table">
        <thead>
          <tr>
            <th>{{ t("payments.pending.col.number") }}</th>
            <th>{{ t("payments.pending.col.invoice_date") }}</th>
            <th>{{ t("payments.pending.col.due") }}</th>
            <th>{{ t("payments.pending.col.status") }}</th>
            <th class="text-end">{{ t("payments.pending.col.total") }}</th>
            <th class="text-end">{{ t("payments.pending.col.pending") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.invoice_id">
            <td>{{ r.number }}</td>
            <td>{{ r.invoice_date || "—" }}</td>
            <td>{{ r.due_date || t("payments.pending.no_due") }}</td>
            <td>
              <v-chip
                :color="statusColor(pendingRowStatus(r))"
                size="small"
                label
                variant="tonal"
              >
                {{ t(`payments.pending.status.${pendingRowStatus(r)}`) }}
              </v-chip>
              <!-- Pago en curso: aviso aparte aunque la fila siga vencida o cobrable (contrato del API). -->
              <v-tooltip
                v-if="hasPaymentInProgress(r)"
                location="top"
                :text="
                  t('payments.pending.in_progress_hint', {
                    amount: money(r.in_progress_amount, r.currency),
                  })
                "
              >
                <template #activator="{ props: tip }">
                  <v-icon
                    v-bind="tip"
                    icon="mdi-timer-sand"
                    size="18"
                    class="ms-1"
                    color="info"
                  />
                </template>
              </v-tooltip>
            </td>
            <td class="text-end">{{ money(r.total, r.currency) }}</td>
            <td class="text-end">
              <strong>{{ money(r.pending, r.currency) }}</strong>
            </td>
            <td class="text-end">
              <v-btn
                v-if="rowAction(r, access) === 'pay'"
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="mdi-credit-card-outline"
                @click="openPay(r)"
              >
                {{ t("payments.actions.pay_online") }}
              </v-btn>
              <span
                v-else-if="rowAction(r, access) === 'blocked'"
                class="text-caption text-medium-emphasis"
              >
                {{ blockedText(r) }}
              </span>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div class="d-flex justify-center">
        <v-pagination
          v-model="page"
          :length="pageCount(total, perPage)"
          :total-visible="7"
          density="comfortable"
        />
      </div>
    </template>

    <!-- Se reutiliza el diálogo de cobro online tal cual: abre el Checkout de la factura de la fila. -->
    <PayOnlineDialog
      v-if="target"
      :key="target.invoice_id"
      v-model="payOpen"
      :invoice-id="target.invoice_id"
      :pending="amountToNumber(target.pending)"
      :currency="target.currency"
      @paid="load"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * «Facturas pendientes de cobro»: cola de trabajo de cobro online para personal y partner.
 *
 * Qué hace: lista paginada (servidor) de `GET api_pay_pending_invoices` con número, fechas, estado, total e importe
 * pendiente, y la acción «Cobrar online» que abre `PayOnlineDialog` con la factura de la fila. Qué facturas salen lo
 * decide el API (las que el partner del token emitió, sin regla de sede); la SPA no filtra ni envía partner/cliente.
 *
 * Permisos (solo UX; el API manda): ver la lista exige `invoices:read` + `payment_gateways:read` (guard de ruta en
 * `router/moduleAccess.ts`); el botón de cobrar exige además `payment_gateways:write` (`rowAction`). Sin scopes
 * nuevos. Errores: 403 -> aviso de permiso; 503 `PAYMENT_PENDING_UNAVAILABLE` u otros -> aviso de error SIN lista
 * vacía, para no decir «no debes nada» cuando no se pudo consultar.
 *
 * Refresco: tras `paid` del diálogo se recarga (la factura sale o baja su pendiente cuando el webhook reparte el
 * cobro), al cerrar el diálogo (puede haber un pago en curso nuevo) y a mano con el botón. Lógica pura en
 * `pendingInvoicesModel.ts`.
 */
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAccess } from "@shared/composables/useAccess";
import {
  classifyPendingInvoicesError,
  payPendingInvoices,
  type PendingInvoice,
  type PendingInvoicesErrorKind,
} from "@shared/payment_gateways/services/paymentGateways.service";
import PayOnlineDialog from "../components/PayOnlineDialog.vue";
import {
  PENDING_PER_PAGE,
  amountToNumber,
  hasPaymentInProgress,
  notPayableReasonKey,
  pageCount,
  pendingRowStatus,
  rowAction,
  type PendingRowStatus,
} from "../components/pendingInvoicesModel";

const { t } = useI18n();
const { access } = useAccess();

const rows = ref<PendingInvoice[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(PENDING_PER_PAGE);
const loading = ref(false);
const errorKind = ref<PendingInvoicesErrorKind | null>(null);

/** Factura cuyo cobro se está iniciando y apertura del diálogo. */
const target = ref<PendingInvoice | null>(null);
const payOpen = ref(false);

/**
 * Carga la página actual. Ante un error se vacía la lista y se guarda el tipo de error (la plantilla pinta el aviso y
 * no el estado «sin facturas»). Si la página pedida queda fuera de rango (tras cobrar la última fila de la última
 * página) se retrocede a la última existente.
 */
async function load(): Promise<void> {
  loading.value = true;
  errorKind.value = null;
  try {
    const res = await payPendingInvoices.list(page.value, perPage.value);
    rows.value = res.rows;
    total.value = res.total;
    const last = pageCount(res.total, res.perPage);
    if (!res.rows.length && res.total > 0 && page.value > last) {
      page.value = last; // dispara el watch y recarga
    }
  } catch (e) {
    rows.value = [];
    total.value = 0;
    errorKind.value = classifyPendingInvoicesError(e);
  } finally {
    loading.value = false;
  }
}

/** Abre el diálogo de cobro online con la factura de la fila. */
function openPay(r: PendingInvoice): void {
  target.value = r;
  payOpen.value = true;
}

/** Importe de texto decimal para mostrar, con la divisa de la factura (formato como el resto de Cobros). */
function money(v: string | number, currency: string): string {
  const n = amountToNumber(v).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${currency ?? ""}`.trim();
}

function statusColor(s: PendingRowStatus): string {
  return ({ overdue: "error", in_progress: "info", pending: "warning" } as const)[s];
}

/** Texto del motivo por el que una fila no se puede cobrar ahora. */
function blockedText(r: PendingInvoice): string {
  const key = notPayableReasonKey(r.not_payable_reason);
  return key ? t(`payments.pending.${key}`) : "";
}

watch(page, () => void load());
// Al cerrar el diálogo se recarga: puede haberse iniciado un pago (in_progress) aunque no haya terminado.
watch(payOpen, (open) => {
  if (!open) void load();
});
onMounted(() => void load());
</script>

<style scoped>
.pend-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pend-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pend-title {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
