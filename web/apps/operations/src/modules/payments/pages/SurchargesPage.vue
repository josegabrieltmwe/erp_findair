<template>
  <div class="sur-page">
    <div class="sur-toolbar">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="{ name: 'payments' }">
        {{ t("payments.surcharges.back") }}
      </v-btn>
      <h1 class="sur-title">{{ t("payments.surcharges.title") }}</h1>
      <v-chip v-if="!loading && !errorKind" size="small" variant="tonal">{{ total }}</v-chip>
      <v-spacer />
      <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="load">
        {{ t("payments.surcharges.refresh") }}
      </v-btn>
      <!-- Proponer: solo con payment_gateways:write. -->
      <v-btn
        v-if="canWrite"
        color="primary"
        prepend-icon="mdi-plus"
        data-testid="surcharge-propose-open"
        @click="proposeOpen = true"
      >
        {{ t("payments.surcharges.propose.open") }}
      </v-btn>
    </div>

    <div class="text-body-2 text-medium-emphasis">{{ t("payments.surcharges.intro") }}</div>

    <!-- Pestañas por estado. «Impugnados» es la cola del administrador; «Por transferir» es la vista de liquidación. -->
    <v-tabs v-model="tab" density="comfortable" color="primary" show-arrows>
      <v-tab v-for="k in SURCHARGE_TABS" :key="k" :value="k" :data-testid="`surcharge-tab-${k}`">
        {{ t(`payments.surcharges.tabs.${k}`) }}
      </v-tab>
    </v-tabs>

    <!-- Filtro por cliente: solo estrecha la cartera del propio partner (no hay filtro de partner ni vista cruzada). -->
    <div v-if="tab !== 'pending_transfer'" class="sur-filter">
      <CustomerPicker
        v-model="customerId"
        :label="t('payments.surcharges.customer_filter')"
      />
    </div>

    <v-alert v-if="tab === 'pending_transfer'" type="info" variant="tonal" density="compact">
      {{ t("payments.surcharges.transfer_hint") }}
    </v-alert>

    <!-- Error de carga: nunca se pinta una lista vacía ante un fallo (diría «no hay recargos»). -->
    <v-alert
      v-if="errorKind"
      :type="errorKind === 'forbidden' ? 'warning' : 'error'"
      variant="tonal"
      density="compact"
      data-testid="surcharge-load-error"
    >
      {{ t(`payments.surcharges.errors.${errorKind}`) }}
    </v-alert>

    <div v-else-if="loading && !rows.length" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <v-alert v-else-if="!rows.length" type="success" variant="tonal" density="compact" data-testid="surcharge-empty">
      {{ t("payments.surcharges.empty") }}
    </v-alert>

    <template v-else>
      <v-table density="comfortable" class="sur-table" data-testid="surcharge-table">
        <thead>
          <tr>
            <th>{{ t("payments.surcharges.col.id") }}</th>
            <th>{{ t("payments.list.customer") }}</th>
            <th>{{ t("payments.surcharges.col.type") }}</th>
            <th class="text-end">{{ t("payments.surcharges.col.amount") }}</th>
            <th>{{ t("payments.surcharges.col.status") }}</th>
            <th>{{ t("payments.surcharges.col.notice_due") }}</th>
            <th>{{ t("payments.surcharges.col.dispute_until") }}</th>
            <th class="text-end">{{ t("payments.surcharges.col.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.public_id" :data-testid="`surcharge-row-${r.public_id}`">
            <td class="sur-mono">{{ r.public_id }}</td>
            <td>{{ r.customer_name || '' }} <span class="text-medium-emphasis">#{{ r.customer_id }}</span></td>
            <td>{{ t(`payments.surcharges.type.${r.surcharge_type}`) }}</td>
            <td class="text-end">
              <strong>{{ formatMinor(r.amount_minor, r.currency) }}</strong>
            </td>
            <td>
              <v-chip :color="statusColor(r.status)" size="small" label variant="tonal">
                {{ t(`payments.surcharges.status.${r.status}`) }}
              </v-chip>
            </td>
            <td class="text-caption">{{ r.notice_due_at || "—" }}</td>
            <td class="text-caption">{{ r.dispute_until || "—" }}</td>
            <td class="text-end sur-actions">
              <v-btn size="small" variant="text" icon="mdi-eye-outline" :title="t('payments.surcharges.detail.open')" @click="openDetail(r)" />
              <v-btn
                v-for="a in actionsOf(r)"
                :key="a"
                size="small"
                variant="tonal"
                :color="a === 'waive' ? 'warning' : 'primary'"
                :data-testid="`surcharge-${a}-${r.public_id}`"
                @click="openAction(a, r)"
              >
                {{ t(`payments.surcharges.action.${a}`) }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="tab !== 'pending_transfer'" class="d-flex justify-center">
        <v-pagination v-model="page" :length="pageCount(total, perPage)" :total-visible="7" density="comfortable" />
      </div>
    </template>

    <div v-if="!canAdmin" class="text-caption text-medium-emphasis" data-testid="surcharge-admin-hint">
      {{ t("payments.surcharges.admin_hint") }}
    </div>

    <SurchargeProposeDialog v-model="proposeOpen" @done="load" />
    <SurchargeActionDialog v-model="actionOpen" :action="actionName" :surcharge="actionTarget" @done="load" />
    <SurchargeDetailDialog v-model="detailOpen" :surcharge="detailTarget" />
  </div>
</template>

<script setup lang="ts">
/**
 * «Recargos»: pantalla de personal y partner para gestionar los recargos que el vendedor cobra a sus clientes cuando el
 * transportista mide más peso o volumen del declarado (o por otro motivo): listar, proponer, avisar, perdonar, rechazar
 * una impugnación, cobrar y ver el estado y las impugnaciones.
 *
 * Datos: `GET api_pay_surcharges` paginado (servidor) con pestañas por estado y filtro por cliente; la pestaña «Por
 * transferir» usa `?view=pending_transfer` (recargos cobrados por TMWE como respaldo a favor del partner y aún sin
 * transferir; solo datos, no se mueve dinero; máx. 100, sin paginar). El partner sale del token: la pantalla no envía ni
 * ofrece `partner_id`, y un recargo de otro partner responde 404 incluso a TMWE (independencia del partner), por lo que
 * NO existe vista cruzada.
 *
 * Permisos (solo UX; el API autoriza cada petición): ver exige `payment_gateways:read` (guard de ruta en
 * `router/moduleAccess.ts`); proponer, avisar e impugnar en nombre del cliente exigen `:write`; perdonar, rechazar la
 * impugnación y cobrar exigen `payment_gateways:admin` (el API pide además TMWE o `partner:manage`). Los botones de cada
 * fila los decide `availableActions` según el estado y los scopes: sin el scope, el botón NO se pinta. Todo está apagado en
 * el servidor por defecto: avisar, proponer y cobrar responden 503 `PAYMENT_NOT_ACTIVE` y se explica en el diálogo.
 *
 * Errores de carga: 403 -> aviso de permiso; cualquier otro -> aviso de error SIN lista vacía. Lógica pura en
 * `components/surchargesModel.ts`; las acciones viven en `SurchargeActionDialog`, la alta en `SurchargeProposeDialog` y
 * el detalle en `SurchargeDetailDialog`.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAccess } from "@shared/composables/useAccess";
import {
  paySurcharges,
  type PaySurcharge,
  type PaySurchargeStatus,
} from "@shared/payment_gateways/services/paymentGateways.service";
import CustomerPicker from "../components/CustomerPicker.vue";
import SurchargeActionDialog from "../components/SurchargeActionDialog.vue";
import SurchargeDetailDialog from "../components/SurchargeDetailDialog.vue";
import SurchargeProposeDialog from "../components/SurchargeProposeDialog.vue";
import {
  SURCHARGE_PER_PAGE,
  availableActions,
  canAdminSurcharges,
  canWriteSurcharges,
  classifySurchargeError,
  formatMinor,
  pageCount,
  statusColor,
  type SurchargeAction,
  type SurchargeErrorKind,
} from "../components/surchargesModel";

/** Pestañas: todos, un estado cada una y la vista de liquidación. */
const SURCHARGE_TABS = [
  "all",
  "pending_notice",
  "notified",
  "disputed",
  "charged",
  "failed",
  "waived",
  "invoiced",
  "pending_transfer",
] as const;
type SurchargeTab = (typeof SURCHARGE_TABS)[number];

const { t } = useI18n();
const { access } = useAccess();

const canWrite = computed(() => canWriteSurcharges(access.value));
const canAdmin = computed(() => canAdminSurcharges(access.value));

const rows = ref<PaySurcharge[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(SURCHARGE_PER_PAGE);
const loading = ref(false);
const errorKind = ref<SurchargeErrorKind | null>(null);
const tab = ref<SurchargeTab>("all");
const customerId = ref<number | null>(null);

const proposeOpen = ref(false);
const actionOpen = ref(false);
const actionName = ref<SurchargeAction | null>(null);
const actionTarget = ref<PaySurcharge | null>(null);
const detailOpen = ref(false);
const detailTarget = ref<PaySurcharge | null>(null);

/** Acciones que se pintan en una fila (estado + scopes). */
function actionsOf(r: PaySurcharge): SurchargeAction[] {
  return availableActions(r, access.value);
}

/**
 * Carga la pestaña actual. Ante un error se vacía la lista y se guarda el tipo (la plantilla pinta el aviso, no el estado
 * «sin recargos»). Si la página queda fuera de rango (tras resolver la última fila de la última página) retrocede.
 */
async function load(): Promise<void> {
  loading.value = true;
  errorKind.value = null;
  try {
    if (tab.value === "pending_transfer") {
      const list = await paySurcharges.pendingTransfer();
      rows.value = list;
      total.value = list.length;
      return;
    }
    const res = await paySurcharges.list({
      status: tab.value === "all" ? undefined : (tab.value as PaySurchargeStatus),
      customerId: customerId.value ?? undefined,
      page: page.value,
      perPage: perPage.value,
    });
    rows.value = res.rows;
    total.value = res.total;
    const last = pageCount(res.total, res.perPage);
    if (!res.rows.length && res.total > 0 && page.value > last) {
      page.value = last; // dispara el watch y recarga
    }
  } catch (e) {
    rows.value = [];
    total.value = 0;
    errorKind.value = classifySurchargeError(e);
  } finally {
    loading.value = false;
  }
}

function openAction(a: SurchargeAction, r: PaySurcharge): void {
  actionName.value = a;
  actionTarget.value = r;
  actionOpen.value = true;
}

function openDetail(r: PaySurcharge): void {
  detailTarget.value = r;
  detailOpen.value = true;
}

// Cambiar de pestaña o de cliente vuelve a la página 1; cambiar de página recarga.
watch([tab, customerId], () => {
  if (page.value !== 1) page.value = 1;
  else void load();
});
watch(page, () => void load());
onMounted(() => void load());
</script>

<style scoped>
.sur-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sur-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sur-title {
  font-size: 1.25rem;
  font-weight: 600;
}
.sur-filter {
  max-width: 420px;
}
.sur-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}
.sur-actions {
  white-space: nowrap;
}
.sur-actions > * + * {
  margin-left: 4px;
}
</style>
