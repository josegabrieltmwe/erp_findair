<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.audit.title')" :subtitle="t('ai_admin.audit.subtitle')" />

    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6" md="2"><v-text-field v-model="filters.from" type="date" :label="t('ai_admin.usage.from')" density="comfortable" variant="outlined" hide-details /></v-col>
          <v-col cols="12" sm="6" md="2"><v-text-field v-model="filters.to" type="date" :label="t('ai_admin.usage.to')" density="comfortable" variant="outlined" hide-details /></v-col>
          <v-col cols="12" sm="6" md="2"><v-select v-model="filters.feature" :items="featureItems" clearable :label="t('ai_admin.usage.feature')" density="comfortable" variant="outlined" hide-details /></v-col>
          <v-col cols="12" sm="6" md="2"><v-text-field v-model="filters.event" :label="t('ai_admin.audit.event')" density="comfortable" variant="outlined" hide-details /></v-col>
          <v-col cols="12" sm="6" md="2"><v-text-field v-model="filters.status" :label="t('ai_admin.audit.status')" density="comfortable" variant="outlined" hide-details /></v-col>
          <v-col cols="12" sm="6" md="2"><v-text-field v-model="filters.partner_id" type="number" min="1" :label="t('ai_admin.usage.partner_id')" density="comfortable" variant="outlined" hide-details /></v-col>
        </v-row>
        <v-btn color="primary" variant="flat" class="mt-3" :loading="loading" @click="load">{{ t('ai_admin.usage.apply') }}</v-btn>
      </v-card-text>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      :data="items"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiClipboardTextClockOutline" :title="t('ai_admin.audit.empty')" />
      </template>
      <template #default>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('ai_admin.audit.ts') }}</th>
              <th>{{ t('ai_admin.usage.partner_id') }}</th>
              <th>{{ t('ai_admin.audit.user') }}</th>
              <th>{{ t('ai_admin.usage.feature') }}</th>
              <th>{{ t('ai_admin.audit.event') }}</th>
              <th>{{ t('ai_admin.audit.tools') }}</th>
              <th>{{ t('ai_admin.audit.status') }}</th>
              <th>{{ t('ai_admin.audit.request_id') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in items" :key="e.id">
              <td class="text-no-wrap">{{ formatDateTime(e.ts) }}</td>
              <td>{{ e.partner_id ?? '—' }}</td>
              <td>{{ e.user_id ?? '—' }}</td>
              <td>{{ e.feature }}</td>
              <td>{{ e.event }}</td>
              <td>{{ e.tool_names || '—' }}</td>
              <td>
                <v-chip size="x-small" variant="tonal" :color="e.error_code ? 'error' : 'success'">
                  {{ e.error_code || e.status }}
                </v-chip>
              </td>
              <td><code class="text-caption">{{ e.request_id || '—' }}</code></td>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiClipboardTextClockOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { AI_FEATURES, aiAdminService, type AiAuditEntry } from '../services/aiAdmin.service';
import { errorMessage, formatDateTime } from '../format';

const { t } = useI18n();
const toast = useToastStore();

const items = ref<AiAuditEntry[]>([]);
const nextCursor = ref<number | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const filters = reactive({
  from: '',
  to: '',
  feature: null as string | null,
  event: '',
  status: '',
  partner_id: '',
});

const featureItems = computed(() => AI_FEATURES.map((f) => ({ title: t('ai_admin.feature.' + f), value: f })));

function query(cursor?: number | null) {
  return {
    from: filters.from,
    to: filters.to,
    feature: filters.feature ?? '',
    event: filters.event,
    status: filters.status,
    partner_id: filters.partner_id ? Number(filters.partner_id) : undefined,
    limit: 50,
    cursor,
  };
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const page = await aiAdminService.listAudit(query());
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
    const page = await aiAdminService.listAudit(query(nextCursor.value));
    items.value = [...items.value, ...page.items];
    nextCursor.value = page.next_cursor;
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    loadingMore.value = false;
  }
}

onMounted(load);
</script>
