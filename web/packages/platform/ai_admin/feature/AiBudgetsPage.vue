<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.budgets.title')" :subtitle="t('ai_admin.budgets.subtitle')">
      <template #actions>
        <v-btn color="primary" variant="flat" :prepend-icon="mdiPlus" @click="openNew">{{ t('ai_admin.budgets.new') }}</v-btn>
      </template>
    </CmSectionHeader>

    <v-text-field
      v-model="partnerId"
      type="number"
      min="1"
      :label="t('ai_admin.budgets.partner_id')"
      :hint="t('ai_admin.budgets.partner_hint')"
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
      :empty="budgets.length === 0"
      :data="budgets"
      loading-type="spinner"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiCashClock" :title="t('ai_admin.budgets.empty')">{{ t('ai_admin.budgets.empty_hint') }}</CmEmptyState>
      </template>
      <template #default>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('ai_admin.budgets.partner') }}</th>
              <th>{{ t('ai_admin.budgets.feature') }}</th>
              <th>{{ t('ai_admin.budgets.period') }}</th>
              <th class="text-right">{{ t('ai_admin.budgets.max_tokens') }}</th>
              <th class="text-right">{{ t('ai_admin.budgets.max_voice_minutes') }}</th>
              <th class="text-right">{{ t('ai_admin.budgets.max_cost') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in budgets" :key="b.id">
              <td>{{ b.partner_id ?? t('ai_admin.budgets.global') }}</td>
              <td>{{ b.feature }}</td>
              <td>{{ t('ai_admin.budgets.period_' + b.period) }}</td>
              <td class="text-right">{{ limitText(b.max_tokens) }}</td>
              <td class="text-right">{{ limitText(b.max_voice_minutes) }}</td>
              <td class="text-right">{{ b.max_cost_cents === null ? t('ai_admin.budgets.unlimited') : formatCost(b.max_cost_cents) }}</td>
              <td class="text-right">
                <v-btn icon size="x-small" variant="text" :aria-label="t('common.edit')" @click="openEdit(b)"><v-icon :icon="mdiPencil" /></v-btn>
                <v-btn icon size="x-small" variant="text" color="error" :aria-label="t('common.delete')" @click="remove(b)"><v-icon :icon="mdiDelete" /></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ t('ai_admin.budgets.dialog_title') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-3">{{ formError }}</v-alert>
          <v-text-field v-model="form.partner_id" type="number" min="1" :label="t('ai_admin.budgets.partner_id')" :hint="t('ai_admin.budgets.partner_hint')" persistent-hint density="comfortable" variant="outlined" class="mb-2" />
          <v-select v-model="form.feature" :items="featureItems" :label="t('ai_admin.budgets.feature')" density="comfortable" variant="outlined" class="mb-2" />
          <v-select v-model="form.period" :items="periodItems" :label="t('ai_admin.budgets.period')" density="comfortable" variant="outlined" class="mb-2" />
          <v-text-field v-model="form.max_tokens" type="number" min="0" :label="t('ai_admin.budgets.max_tokens')" :hint="t('ai_admin.budgets.blank_unlimited')" persistent-hint density="comfortable" variant="outlined" class="mb-2" />
          <v-text-field v-model="form.max_voice_minutes" type="number" min="0" :label="t('ai_admin.budgets.max_voice_minutes')" :hint="t('ai_admin.budgets.blank_unlimited')" persistent-hint density="comfortable" variant="outlined" class="mb-2" />
          <v-text-field v-model="form.max_cost_cents" type="number" min="0" :label="t('ai_admin.budgets.max_cost_cents')" :hint="t('ai_admin.budgets.blank_unlimited')" persistent-hint density="comfortable" variant="outlined" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="save">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCashClock, mdiDelete, mdiPencil, mdiPlus } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { AI_FEATURES, AI_PERIODS, aiAdminService, type AiBudget, type AiPeriod } from '../services/aiAdmin.service';
import { errorMessage, formatCost, parseLimit } from '../format';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const budgets = ref<AiBudget[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const partnerId = ref('');
const dialog = ref(false);
const formError = ref<string | null>(null);
const form = reactive({
  partner_id: '' as string | number,
  feature: 'copilot' as string,
  period: 'month' as AiPeriod,
  max_tokens: '' as string | number | null,
  max_voice_minutes: '' as string | number | null,
  max_cost_cents: '' as string | number | null,
});

const featureItems = computed(() => AI_FEATURES.map((f) => ({ title: t('ai_admin.feature.' + f), value: f })));
const periodItems = computed(() => AI_PERIODS.map((p) => ({ title: t('ai_admin.budgets.period_' + p), value: p })));

function limitText(v: number | null): string {
  return v === null ? t('ai_admin.budgets.unlimited') : String(v);
}

function currentPartner(): number | null {
  const n = Number(partnerId.value);
  return partnerId.value && Number.isFinite(n) && n > 0 ? n : null;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    budgets.value = await aiAdminService.listBudgets(currentPartner());
  } catch (e) {
    budgets.value = [];
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function fill(b: AiBudget | null) {
  formError.value = null;
  form.partner_id = b?.partner_id ?? currentPartner() ?? '';
  form.feature = b?.feature ?? 'copilot';
  form.period = b?.period ?? 'month';
  form.max_tokens = b?.max_tokens ?? '';
  form.max_voice_minutes = b?.max_voice_minutes ?? '';
  form.max_cost_cents = b?.max_cost_cents ?? '';
  dialog.value = true;
}
const openNew = () => fill(null);
const openEdit = (b: AiBudget) => fill(b);

async function save() {
  const tokens = parseLimit(form.max_tokens);
  const minutes = parseLimit(form.max_voice_minutes);
  const cost = parseLimit(form.max_cost_cents);
  if (tokens === undefined || minutes === undefined || cost === undefined) {
    formError.value = t('ai_admin.budgets.invalid_limit');
    return;
  }
  const partner = parseLimit(form.partner_id);
  saving.value = true;
  formError.value = null;
  try {
    await aiAdminService.saveBudget({
      partner_id: partner === undefined ? null : partner,
      feature: form.feature,
      period: form.period,
      max_tokens: tokens,
      max_voice_minutes: minutes,
      max_cost_cents: cost,
    });
    dialog.value = false;
    toast.success(t('ai_admin.budgets.saved'));
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function remove(b: AiBudget) {
  const ok = await confirm.ask({
    title: t('ai_admin.budgets.confirm_delete_title'),
    message: t('ai_admin.budgets.confirm_delete_message', { feature: b.feature, period: t('ai_admin.budgets.period_' + b.period) }),
    confirmLabel: t('common.delete'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await aiAdminService.removeBudget(b.id);
    toast.success(t('ai_admin.budgets.deleted'));
    await load();
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

onMounted(load);
</script>
