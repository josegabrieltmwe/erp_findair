<template>
  <div>
    <CmSectionHeader :title="t('elevenlabs_agent_sync.title')" :subtitle="t('elevenlabs_agent_sync.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('elevenlabs_agent_sync.overwrite_note') }}
    </v-alert>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="false"
      :data="status ? [status] : []"
      loading-type="spinner"
      @clear-error="error = null; load()"
    >
      <template #default>
        <v-card variant="outlined" class="pa-5" max-width="640">
          <div v-if="!status?.agent_id" class="d-flex align-center">
            <v-icon :icon="mdiAlertCircleOutline" color="warning" class="mr-3" />
            <span>{{ t('elevenlabs_agent_sync.no_agent') }}</span>
          </div>

          <template v-else>
            <div class="d-flex align-center mb-4">
              <v-icon :icon="mdiRobotOutline" color="success" size="28" class="mr-3" />
              <div>
                <div class="text-h6">{{ status.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ status.agent_id }}</div>
              </div>
            </div>

            <v-table density="compact" class="mb-2">
              <tbody>
                <tr>
                  <td class="eas-label">{{ t('elevenlabs_agent_sync.tools_count') }}</td>
                  <td>{{ status.tools_count }}</td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="status.tools.length" class="mb-2">
              <v-chip
                v-for="tool in status.tools"
                :key="tool.name"
                size="small"
                variant="tonal"
                class="mr-2 mb-2"
              >
                {{ tool.name }}
              </v-chip>
            </div>
          </template>

          <v-divider class="my-4" />

          <div class="d-flex ga-2">
            <v-btn variant="tonal" :prepend-icon="mdiRefresh" :loading="loading" @click="load">
              {{ t('common.retry') }}
            </v-btn>
            <v-btn
              color="warning"
              variant="flat"
              :prepend-icon="mdiSync"
              :loading="syncing"
              @click="onSyncClick"
            >
              {{ t('elevenlabs_agent_sync.sync_button') }}
            </v-btn>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-card v-if="canSeeHealth" variant="outlined" class="pa-5 mt-4" data-testid="ai-health">
      <div class="text-subtitle-2 mb-2">{{ t('ai_admin.health.title') }}</div>
      <ElevenlabsHealthPanel ref="healthPanel" profile="public_form" />
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlertCircleOutline, mdiRefresh, mdiRobotOutline, mdiSync } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import ElevenlabsHealthPanel from '../../ai_admin/components/ElevenlabsHealthPanel.vue';
import { useAiScopes } from '../../ai_admin/composables/useAiScopes';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { elevenlabsAgentSyncService, type ElevenlabsAgentStatus } from '../services/elevenlabsAgentSync.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();
const aiScopes = useAiScopes();
const canSeeHealth = aiScopes.can('ai:admin');
void aiScopes.ensureProfile();
const healthPanel = ref<InstanceType<typeof ElevenlabsHealthPanel> | null>(null);

const status = ref<ElevenlabsAgentStatus | null>(null);
const loading = ref(false);
const syncing = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    status.value = await elevenlabsAgentSyncService.getStatus();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function onSyncClick() {
  const confirmed = await confirm.ask({
    title: t('elevenlabs_agent_sync.confirm_title'),
    message: t('elevenlabs_agent_sync.confirm_message'),
    confirmLabel: t('elevenlabs_agent_sync.confirm_button'),
  });
  if (!confirmed) return;

  syncing.value = true;
  try {
    const result = await elevenlabsAgentSyncService.sync();
    toast.success(t('elevenlabs_agent_sync.sync_success', { n: result.tools_synced }));
    await load();
    await healthPanel.value?.reload(false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.eas-label {
  font-weight: 600;
  width: 220px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
