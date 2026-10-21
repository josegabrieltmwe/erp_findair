<template>
  <div>
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6" md="2">
            <v-text-field v-model="from" type="date" :label="t('ai_admin.usage.from')" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-text-field v-model="to" type="date" :label="t('ai_admin.usage.to')" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-select v-model="feature" :items="featureItems" :label="t('ai_admin.usage.feature')" clearable density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-select v-model="groupBy" :items="groupItems" :label="t('ai_admin.usage.group_by')" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col v-if="!own" cols="12" sm="6" md="2">
            <v-text-field v-model="partnerId" type="number" min="1" :label="t('ai_admin.usage.partner_id')" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" sm="6" md="2" class="d-flex align-center">
            <v-btn color="primary" variant="flat" :loading="loading" @click="load">{{ t('ai_admin.usage.apply') }}</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="isEmpty"
      :data="usage"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiChartBoxOutline" :title="t('ai_admin.usage.empty')" />
      </template>
      <template v-if="usage" #default>
        <v-row dense class="mb-2">
          <v-col v-for="card in totalCards" :key="card.key" cols="6" md="2">
            <v-card variant="tonal" class="pa-3">
              <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
              <div class="text-h6">{{ card.value }}</div>
            </v-card>
          </v-col>
        </v-row>

        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('ai_admin.usage.group_' + groupBy) }}</th>
              <th class="text-right">{{ t('ai_admin.usage.requests') }}</th>
              <th class="text-right">{{ t('ai_admin.usage.tokens_in') }}</th>
              <th class="text-right">{{ t('ai_admin.usage.tokens_out') }}</th>
              <th class="text-right">{{ t('ai_admin.usage.voice_minutes') }}</th>
              <th class="text-right">{{ t('ai_admin.usage.cost') }}</th>
              <th class="text-right">{{ t('ai_admin.usage.errors') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usage.series" :key="row.key">
              <td>{{ row.key }}</td>
              <td class="text-right">{{ row.requests }}</td>
              <td class="text-right">{{ row.tokens_in }}</td>
              <td class="text-right">{{ row.tokens_out }}</td>
              <td class="text-right">{{ formatMinutes(row.voice_seconds) }}</td>
              <td class="text-right">{{ formatCost(row.cost_cents) }}</td>
              <td class="text-right">{{ row.errors }}</td>
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
import { mdiChartBoxOutline } from '@mdi/js';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import {
  AI_FEATURES,
  AI_USAGE_GROUPS,
  aiAdminService,
  type AiUsage,
  type AiUsageGroup,
} from '../services/aiAdmin.service';
import { errorMessage, formatCost, formatMinutes } from '../format';

/** `own`: vista "mi uso" (sin filtro de partner; la API limita a lo propio). */
const props = defineProps<{ own?: boolean }>();

const { t } = useI18n();
const usage = ref<AiUsage | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const from = ref('');
const to = ref('');
const feature = ref<string | null>(null);
const groupBy = ref<AiUsageGroup>('feature');
const partnerId = ref('');

const featureItems = computed(() => AI_FEATURES.map((f) => ({ title: t('ai_admin.feature.' + f), value: f })));
const groupItems = computed(() =>
  AI_USAGE_GROUPS.filter((g) => !(props.own && g === 'partner')).map((g) => ({
    title: t('ai_admin.usage.group_' + g),
    value: g,
  })),
);

const isEmpty = computed(() => !!usage.value && usage.value.totals.requests === 0 && usage.value.series.length === 0);

const totalCards = computed(() => {
  const tot = usage.value?.totals;
  if (!tot) return [];
  return [
    { key: 'requests', label: t('ai_admin.usage.requests'), value: String(tot.requests) },
    { key: 'tokens_in', label: t('ai_admin.usage.tokens_in'), value: String(tot.tokens_in) },
    { key: 'tokens_out', label: t('ai_admin.usage.tokens_out'), value: String(tot.tokens_out) },
    { key: 'voice', label: t('ai_admin.usage.voice_minutes'), value: formatMinutes(tot.voice_seconds) },
    { key: 'cost', label: t('ai_admin.usage.cost'), value: formatCost(tot.cost_cents) },
    { key: 'errors', label: t('ai_admin.usage.errors'), value: String(tot.errors) },
  ];
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    usage.value = await aiAdminService.getUsage({
      from: from.value || undefined,
      to: to.value || undefined,
      feature: feature.value || undefined,
      group_by: groupBy.value,
      partner_id: props.own || !partnerId.value ? undefined : Number(partnerId.value),
    });
  } catch (e) {
    usage.value = null;
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
