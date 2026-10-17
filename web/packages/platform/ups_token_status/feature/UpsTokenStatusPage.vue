<template>
  <div>
    <CmSectionHeader :title="t('sections.ups_token_status')" :subtitle="t('ups_token_status.subtitle')" />

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('ups_token_status.scope_note') }}
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
        <v-card variant="outlined" class="pa-5" max-width="560">
          <div v-if="!status?.has_token" class="d-flex align-center">
            <v-icon :icon="mdiAlertCircleOutline" color="warning" class="mr-3" />
            <span>{{ t('ups_token_status.no_token') }}</span>
          </div>

          <template v-else>
            <div class="d-flex align-center mb-4">
              <v-icon
                :icon="status.is_expired ? mdiAlertCircleOutline : mdiCheckCircleOutline"
                :color="status.is_expired ? 'error' : 'success'"
                size="28"
                class="mr-3"
              />
              <span class="text-h6">
                {{ status.is_expired ? t('ups_token_status.expired') : t('ups_token_status.active') }}
              </span>
            </div>

            <v-table density="compact">
              <tbody>
                <tr>
                  <td class="ut-label">{{ t('ups_token_status.client_id') }}</td>
                  <td><code>{{ status.client_id }}</code></td>
                </tr>
                <tr>
                  <td class="ut-label">{{ t('ups_token_status.use_before') }}</td>
                  <td>{{ status.use_before }}</td>
                </tr>
                <tr>
                  <td class="ut-label">{{ t('ups_token_status.refresh_token_use_before') }}</td>
                  <td>{{ status.refresh_token_use_before ?? t('ups_token_status.none') }}</td>
                </tr>
                <tr>
                  <td class="ut-label">{{ t('ups_token_status.created_at') }}</td>
                  <td>{{ status.created_at }}</td>
                </tr>
                <tr>
                  <td class="ut-label">{{ t('ups_token_status.total_issued') }}</td>
                  <td>{{ status.total_issued }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <v-divider class="my-4" />
          <v-btn variant="tonal" :prepend-icon="mdiRefresh" :loading="loading" @click="load">
            {{ t('common.retry') }}
          </v-btn>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiRefresh } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import { upsTokenStatusService, type UpsTokenStatus } from '../services/upsTokenStatus.service';

const { t } = useI18n();

const status = ref<UpsTokenStatus | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    status.value = await upsTokenStatusService.get();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ut-label {
  font-weight: 600;
  width: 220px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
