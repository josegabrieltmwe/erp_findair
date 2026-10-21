<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.memory.title')" :subtitle="t('ai_admin.memory.subtitle')" />
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">{{ t('ai_admin.memory.privacy_note') }}</v-alert>

    <v-text-field
      v-model="userFilter"
      type="number"
      min="1"
      :label="t('ai_admin.memory.filter_user')"
      density="comfortable"
      variant="outlined"
      clearable
      class="mb-4"
      style="max-width: 320px"
    />

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="filtered.length === 0"
      :data="filtered"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiBrain" :title="t('ai_admin.memory.empty')" />
      </template>
      <template #default>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('ai_admin.memory.user') }}</th>
              <th>{{ t('ai_admin.memory.entries') }}</th>
              <th>{{ t('ai_admin.memory.size') }}</th>
              <th>{{ t('ai_admin.memory.last') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in groups" :key="g.user_id">
              <td>{{ g.user_id }}</td>
              <td>{{ g.count }}</td>
              <td>{{ g.size }}</td>
              <td>{{ formatDateTime(g.last) }}</td>
              <td class="text-right">
                <v-btn
                  size="small"
                  color="error"
                  variant="tonal"
                  :prepend-icon="mdiDelete"
                  :loading="erasing === g.user_id"
                  @click="eraseUser(g.user_id)"
                >
                  {{ t('ai_admin.memory.erase_user') }}
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <div v-if="nextCursor !== null" class="mt-3">
          <v-btn variant="tonal" :loading="loadingMore" @click="loadMore">{{ t('ai_admin.load_more') }}</v-btn>
        </div>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiBrain, mdiDelete } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { aiAdminService, type VoiceMemoryItem } from '../services/aiAdmin.service';
import { errorMessage, formatDateTime, groupMemoryByUser } from '../format';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<VoiceMemoryItem[]>([]);
const nextCursor = ref<number | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const erasing = ref<number | null>(null);
const error = ref<string | null>(null);
const userFilter = ref<string | null>('');

const filtered = computed(() => {
  const u = Number(userFilter.value);
  return userFilter.value && u > 0 ? items.value.filter((i) => i.user_id === u) : items.value;
});
const groups = computed(() => groupMemoryByUser(filtered.value));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const page = await aiAdminService.listVoiceMemory();
    items.value = page.items;
    nextCursor.value = page.next_cursor;
  } catch (e) {
    items.value = [];
    nextCursor.value = null;
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  loadingMore.value = true;
  try {
    const page = await aiAdminService.listVoiceMemory(nextCursor.value);
    items.value = [...items.value, ...page.items];
    nextCursor.value = page.next_cursor;
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    loadingMore.value = false;
  }
}

async function eraseUser(userId: number) {
  const ok = await confirm.ask({
    title: t('ai_admin.memory.confirm_title'),
    message: t('ai_admin.memory.confirm_message', { user: userId }),
    confirmLabel: t('ai_admin.memory.erase_user'),
    variant: 'danger',
  });
  if (!ok) return;
  erasing.value = userId;
  try {
    const n = await aiAdminService.eraseVoiceMemoryOfUser(userId);
    toast.success(t('ai_admin.memory.erased', { n }));
    await load();
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    erasing.value = null;
  }
}

onMounted(load);
</script>
