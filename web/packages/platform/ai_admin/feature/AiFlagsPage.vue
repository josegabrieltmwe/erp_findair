<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.flags.title')" :subtitle="t('ai_admin.flags.subtitle')" />

    <v-text-field
      v-model="partnerId"
      type="number"
      min="1"
      :label="t('ai_admin.flags.partner_id')"
      :hint="t('ai_admin.flags.partner_hint')"
      persistent-hint
      density="comfortable"
      variant="outlined"
      class="mb-4"
      style="max-width: 320px"
      @keyup.enter="load"
      @blur="load"
    />

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="settings.length === 0"
      :data="settings"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiToggleSwitchOffOutline" :title="t('ai_admin.flags.empty')" />
      </template>
      <template #default>
        <v-table>
          <tbody>
            <tr v-for="s in settings" :key="s.key">
              <td>
                <div>{{ t('ai_admin.flags.key_' + s.key) }}</div>
                <div class="text-caption text-medium-emphasis">{{ s.key }}</div>
              </td>
              <td>
                <v-chip size="x-small" variant="tonal">{{ t('ai_admin.flags.scope_' + s.scope) }}</v-chip>
              </td>
              <td style="width: 220px">
                <v-select
                  v-if="s.key === 'provider_preference'"
                  :model-value="s.value"
                  :items="providerItems"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :disabled="saving === s.key"
                  @update:model-value="(v: string) => save(s.key, v)"
                />
                <v-switch
                  v-else
                  :model-value="flagIsOn(s.value)"
                  color="primary"
                  hide-details
                  density="compact"
                  :loading="saving === s.key"
                  :disabled="saving === s.key"
                  @update:model-value="(v: boolean | null) => save(s.key, flagToValue(!!v))"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiToggleSwitchOffOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { AI_PROVIDERS, aiAdminService, type AiSetting } from '../services/aiAdmin.service';
import { errorMessage, flagIsOn, flagToValue } from '../format';

const { t } = useI18n();
const toast = useToastStore();

const settings = ref<AiSetting[]>([]);
const loading = ref(false);
const saving = ref<string | null>(null);
const error = ref<string | null>(null);
const partnerId = ref('');

const providerItems = computed(() => AI_PROVIDERS.map((p) => ({ title: p, value: p })));

function currentPartner(): number | null {
  const n = Number(partnerId.value);
  return partnerId.value && Number.isFinite(n) && n > 0 ? n : null;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    settings.value = await aiAdminService.listSettings(currentPartner());
  } catch (e) {
    settings.value = [];
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function save(key: string, value: string) {
  saving.value = key;
  try {
    await aiAdminService.saveSetting(key, value, currentPartner());
    toast.success(t('ai_admin.flags.saved'));
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    saving.value = null;
    // Recarga siempre: deja la UI igual que el servidor, también tras un error.
    await load();
  }
}

onMounted(load);
</script>
