<template>
  <div class="permission-audit-page">
    <CmSectionHeader
      :title="t('permission_audit.title')"
      :subtitle="t('permission_audit.subtitle')"
    />

    <!-- Filtros -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="3">
            <v-select
              v-model="queryMode"
              :items="queryModeItems"
              :label="t('permission_audit.query_mode')"
              density="comfortable"
              variant="outlined"
              @update:model-value="onQueryModeChange"
            />
          </v-col>

          <template v-if="queryMode === 'target'">
            <v-col cols="12" md="3">
              <v-select
                v-model="targetType"
                :items="targetTypeItems"
                :label="t('permission_audit.target_type')"
                density="comfortable"
                variant="outlined"
                @update:model-value="onFilterChange"
              />
            </v-col>
            <v-col cols="12" md="4">
              <CmUserAutocomplete
                v-if="targetType === 'user'"
                v-model="targetIdUser"
                :label="t('permission_audit.target_user')"
                clearable
                @update:model-value="onFilterChange"
              />
              <CmOAuthClientAutocomplete
                v-else-if="targetType === 'oauth_client'"
                v-model="targetIdClient"
                :label="t('permission_audit.target_client')"
                clearable
                @update:model-value="onFilterChange"
              />
              <v-text-field
                v-else
                v-model.number="targetIdRole"
                :label="t('permission_audit.target_role_id')"
                type="number"
                density="comfortable"
                variant="outlined"
                @update:model-value="onFilterChange"
              />
            </v-col>
          </template>

          <v-col v-if="queryMode === 'actor'" cols="12" md="7">
            <CmUserAutocomplete
              v-model="changedBy"
              :label="t('permission_audit.changed_by')"
              clearable
              @update:model-value="onFilterChange"
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-text-field
              v-model.number="limit"
              :label="t('permission_audit.limit')"
              type="number"
              min="1"
              max="500"
              density="comfortable"
              variant="outlined"
              @blur="onFilterChange"
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Resultados -->
    <CmEmptyState
      v-if="!loading && entries.length === 0"
      :title="t('permission_audit.empty_title')"
      :subtitle="t('permission_audit.empty_subtitle')"
    />
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.action="{ item }">
        <v-chip size="x-small" :color="colorForAction((item as PermissionAuditEntry).action)" variant="tonal">
          {{ (item as PermissionAuditEntry).action }}
        </v-chip>
      </template>
      <template #cell.target="{ item }">
        <code class="text-caption">{{ (item as PermissionAuditEntry).target_type }}:{{ (item as PermissionAuditEntry).target_id }}</code>
      </template>
      <template #cell.changed_by="{ item }">
        <code class="text-caption">user:{{ (item as PermissionAuditEntry).changed_by }}</code>
      </template>
      <template #cell.change_diff="{ item }">
        <v-btn
          v-if="(item as PermissionAuditEntry).change_diff"
          size="x-small"
          variant="text"
          @click="openDiff(item as PermissionAuditEntry)"
        >
          {{ t('permission_audit.view_diff') }}
        </v-btn>
        <span v-else class="text-medium-emphasis">—</span>
      </template>
      <template #cell.occurred_at="{ item }">
        <span class="text-caption">{{ formatDate((item as PermissionAuditEntry).occurred_at) }}</span>
      </template>
      <template #cell.ip="{ item }">
        <span class="text-caption text-medium-emphasis">{{ (item as PermissionAuditEntry).ip ?? '—' }}</span>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Diálogo de diff -->
    <v-dialog v-model="diffDialogOpen" max-width="700">
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ t('permission_audit.diff_dialog_title') }}
          <v-spacer />
          <v-btn icon="$close" variant="text" @click="diffDialogOpen = false" />
        </v-card-title>
        <v-card-text>
          <div v-if="diffEntry" class="pap-diff-header">
            <div>
              <strong>{{ t('permission_audit.diff_action') }}:</strong>
              <code>{{ diffEntry.action }}</code>
            </div>
            <div>
              <strong>{{ t('permission_audit.diff_target') }}:</strong>
              <code>{{ diffEntry.target_type }}:{{ diffEntry.target_id }}</code>
            </div>
            <div>
              <strong>{{ t('permission_audit.diff_actor') }}:</strong>
              <code>user:{{ diffEntry.changed_by }}</code>
            </div>
            <div>
              <strong>{{ t('permission_audit.diff_when') }}:</strong>
              {{ formatDate(diffEntry.occurred_at) }}
            </div>
          </div>
          <v-divider class="my-2" />
          <pre class="pap-diff-json">{{ formattedDiff }}</pre>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Visor de auditoría de permisos — Fase A4 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/permission_audit/PermissionAuditPage.vue`.
 *
 * Soporta 2 modos:
 *   - target: filtra por target_type + target_id
 *   - actor:  filtra por changed_by
 *
 * Deep-link: ?target_type=user&target_id=N (usado por UserSecurityPanel).
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmUserAutocomplete from '../../oauth_clients/components/CmUserAutocomplete.vue';
import CmOAuthClientAutocomplete from '../../oauth_clients/components/CmOAuthClientAutocomplete.vue';
import {
  permissionAuditService,
  type PermissionAuditEntry,
  type AuditTargetType,
} from '../services/permissionAudit.service';

const { t } = useI18n();
const route = useRoute();

type QueryMode = 'target' | 'actor';
const queryMode = ref<QueryMode>('target');
const targetType = ref<AuditTargetType>('user');
const targetIdUser = ref<number | null>(null);
const targetIdClient = ref<number | null>(null);
const targetIdRole = ref<number | null>(null);
const changedBy = ref<number | null>(null);
const limit = ref(50);

const entries = ref<PermissionAuditEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(entries, { loading });
const sortKeyMap: Record<string, string> = {
  action: 'action', target: 'target_type', changed_by: 'changed_by', occurred_at: 'occurred_at',
};

const queryModeItems = computed(() => [
  { title: t('permission_audit.mode_target'), value: 'target' },
  { title: t('permission_audit.mode_actor'), value: 'actor' },
]);

const targetTypeItems = computed(() => [
  { title: t('permission_audit.type_user'), value: 'user' as AuditTargetType },
  {
    title: t('permission_audit.type_oauth_client'),
    value: 'oauth_client' as AuditTargetType,
  },
  { title: t('permission_audit.type_role'), value: 'role' as AuditTargetType },
]);

const tableHeaders = computed<DataTableHeader[]>(() => [
  { title: t('permission_audit.col_action') as string, key: 'action', sortable: false },
  { title: t('permission_audit.col_target') as string, key: 'target', sortable: false },
  { title: t('permission_audit.col_actor') as string, key: 'changed_by', sortable: false },
  { title: t('permission_audit.col_diff') as string, key: 'change_diff', sortable: false },
  { title: t('permission_audit.col_ip') as string, key: 'ip', sortable: false },
  { title: t('permission_audit.col_when') as string, key: 'occurred_at', sortable: false },
]);

const currentTargetId = computed(() => {
  if (targetType.value === 'user') return targetIdUser.value;
  if (targetType.value === 'oauth_client') return targetIdClient.value;
  return targetIdRole.value;
});

const canFetch = computed(() => {
  if (queryMode.value === 'target') {
    return (currentTargetId.value ?? 0) > 0;
  }
  return (changedBy.value ?? 0) > 0;
});

async function fetchAudit(): Promise<void> {
  if (!canFetch.value) {
    entries.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    let r;
    if (queryMode.value === 'target' && currentTargetId.value !== null) {
      r = await permissionAuditService.byTarget({
        targetType: targetType.value,
        targetId: currentTargetId.value,
        limit: limit.value,
      });
    } else if (queryMode.value === 'actor' && changedBy.value !== null) {
      r = await permissionAuditService.byActor({
        changedBy: changedBy.value,
        limit: limit.value,
      });
    } else {
      r = { scope: {}, items: [] };
    }
    entries.value = r.items;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

let debounceHandle: number | null = null;
function onFilterChange(): void {
  if (debounceHandle !== null) {
    window.clearTimeout(debounceHandle);
  }
  debounceHandle = window.setTimeout(() => {
    debounceHandle = null;
    void fetchAudit();
  }, 300);
}

function onQueryModeChange(): void {
  entries.value = [];
  onFilterChange();
}

// Deep-link: ?target_type=user&target_id=17192
watch(
  () => route.query,
  (q) => {
    if (q.target_type && q.target_id) {
      queryMode.value = 'target';
      const tt = String(q.target_type) as AuditTargetType;
      if (['user', 'role', 'oauth_client'].includes(tt)) {
        targetType.value = tt;
        const tid = Number(q.target_id);
        if (tt === 'user') targetIdUser.value = tid;
        else if (tt === 'oauth_client') targetIdClient.value = tid;
        else targetIdRole.value = tid;
        onFilterChange();
      }
    }
  },
  { immediate: true },
);

// Diálogo de diff
const diffDialogOpen = ref(false);
const diffEntry = ref<PermissionAuditEntry | null>(null);
const formattedDiff = computed(() =>
  diffEntry.value?.change_diff
    ? JSON.stringify(diffEntry.value.change_diff, null, 2)
    : '',
);

function openDiff(entry: PermissionAuditEntry): void {
  diffEntry.value = entry;
  diffDialogOpen.value = true;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function colorForAction(action: string): string {
  if (action.includes('granted') || action.includes('created') || action.includes('added')) {
    return 'success';
  }
  if (action.includes('revoked') || action.includes('removed') || action.includes('deleted')) {
    return 'error';
  }
  if (action.includes('changed') || action.includes('updated') || action.includes('bulk')) {
    return 'warning';
  }
  return 'grey';
}
</script>

<style scoped>
.permission-audit-page {
  max-width: 1200px;
}

.pap-diff-header {
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pap-diff-header code {
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.pap-diff-json {
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.78rem;
  max-height: 50vh;
  overflow: auto;
  margin: 0;
}
</style>
