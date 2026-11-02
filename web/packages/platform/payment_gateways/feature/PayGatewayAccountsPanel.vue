<template>
  <div>
    <div class="d-flex align-center mb-3">
      <v-spacer />
      <v-btn v-if="!isAdmin" color="primary" :prepend-icon="mdiPlus" data-testid="pay-new" @click="openCreate">
        {{ t('pay_gateways.new_account') }}
      </v-btn>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" data-testid="pay-load-error">{{ loadError }}</v-alert>
    <v-alert v-if="!isAdmin" type="info" variant="tonal" density="compact" class="mb-4">{{ t('pay_gateways.fallback_hint') }}</v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <v-table density="compact" data-testid="pay-accounts">
        <thead>
          <tr>
            <th v-if="isAdmin">{{ t('pay_gateways.col_partner') }}</th>
            <th>{{ t('pay_gateways.field_alias') }}</th>
            <th>{{ t('pay_gateways.field_provider') }}</th>
            <th>{{ t('pay_gateways.field_environment') }}</th>
            <th>{{ t('pay_gateways.field_methods') }}</th>
            <th>{{ t('pay_gateways.col_secret') }}</th>
            <th>{{ t('pay_gateways.field_status') }}</th>
            <th>{{ t('pay_gateways.col_verified') }}</th>
            <th v-if="!isAdmin" class="text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && !accounts.length">
            <td :colspan="isAdmin ? 8 : 9" class="text-center cm-cell-hint py-4">{{ t('pay_gateways.empty') }}</td>
          </tr>
          <tr v-for="a in accounts" :key="a.public_id" :data-testid="`pay-row-${a.public_id}`">
            <td v-if="isAdmin">{{ a.partner_name || `#${a.partner_id}` }}</td>
            <td>
              {{ a.account_alias }}
              <v-icon v-if="a.principale === 'S'" :icon="mdiStar" size="14" color="warning" :title="t('pay_gateways.principal')" />
            </td>
            <td>{{ t(`pay_gateways.provider_${a.provider}`) }}</td>
            <td>{{ t(`pay_gateways.env_${a.environment}`) }}</td>
            <td>
              <v-chip v-for="m in methods(a)" :key="m" size="x-small" class="mr-1" variant="tonal">{{ methodLabel(m) }}</v-chip>
            </td>
            <td class="cm-mono">
              <span v-if="a.secret_hint">••••{{ a.secret_hint }}</span>
              <span v-else class="cm-cell-hint">—</span>
              <v-icon v-if="!truthy(a.has_webhook_secret)" :icon="mdiAlertOutline" size="14" color="warning" :title="t('pay_gateways.no_webhook_secret')" />
            </td>
            <td>
              <v-chip size="x-small" :color="statusColor(a.status)" variant="flat">{{ t(`pay_gateways.status_${a.status}`) }}</v-chip>
            </td>
            <td class="cm-cell-hint">{{ a.last_verified_at || t('pay_gateways.never') }}</td>
            <td v-if="!isAdmin" class="text-right">
              <v-btn size="small" variant="text" :icon="mdiCheckNetworkOutline" :loading="busy === a.public_id" :title="t('pay_gateways.validate')" data-testid="pay-validate" @click="validate(a)" />
              <v-btn v-if="a.principale !== 'S'" size="small" variant="text" :icon="mdiStarOutline" :title="t('pay_gateways.set_principal')" @click="setPrincipal(a)" />
              <v-btn size="small" variant="text" :icon="mdiKeyChange" :title="t('pay_gateways.rotate_title')" @click="openRotate(a)" />
              <v-btn size="small" variant="text" :icon="mdiPencil" :title="t('common.edit')" @click="openEdit(a)" />
              <v-btn size="small" variant="text" color="error" :icon="mdiDelete" :title="t('common.delete')" @click="remove(a)" />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-card v-if="!isAdmin && accounts.length" class="pa-4 mb-4" variant="outlined" data-testid="pay-webhook-info">
      <div class="text-subtitle-2 mb-1">{{ t('pay_gateways.webhook_title') }}</div>
      <div class="text-body-2 cm-cell-hint mb-2">{{ t('pay_gateways.webhook_hint') }}</div>
      <div v-for="a in accounts" :key="a.public_id" class="cm-mono text-body-2">
        {{ a.account_alias }}: <code>/ingress/pay_webhook.php?a={{ a.public_id }}</code>
      </div>
    </v-card>

    <PayGatewayAccountFormDialog v-model="formOpen" :account="editing" @saved="onSaved" />
    <PayGatewayRotateDialog v-model="rotateOpen" :account="rotating" @saved="onRotated" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlertOutline, mdiCheckNetworkOutline, mdiDelete, mdiKeyChange, mdiPencil, mdiPlus, mdiStar, mdiStarOutline } from '@mdi/js';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import PayGatewayAccountFormDialog from './PayGatewayAccountFormDialog.vue';
import PayGatewayRotateDialog from './PayGatewayRotateDialog.vue';
import {
  enabledMethods,
  payGatewayAccounts,
  payGatewayAccountsAdmin,
  truthy,
  type PayAccountStatus,
  type PayGatewayAccount,
} from '../services/paymentGateways.service';

/**
 * Cuentas de pasarela. `self`: el partner gestiona las SUYAS (la API toma el partner del token). `admin`: TMWE las
 * consulta de cualquier partner (`partnerId` filtra), solo lectura y sin secretos.
 */
const props = defineProps<{ scope: 'self' | 'admin'; partnerId?: number | null }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const isAdmin = computed(() => props.scope === 'admin');
const accounts = ref<PayGatewayAccount[]>([]);
const loading = ref(false);
const loadError = ref('');
const busy = ref('');

const formOpen = ref(false);
const editing = ref<PayGatewayAccount | null>(null);
const rotateOpen = ref(false);
const rotating = ref<PayGatewayAccount | null>(null);

function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t('pay_gateways.error_generic');
}
const methods = (a: PayGatewayAccount): string[] => enabledMethods(a);
const methodLabel = (m: string): string => t(`pay_gateways.method_${m}`);
function statusColor(s: PayAccountStatus): string {
  return s === 'active' ? 'success' : s === 'invalid' ? 'error' : 'grey';
}

async function reload(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    accounts.value = isAdmin.value
      ? await payGatewayAccountsAdmin.list({ partnerId: props.partnerId })
      : await payGatewayAccounts.list();
  } catch (e) {
    loadError.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  formOpen.value = true;
}
function openEdit(a: PayGatewayAccount): void {
  editing.value = a;
  formOpen.value = true;
}
function openRotate(a: PayGatewayAccount): void {
  rotating.value = a;
  rotateOpen.value = true;
}
async function onSaved(): Promise<void> {
  toast.success(t('pay_gateways.saved'));
  await reload();
}
async function onRotated(): Promise<void> {
  toast.success(t('pay_gateways.rotated'));
  await reload();
}

async function validate(a: PayGatewayAccount): Promise<void> {
  busy.value = a.public_id;
  try {
    await payGatewayAccounts.validate(a.public_id);
    toast.success(t('pay_gateways.validated'));
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = '';
    await reload();
  }
}

async function setPrincipal(a: PayGatewayAccount): Promise<void> {
  try {
    await payGatewayAccounts.setPrincipal(a.public_id);
    toast.success(t('pay_gateways.principal_set'));
    await reload();
  } catch (e) {
    toast.error(errMsg(e));
  }
}

async function remove(a: PayGatewayAccount): Promise<void> {
  const ok = await confirm.askDanger(
    t('pay_gateways.confirm_delete_message', { alias: a.account_alias }),
    t('pay_gateways.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await payGatewayAccounts.remove(a.public_id);
    toast.success(t('pay_gateways.deleted'));
    await reload();
  } catch (e) {
    toast.error(errMsg(e));
  }
}

watch(() => [props.scope, props.partnerId], reload, { immediate: true });
</script>
