<template>
  <div class="aut-page">
    <div class="aut-toolbar">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="{ name: 'payments' }">
        {{ t("payments.authorizations.back") }}
      </v-btn>
      <h1 class="aut-title">{{ t("payments.authorizations.title") }}</h1>
      <v-chip v-if="!loading && !errorKind" size="small" variant="tonal">{{ total }}</v-chip>
      <v-spacer />
      <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="load">
        {{ t("payments.authorizations.refresh") }}
      </v-btn>
      <!-- Alta en nombre del cliente: solo con payment_gateways:write. -->
      <v-btn
        v-if="canWrite"
        color="primary"
        prepend-icon="mdi-plus"
        data-testid="authorization-create-open"
        @click="createOpen = true"
      >
        {{ t("payments.authorizations.create.open") }}
      </v-btn>
    </div>

    <div class="text-body-2 text-medium-emphasis">{{ t("payments.authorizations.intro") }}</div>

    <div class="aut-filters">
      <v-select
        v-model="status"
        :items="statusItems"
        :label="t('payments.authorizations.col.status')"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        data-testid="authorization-status-filter"
      />
      <CustomerPicker v-model="customerId" :label="t('payments.surcharges.customer_filter')" />
    </div>

    <v-alert
      v-if="errorKind"
      :type="errorKind === 'forbidden' ? 'warning' : 'error'"
      variant="tonal"
      density="compact"
      data-testid="authorization-load-error"
    >
      {{ t(`payments.surcharges.errors.${errorKind}`) }}
    </v-alert>

    <div v-else-if="loading && !rows.length" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <v-alert v-else-if="!rows.length" type="info" variant="tonal" density="compact" data-testid="authorization-empty">
      {{ t("payments.authorizations.empty") }}
    </v-alert>

    <template v-else>
      <v-table density="comfortable" data-testid="authorization-table">
        <thead>
          <tr>
            <th>{{ t("payments.authorizations.col.id") }}</th>
            <th>{{ t("payments.list.customer") }}</th>
            <th>{{ t("payments.authorizations.col.method") }}</th>
            <th>{{ t("payments.authorizations.col.status") }}</th>
            <th class="text-end">{{ t("payments.authorizations.col.caps") }}</th>
            <th>{{ t("payments.authorizations.col.terms") }}</th>
            <th>{{ t("payments.authorizations.col.consent") }}</th>
            <th class="text-end">{{ t("payments.authorizations.col.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.public_id" :data-testid="`authorization-row-${r.public_id}`">
            <td class="aut-mono">{{ r.public_id }}</td>
            <td>{{ r.customer_name || '' }} <span class="text-medium-emphasis">#{{ r.customer_id }}</span></td>
            <td>{{ describeMethod(r) }}</td>
            <td>
              <v-chip :color="authorizationStatusColor(r.status)" size="small" label variant="tonal">
                {{ t(`payments.authorizations.status.${r.status}`) }}
              </v-chip>
              <div v-if="r.failure_code" class="text-caption text-error">{{ r.failure_code }}</div>
            </td>
            <td class="text-end text-caption">
              {{ formatMinor(r.max_charge_minor, r.currency) }}
              <br />
              {{ t("payments.authorizations.per_month", { amount: formatMinor(r.max_month_minor, r.currency) }) }}
            </td>
            <td class="text-caption">
              {{ t("payments.authorizations.terms_days", { notice: r.notice_days, dispute: r.dispute_days }) }}
            </td>
            <td class="text-caption">
              {{ r.consent_text_version }}
              <br />
              {{ r.consent_at || "—" }}
            </td>
            <td class="text-end">
              <v-btn
                v-for="a in actionsOf(r)"
                :key="a"
                size="small"
                variant="tonal"
                color="warning"
                :data-testid="`authorization-${a}-${r.public_id}`"
                @click="askRevoke(r)"
              >
                {{ t("payments.authorizations.revoke") }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div class="d-flex justify-center">
        <v-pagination v-model="page" :length="pageCount(total, perPage)" :total-visible="7" density="comfortable" />
      </div>
    </template>

    <AuthorizationCreateDialog v-model="createOpen" @created="load" />

    <!-- Confirmación de revocación: retirar el permiso es un derecho del cliente y no mueve dinero. -->
    <v-dialog v-model="revokeOpen" max-width="440" persistent>
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t("payments.authorizations.revoke_title") }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-2">{{ t("payments.authorizations.revoke_body") }}</div>
          <v-alert v-if="revokeError" type="error" variant="tonal" density="compact" data-testid="revoke-error">
            {{ t(`payments.surcharges.errors.${revokeError}`) }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="revoking" @click="revokeOpen = false">{{ t("common.cancel") }}</v-btn>
          <v-btn color="warning" :loading="revoking" data-testid="revoke-confirm" @click="doRevoke">
            {{ t("payments.authorizations.revoke") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * «Autorizaciones de cobro»: pantalla de personal y partner para consultar, dar de alta y revocar las autorizaciones que
 * firman sus clientes para que el vendedor les cobre después recargos (sobrepeso, oversize u otros) sin que estén presentes.
 *
 * Datos: `GET api_pay_authorizations` paginado (servidor), con filtro por estado y por cliente. El partner sale del token; el
 * filtro de cliente solo estrecha su propia cartera. El personal ve marca, últimos 4, caducidad, topes y plazos aceptados,
 * versión y fecha del consentimiento, `failure_code` y el estado; NUNCA referencias del proveedor, cuenta de pasarela, IP ni
 * user agent (la API no los envía).
 *
 * Permisos (solo UX; el API autoriza): ver exige `payment_gateways:read` (guard de ruta); dar de alta y revocar exigen
 * `payment_gateways:write`, y sin él no se pinta ningún botón. El alta es el diálogo `AuthorizationCreateDialog`
 * (apagada por defecto en el servidor: 503 `PAYMENT_NOT_ACTIVE`); revocar y leer funcionan siempre.
 *
 * Errores de carga: 403 -> aviso de permiso; cualquier otro -> aviso de error SIN lista vacía. Lógica pura en
 * `components/authorizationsModel.ts` y `components/surchargesModel.ts`.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAccess } from "@shared/composables/useAccess";
import {
  PAY_AUTHORIZATION_STATUSES,
  payAuthorizations,
  type PayAuthorization,
  type PayAuthorizationStatus,
} from "@shared/payment_gateways/services/paymentGateways.service";
import AuthorizationCreateDialog from "../components/AuthorizationCreateDialog.vue";
import CustomerPicker from "../components/CustomerPicker.vue";
import { useToastStore } from "../stores/toast.store";
import {
  authorizationStatusColor,
  availableAuthorizationActions,
  describeMethod,
  type AuthorizationAction,
} from "../components/authorizationsModel";
import {
  SURCHARGE_PER_PAGE,
  canWriteSurcharges,
  classifySurchargeError,
  formatMinor,
  pageCount,
  type SurchargeErrorKind,
} from "../components/surchargesModel";

const { t } = useI18n();
const { access } = useAccess();
const toasts = useToastStore();

const canWrite = computed(() => canWriteSurcharges(access.value));
const statusItems = computed(() =>
  PAY_AUTHORIZATION_STATUSES.map((v) => ({ value: v, title: t(`payments.authorizations.status.${v}`) })),
);

const rows = ref<PayAuthorization[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(SURCHARGE_PER_PAGE);
const loading = ref(false);
const errorKind = ref<SurchargeErrorKind | null>(null);
const status = ref<PayAuthorizationStatus | null>(null);
const customerId = ref<number | null>(null);
const createOpen = ref(false);

const revokeOpen = ref(false);
const revokeTarget = ref<PayAuthorization | null>(null);
const revoking = ref(false);
const revokeError = ref<SurchargeErrorKind | null>(null);

function actionsOf(r: PayAuthorization): AuthorizationAction[] {
  return availableAuthorizationActions(r, access.value);
}

/** Carga la página actual; ante un error vacía la lista y guarda el tipo (la plantilla pinta el aviso, no «sin autorizaciones»). */
async function load(): Promise<void> {
  loading.value = true;
  errorKind.value = null;
  try {
    const res = await payAuthorizations.list({
      status: status.value ?? undefined,
      customerId: customerId.value ?? undefined,
      page: page.value,
      perPage: perPage.value,
    });
    rows.value = res.rows;
    total.value = res.total;
    const last = pageCount(res.total, res.perPage);
    if (!res.rows.length && res.total > 0 && page.value > last) {
      page.value = last;
    }
  } catch (e) {
    rows.value = [];
    total.value = 0;
    errorKind.value = classifySurchargeError(e);
  } finally {
    loading.value = false;
  }
}

function askRevoke(r: PayAuthorization): void {
  revokeTarget.value = r;
  revokeError.value = null;
  revokeOpen.value = true;
}

async function doRevoke(): Promise<void> {
  if (!revokeTarget.value) return;
  revoking.value = true;
  revokeError.value = null;
  try {
    await payAuthorizations.revoke(revokeTarget.value.public_id);
    toasts.push("success", t("payments.authorizations.revoked_done"));
    revokeOpen.value = false;
    await load();
  } catch (e) {
    revokeError.value = classifySurchargeError(e);
  } finally {
    revoking.value = false;
  }
}

watch([status, customerId], () => {
  if (page.value !== 1) page.value = 1;
  else void load();
});
watch(page, () => void load());
onMounted(() => void load());
</script>

<style scoped>
.aut-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.aut-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.aut-title {
  font-size: 1.25rem;
  font-weight: 600;
}
.aut-filters {
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(220px, 420px);
  gap: 12px;
}
.aut-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}
</style>
