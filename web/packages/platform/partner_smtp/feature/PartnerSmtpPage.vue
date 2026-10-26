<template>
  <div>
    <CmSectionHeader
      :title="isAdmin ? t('partner_smtp.title_admin') : t('partner_smtp.title')"
      :subtitle="isAdmin ? t('partner_smtp.subtitle_admin') : t('partner_smtp.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" :disabled="isAdmin && !partnerId" @click="openCreate">
          {{ t('partner_smtp.new_account') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card v-if="isAdmin" class="pa-4 mb-4" variant="outlined">
      <CmAnagraficaAutocomplete v-model="partnerId" :label="t('partner_smtp.filter_partner')" @update:model-value="reload" />
      <div v-if="!partnerId" class="text-body-2 cm-cell-hint mt-2">{{ t('partner_smtp.pick_partner_hint') }}</div>
    </v-card>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">{{ loadError }}</v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <v-table density="compact" data-testid="smtp-accounts">
        <thead>
          <tr>
            <th v-if="isAdmin">{{ t('partner_smtp.col_partner') }}</th>
            <th>{{ t('partner_smtp.field_purpose') }}</th>
            <th>{{ t('partner_smtp.field_environment') }}</th>
            <th>{{ t('partner_smtp.col_server') }}</th>
            <th>{{ t('partner_smtp.field_from_email') }}</th>
            <th>{{ t('partner_smtp.col_test') }}</th>
            <th class="text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && !accounts.length">
            <td :colspan="isAdmin ? 7 : 6" class="text-center cm-cell-hint py-4">{{ t('partner_smtp.empty') }}</td>
          </tr>
          <tr v-for="a in accounts" :key="a.id" :data-testid="`smtp-row-${a.id}`">
            <td v-if="isAdmin">{{ a.partner_name || `#${a.partner_id}` }}</td>
            <td>{{ t(`partner_smtp.purpose_${a.purpose}`) }}</td>
            <td>{{ t(`partner_smtp.env_${a.environment}`) }}</td>
            <td class="cm-mono">
              {{ a.smtp_server }}:{{ a.smtp_port }} · {{ a.smtp_security }}
              <v-icon v-if="!a.has_password" :icon="mdiAlertOutline" size="14" color="warning" :title="t('partner_smtp.no_password')" />
            </td>
            <td>{{ a.from_email }}</td>
            <td>
              <v-chip v-if="a.last_test_ok === true" size="x-small" color="success" variant="flat">{{ t('partner_smtp.test_ok') }}</v-chip>
              <v-chip v-else-if="a.last_test_ok === false" size="x-small" color="error" variant="flat">{{ t('partner_smtp.test_failed') }}</v-chip>
              <span v-else class="cm-cell-hint">{{ t('partner_smtp.test_never') }}</span>
            </td>
            <td class="text-right">
              <v-btn size="small" variant="text" :icon="mdiEmailFast" :title="t('partner_smtp.test')" @click="openTest(a)" />
              <v-btn size="small" variant="text" :icon="mdiPencil" :title="t('common.edit')" @click="openEdit(a)" />
              <v-btn size="small" variant="text" color="error" :icon="mdiDelete" :title="t('common.delete')" @click="remove(a)" />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-card v-if="!isAdmin || partnerId" class="pa-4 mb-4" variant="outlined" data-testid="smtp-effective">
      <div class="text-subtitle-2 mb-1">{{ t('partner_smtp.effective_title') }}</div>
      <div class="text-body-2 cm-cell-hint mb-3">{{ t('partner_smtp.effective_hint') }}</div>
      <v-table density="compact">
        <tbody>
          <tr v-for="e in effective" :key="e.purpose">
            <td class="font-weight-medium">{{ t(`partner_smtp.purpose_${e.purpose}`) }}</td>
            <td>
              <v-chip size="x-small" :color="sourceColor(e.source)" variant="flat">{{ t(`partner_smtp.source_${e.source}`) }}</v-chip>
            </td>
            <td class="cm-mono">{{ e.from_email || '—' }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <PartnerSmtpFormDialog v-model="formOpen" :service="service" :account="editing" :partner-id="partnerId ?? undefined" @saved="onSaved" />

    <v-dialog v-model="testOpen" max-width="440">
      <v-card>
        <v-card-title>{{ t('partner_smtp.test') }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">{{ t('partner_smtp.test_hint', { limit: 5 }) }}</p>
          <v-text-field v-model="testRecipient" type="email" :label="t('partner_smtp.test_recipient')" density="compact" />
          <v-alert v-if="testMessage" :type="testOk ? 'success' : 'error'" variant="tonal" density="compact">{{ testMessage }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="testOpen = false">{{ t('common.close') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="testing" :disabled="!testRecipient" @click="runTest">{{ t('partner_smtp.test_send') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlertOutline, mdiDelete, mdiEmailFast, mdiPencil, mdiPlus } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import PartnerSmtpFormDialog from './PartnerSmtpFormDialog.vue';
import {
  partnerSmtpAdmin,
  partnerSmtpSelf,
  type SmtpAccount,
  type SmtpEffective,
  type SmtpSource,
} from '../services/partnerSmtp.service';

/** `self`: el administrador del partner gestiona las suyas. `admin`: TMWE sobre cualquier partner. */
const props = defineProps<{ scope: 'self' | 'admin' }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const isAdmin = computed(() => props.scope === 'admin');
const service = computed(() => (isAdmin.value ? partnerSmtpAdmin : partnerSmtpSelf));

const partnerId = ref<number | null>(null);
const accounts = ref<SmtpAccount[]>([]);
const effective = ref<SmtpEffective[]>([]);
const loading = ref(false);
const loadError = ref('');

const formOpen = ref(false);
const editing = ref<SmtpAccount | null>(null);

const testOpen = ref(false);
const testTarget = ref<SmtpAccount | null>(null);
const testRecipient = ref('');
const testing = ref(false);
const testOk = ref(false);
const testMessage = ref('');

function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t('partner_smtp.error_generic');
}

async function reload(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const pid = partnerId.value ?? undefined;
    accounts.value = await service.value.list({ partnerId: pid });
    effective.value = !isAdmin.value || pid ? await service.value.effective(pid) : [];
  } catch (e) {
    loadError.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function sourceColor(s: SmtpSource): string {
  return s === 'own' ? 'success' : s === 'tmwe_default' ? 'info' : 'warning';
}

function openCreate(): void {
  editing.value = null;
  formOpen.value = true;
}
function openEdit(a: SmtpAccount): void {
  editing.value = a;
  formOpen.value = true;
}
async function onSaved(): Promise<void> {
  toast.success(t('partner_smtp.saved'));
  await reload();
}

async function remove(a: SmtpAccount): Promise<void> {
  const ok = await confirm.askDanger(
    t('partner_smtp.confirm_delete_message', { server: a.smtp_server, purpose: t(`partner_smtp.purpose_${a.purpose}`) }),
    t('partner_smtp.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await service.value.remove(a.id);
    toast.success(t('partner_smtp.deleted'));
    await reload();
  } catch (e) {
    toast.error(errMsg(e));
  }
}

function openTest(a: SmtpAccount): void {
  testTarget.value = a;
  testMessage.value = '';
  testOk.value = false;
  testOpen.value = true;
}
async function runTest(): Promise<void> {
  if (!testTarget.value) return;
  testing.value = true;
  testMessage.value = '';
  try {
    await service.value.test({ id: testTarget.value.id, test_recipient: testRecipient.value });
    testOk.value = true;
    testMessage.value = t('partner_smtp.test_sent', { to: testRecipient.value });
  } catch (e) {
    testOk.value = false;
    testMessage.value = errMsg(e);
  } finally {
    testing.value = false;
    await reload();
  }
}

onMounted(reload);
</script>
