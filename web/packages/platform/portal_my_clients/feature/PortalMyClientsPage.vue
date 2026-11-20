<template>
  <div>
    <CmSectionHeader :title="t('portal_my_clients.title')" :subtitle="t('portal_my_clients.subtitle')">
      <template #actions>
        <v-btn
          v-if="!productionDisabled"
          color="primary"
          :prepend-icon="mdiPlus"
          :disabled="capReached"
          @click="openCreate"
        >
          {{ t('portal_my_clients.new_client') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <!-- 403: autoservicio deshabilitado en este ERP (producción). El backend ya trae el mensaje explicativo. -->
    <v-alert v-if="productionDisabled" type="info" variant="tonal" class="mb-4">
      {{ productionDisabledMessage }}
    </v-alert>

    <template v-else>
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="error = null">
        {{ error }}
      </v-alert>

      <v-card variant="outlined" class="pa-3 mb-4 pmc-limits">
        <span>{{ t('portal_my_clients.limits_total', { count: listResult.count, max: listResult.limits.max_clients_per_user }) }}</span>
        <span class="pmc-limits-sep">·</span>
        <span>{{ t('portal_my_clients.limits_rate', { max: listResult.limits.create_rate_limit_per_hour }) }}</span>
        <v-chip v-if="capReached" size="small" color="warning" variant="flat" class="ml-2">
          {{ t('portal_my_clients.cap_reached') }}
        </v-chip>
      </v-card>

      <CmEmptyState v-if="!loading && items.length === 0" :icon="mdiApi" :title="t('portal_my_clients.empty_title')" />
      <ListingDataView
        v-else
        :source="listSource"
        :headers="tableHeaders"
        :selected="selected"
        mode="infinite"
        :selectable="false"
        @update:selected="selected = $event"
      >
        <template #cell.client_name="{ item }">
          <div class="font-weight-medium">{{ (item as PortalOAuthClient).client_name || t('portal_my_clients.unnamed') }}</div>
          <div class="cm-cell-hint pmc-mono">{{ (item as PortalOAuthClient).client_id }}</div>
        </template>
        <template #cell.contact="{ item }">
          <div v-if="(item as PortalOAuthClient).company_name">{{ (item as PortalOAuthClient).company_name }}</div>
          <div class="cm-cell-hint">{{ (item as PortalOAuthClient).contact_email }}</div>
        </template>
        <template #cell.status="{ item }">
          <v-chip size="small" :color="(item as PortalOAuthClient).status === 'active' ? 'success' : undefined" variant="flat">
            {{ t(`portal_my_clients.status_${(item as PortalOAuthClient).status}`) }}
          </v-chip>
          <div v-if="(item as PortalOAuthClient).status === 'disabled' && (item as PortalOAuthClient).disabled_reason" class="cm-cell-hint">
            {{ (item as PortalOAuthClient).disabled_reason }}
          </div>
        </template>
        <template #cell.created_at="{ item }">
          <span class="cm-cell-hint">{{ (item as PortalOAuthClient).created_at || '—' }}</span>
        </template>
        <template #cell.last_activity_at="{ item }">
          <span class="cm-cell-hint">{{ (item as PortalOAuthClient).last_activity_at || t('portal_my_clients.never') }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as PortalOAuthClient)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn size="small" variant="text" :prepend-icon="mdiRefresh" :loading="rotatingId === (item as PortalOAuthClient).id" @click="confirmRotate(item as PortalOAuthClient)">
              {{ t('portal_my_clients.rotate') }}
            </v-btn>
            <v-btn
              v-if="(item as PortalOAuthClient).status === 'active'"
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiPauseCircleOutline"
              @click="confirmDisable(item as PortalOAuthClient)"
            >
              {{ t('portal_my_clients.disable') }}
            </v-btn>
            <v-btn
              v-else
              size="small"
              variant="text"
              :prepend-icon="mdiPlayCircleOutline"
              @click="enableClient(item as PortalOAuthClient)"
            >
              {{ t('portal_my_clients.enable') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
    </template>

    <!-- Alta -->
    <v-dialog v-model="createDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>{{ t('portal_my_clients.dialog_create') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="createForm.client_name"
            :label="t('portal_my_clients.form_client_name')"
            :hint="t('portal_my_clients.form_client_name_hint')"
            persistent-hint
            maxlength="200"
            autofocus
          />
          <v-text-field v-model="createForm.company_name" :label="t('portal_my_clients.form_company_name')" maxlength="200" class="mt-3" />
          <v-text-field v-model="createForm.contact_email" :label="t('portal_my_clients.form_contact_email')" type="email" maxlength="100" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="createDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="submitCreate">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edición de metadata -->
    <v-dialog v-model="editDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>{{ t('portal_my_clients.dialog_edit') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="editForm.client_name" :label="t('portal_my_clients.form_client_name')" maxlength="200" autofocus />
          <v-text-field v-model="editForm.company_name" :label="t('portal_my_clients.form_company_name')" maxlength="200" class="mt-3" />
          <v-text-field v-model="editForm.contact_email" :label="t('portal_my_clients.form_contact_email')" type="email" maxlength="100" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="editDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="submitEdit">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Secreto revelado UNA vez (create/rotate). No persiste en ningún store ni localStorage. -->
    <v-dialog v-model="secretDialog" max-width="560" persistent>
      <v-card variant="outlined" color="error">
        <v-card-title>{{ t('portal_my_clients.secret_title') }}</v-card-title>
        <v-card-text>
          <p class="pmc-secret-warn mb-3">{{ t('portal_my_clients.secret_warning') }}</p>
          <div class="pmc-secret-row">
            <span class="pmc-secret-label">{{ t('portal_my_clients.field_client_id') }}</span>
            <code class="pmc-secret-value">{{ revealedClientId }}</code>
            <v-btn :icon="mdiContentCopy" size="x-small" variant="text" :title="t('common.copy')" @click="copy(revealedClientId)" />
          </div>
          <div class="pmc-secret-row">
            <span class="pmc-secret-label">{{ t('portal_my_clients.field_client_secret') }}</span>
            <code class="pmc-secret-value">{{ revealedSecret }}</code>
            <v-btn :icon="mdiContentCopy" size="x-small" variant="text" :title="t('common.copy')" @click="copy(revealedSecret)" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="secretDialog = false">{{ t('portal_my_clients.secret_done') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Autoservicio de aplicaciones OAuth2 propias (ver settings/settingsCatalog.ts,
 * tarjeta `portal_my_oauth_clients`). SIN `meta.requiresAdmin` en el router
 * (mismo patrón que `ElevenlabsPartnerAgentPage.vue`): la autoriza el
 * servidor (`Portal_My_Clients_Controller`, policy `public_oauth`, sin scope),
 * así que cualquier usuario autenticado llega aquí.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiRefresh, mdiPauseCircleOutline, mdiPlayCircleOutline, mdiContentCopy, mdiApi,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  portalMyClientsService,
  isSelfServiceDisabledError,
  isClientCapReached,
  type PortalOAuthClient,
  type PortalClientListResult,
} from '../services/portalMyClients.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const productionDisabled = ref(false);
const productionDisabledMessage = ref('');
const selected = ref<{ id: number }[]>([]);
const rotatingId = ref<number | null>(null);

const listResult = reactive<PortalClientListResult>({
  count: 0,
  limits: { max_clients_per_user: 0, create_rate_limit_per_hour: 0 },
  clients: [],
});
const items = computed(() => listResult.clients);
const capReached = computed(() => isClientCapReached(listResult));

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('portal_my_clients.col_client') as string, key: 'client_name' },
  { title: t('portal_my_clients.col_contact') as string, key: 'contact', sortable: false },
  { title: t('portal_my_clients.col_status') as string, key: 'status' },
  { title: t('portal_my_clients.col_created') as string, key: 'created_at' },
  { title: t('portal_my_clients.col_last_activity') as string, key: 'last_activity_at' },
  { title: t('portal_my_clients.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const r = await portalMyClientsService.list();
    Object.assign(listResult, r);
    productionDisabled.value = false;
  } catch (e) {
    if (isSelfServiceDisabledError(e)) {
      productionDisabled.value = true;
      productionDisabledMessage.value = e instanceof Error ? e.message : t('portal_my_clients.production_disabled_fallback');
    } else {
      error.value = messageOf(e);
    }
  } finally {
    loading.value = false;
  }
}

// ------------------------------------------------------------------- alta

const createDialog = ref(false);
const createForm = reactive({ client_name: '', company_name: '', contact_email: '' });

function openCreate(): void {
  Object.assign(createForm, { client_name: '', company_name: '', contact_email: '' });
  createDialog.value = true;
}

async function submitCreate(): Promise<void> {
  saving.value = true;
  try {
    const result = await portalMyClientsService.create({
      client_name: createForm.client_name.trim() || undefined,
      company_name: createForm.company_name.trim() || undefined,
      contact_email: createForm.contact_email.trim() || undefined,
    });
    createDialog.value = false;
    revealSecret(result.client_id, result.client_secret);
    toast.success(t('portal_my_clients.created'));
    await load();
  } catch (e) {
    // El 429 (rate-limit u soft-cap) trae su propio mensaje del backend;
    // messageOf() ya lo recupera tal cual, sin contador local — ver
    // comentario de `PortalClientLimits.create_rate_limit_per_hour`.
    toast.error(messageOf(e));
  } finally {
    saving.value = false;
  }
}

// --------------------------------------------------------------- edición

const editDialog = ref(false);
const editForm = reactive({ id: 0, client_name: '', company_name: '', contact_email: '' });

function openEdit(c: PortalOAuthClient): void {
  Object.assign(editForm, {
    id: c.id, client_name: c.client_name, company_name: c.company_name, contact_email: c.contact_email,
  });
  editDialog.value = true;
}

async function submitEdit(): Promise<void> {
  saving.value = true;
  try {
    await portalMyClientsService.updateMetadata(editForm.id, {
      client_name: editForm.client_name.trim(),
      company_name: editForm.company_name.trim(),
      contact_email: editForm.contact_email.trim(),
    });
    editDialog.value = false;
    toast.success(t('portal_my_clients.updated'));
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    saving.value = false;
  }
}

// --------------------------------------------------------- rotar / disable / enable

async function confirmRotate(c: PortalOAuthClient): Promise<void> {
  const ok = await confirm.ask({
    title: t('portal_my_clients.confirm_rotate_title') as string,
    message: t('portal_my_clients.confirm_rotate_message', { name: c.client_name }) as string,
    confirmLabel: t('portal_my_clients.rotate') as string,
    variant: 'danger',
  });
  if (!ok) return;
  rotatingId.value = c.id;
  try {
    const result = await portalMyClientsService.rotate(c.id);
    revealSecret(result.client_id, result.client_secret);
    toast.success(t('portal_my_clients.rotated'));
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    rotatingId.value = null;
  }
}

async function confirmDisable(c: PortalOAuthClient): Promise<void> {
  const ok = await confirm.ask({
    title: t('portal_my_clients.confirm_disable_title') as string,
    message: t('portal_my_clients.confirm_disable_message', { name: c.client_name }) as string,
    confirmLabel: t('portal_my_clients.disable') as string,
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await portalMyClientsService.disable(c.id);
    toast.success(t('portal_my_clients.disabled'));
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}

async function enableClient(c: PortalOAuthClient): Promise<void> {
  try {
    await portalMyClientsService.enable(c.id);
    toast.success(t('portal_my_clients.enabled'));
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}

// ------------------------------------------------------------- secreto one-time

const secretDialog = ref(false);
const revealedClientId = ref('');
const revealedSecret = ref('');

function revealSecret(clientId: string, secret: string): void {
  revealedClientId.value = clientId;
  revealedSecret.value = secret;
  secretDialog.value = true;
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  } catch {
    toast.error(t('common.copy_failed'));
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.pmc-limits {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
  color: var(--cm-text-secondary, rgba(0, 0, 0, 0.6));
}
.pmc-limits-sep {
  opacity: 0.5;
}
.pmc-mono {
  font-family: var(--cm-font-mono, monospace);
}
.pmc-secret-warn {
  font-size: 0.85em;
}
.pmc-secret-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.pmc-secret-label {
  min-width: 110px;
  font-size: 0.85em;
  opacity: 0.8;
}
.pmc-secret-value {
  flex: 1;
  font-family: var(--cm-font-mono, monospace);
  background: rgba(0, 0, 0, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  word-break: break-all;
}
</style>
