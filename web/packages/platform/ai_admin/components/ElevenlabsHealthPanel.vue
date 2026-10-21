<template>
  <div>
    <div class="d-flex align-center ga-2 mb-3">
      <v-btn variant="tonal" size="small" :prepend-icon="mdiRefresh" :loading="loading && !live" @click="load(false)">
        {{ t('ai_admin.health.refresh') }}
      </v-btn>
      <v-btn variant="tonal" size="small" :prepend-icon="mdiCloudSearchOutline" :loading="loading && live" @click="load(true)">
        {{ t('ai_admin.health.check_live') }}
      </v-btn>
    </div>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="visible.length === 0"
      :data="visible"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiHeartPulse" :title="t('ai_admin.health.empty')" />
      </template>
      <template #default>
        <v-row dense>
          <v-col v-for="h in visible" :key="h.profile" cols="12" md="6">
            <v-card variant="outlined" class="pa-4">
              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-1 flex-grow-1">{{ h.profile }}</div>
                <v-chip :color="h.drift ? 'warning' : 'success'" size="small" variant="tonal">
                  {{ h.drift ? t('ai_admin.health.drift_yes') : t('ai_admin.health.drift_no') }}
                </v-chip>
              </div>
              <div class="mb-2">
                <v-chip :color="h.agent_id_set ? 'success' : 'error'" size="x-small" variant="tonal" class="mr-2">
                  {{ t('ai_admin.health.agent_id') }}: {{ h.agent_id_set ? t('common.yes') : t('common.no') }}
                </v-chip>
                <v-chip :color="h.key_set ? 'success' : 'error'" size="x-small" variant="tonal">
                  {{ t('ai_admin.health.api_key') }}: {{ h.key_set ? t('common.yes') : t('common.no') }}
                </v-chip>
              </div>
              <v-table density="compact">
                <tbody>
                  <tr>
                    <td>{{ t('ai_admin.health.last_sync') }}</td>
                    <td>{{ h.last_sync_at ? formatDateTime(h.last_sync_at) : t('ai_admin.health.never') }}</td>
                  </tr>
                  <tr>
                    <td>{{ t('ai_admin.health.tools_expected') }}</td>
                    <td>{{ h.tools_expected }}</td>
                  </tr>
                  <tr>
                    <td>{{ t('ai_admin.health.tools_remote') }}</td>
                    <td>{{ h.tools_remote === null ? t('ai_admin.health.not_checked') : h.tools_remote }}</td>
                  </tr>
                  <tr>
                    <td>{{ t('ai_admin.health.last_token') }}</td>
                    <td>{{ h.last_agent_token_at ? formatDateTime(h.last_agent_token_at) : '—' }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCloudSearchOutline, mdiHeartPulse, mdiRefresh } from '@mdi/js';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { aiAdminService, type ElevenlabsHealth } from '../services/aiAdmin.service';
import { errorMessage, formatDateTime } from '../format';

/** `profile`: si se indica, solo se muestra ese perfil (copilot_operator | public_form). */
const props = defineProps<{ profile?: string }>();

const { t } = useI18n();
const items = ref<ElevenlabsHealth[]>([]);
const loading = ref(false);
const live = ref(false);
const error = ref<string | null>(null);

const visible = computed(() => (props.profile ? items.value.filter((h) => h.profile === props.profile) : items.value));

async function load(withLive = false) {
  loading.value = true;
  live.value = withLive;
  error.value = null;
  try {
    items.value = await aiAdminService.getElevenlabsHealth(withLive);
  } catch (e) {
    items.value = [];
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(false));
defineExpose({ reload: load });
</script>
