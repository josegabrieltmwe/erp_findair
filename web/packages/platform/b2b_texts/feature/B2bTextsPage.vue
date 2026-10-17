<template>
  <div>
    <CmSectionHeader :title="t('sections.b2b_texts')" :subtitle="t('b2b_texts.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-2">
      {{ t('b2b_texts.live_warning') }}
    </v-alert>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('b2b_texts.supplements_hint') }}
    </v-alert>
    <v-alert v-if="!canWrite" type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('b2b_texts.read_only') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="d-flex flex-wrap align-center" style="gap:12px">
        <v-select
          v-model="baseLang" :items="langItems" item-title="label" item-value="code"
          :label="t('b2b_texts.base_language')" density="compact" hide-details style="min-width:190px"
        />
        <v-select
          v-model="targetLang" :items="targetItems" item-title="label" item-value="code"
          :label="t('b2b_texts.target_language')" density="compact" hide-details style="min-width:190px"
        />
        <v-select
          v-model="gruppo" :items="gruppoItems" :label="t('b2b_texts.gruppo')"
          density="compact" hide-details clearable style="min-width:240px"
        />
        <v-text-field
          v-model="search" :prepend-inner-icon="mdiMagnify" :label="t('b2b_texts.search')"
          density="compact" hide-details clearable style="max-width:260px"
        />
        <v-switch v-model="onlyUntranslated" :label="t('b2b_texts.only_untranslated')" density="compact" hide-details color="primary" />
      </div>
    </v-card>

    <v-alert v-if="!gruppo" type="info" variant="tonal" density="comfortable" class="mb-4">
      {{ t('b2b_texts.pick_group_hint') }}
    </v-alert>

    <CmAsyncSection
      v-else
      :loading="loading" :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered" loading-type="skeleton" :skeleton-rows="8" :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiTranslate" :title="t('b2b_texts.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="bt-table">
            <thead>
              <tr>
                <th style="width:170px">{{ t('b2b_texts.chiave') }}</th>
                <th>{{ t('b2b_texts.base_text') }} ({{ baseLang }})</th>
                <th>{{ t('b2b_texts.target_text') }} ({{ targetLang }})</th>
                <th style="width:200px">{{ t('b2b_texts.help_comment') }}</th>
                <th class="text-center" style="width:90px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pageRows" :key="p.chiave">
                <td><code>{{ p.chiave }}</code></td>
                <td class="bt-base">{{ p.base?.label }}</td>
                <td>
                  <v-textarea
                    :model-value="draftFor(p)" :readonly="!canWrite || !p.base"
                    variant="outlined" density="compact" rows="1" auto-grow hide-details
                    :error="isUntranslated(p) && !drafts[p.chiave]"
                    @update:model-value="(v: string) => (drafts[p.chiave] = v)"
                  />
                </td>
                <td class="text-caption">
                  <div v-if="p.base?.helpc">{{ p.base.helpc }}</div>
                  <div v-if="p.base?.commento" class="text-medium-emphasis">{{ p.base.commento }}</div>
                </td>
                <td class="text-center">
                  <v-btn
                    v-if="canWrite && p.base" :icon="mdiContentSave" size="small" variant="text" color="primary"
                    :disabled="!isDirty(p)" :loading="savingKey === p.chiave" :title="t('common.save')"
                    @click="saveRow(p)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-space-between pa-2">
            <span class="text-caption">{{ t('b2b_texts.total', { n: filtered.length }) }}</span>
            <v-pagination v-if="pageCount > 1" v-model="page" :length="pageCount" density="compact" size="small" />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiMagnify, mdiTranslate, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useProfile } from '../../composables/useProfile';
import {
  b2bTextsService, B2B_LANGUAGES, DEFAULT_BASE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, PAGE_SIZE,
  targetLanguages, ensureDistinctTarget, pairTexts, filterPairs, searchPairs, pageSlice,
  isUntranslated, buildPayload, type TextPair,
} from '../services/b2bTexts.service';

const { t } = useI18n();
const toast = useToastStore();
const { isAdmin, ensureProfile } = useProfile();
const canWrite = computed(() => isAdmin.value !== false);

const GRUPPO_ITEMS = [
  'Avvisi JavaScript', 'Contattaci', 'Dettaglio spedizione', 'Fatt proforma',
  'Fattura testi', 'Form presa, rubrica e giacenza', 'Funzione calcolo prezzi',
  'Generali', 'Gestione rubrica', 'Giacenze', 'Home', 'index e menù principali',
  'Lingue', 'Mesi', 'Mostra listino', 'Mostra listino Supplementi',
  'Opzioni avanzate', 'Profilo', 'Proforma motivi esportazione',
  'Proforma unità di misura', 'Ricerca fatture', 'Ricerca spedizioni',
  'Spediz. Multiple', 'Supplementi', 'Tipo merce cargo Air',
];
const gruppoItems = GRUPPO_ITEMS;
const langItems = B2B_LANGUAGES.map((l) => ({ code: l.code, label: `${l.code} - ${l.name}` }));

const baseLang = ref(DEFAULT_BASE_LANGUAGE);
const targetLang = ref(DEFAULT_TARGET_LANGUAGE);
const targetItems = computed(() => targetLanguages(baseLang.value).map((l) => ({ code: l.code, label: `${l.code} - ${l.name}` })));
const gruppo = ref<string | null>(null);
const search = ref('');
const onlyUntranslated = ref(false);
const page = ref(1);

const pairs = ref<TextPair[]>([]);
const drafts = reactive<Record<string, string>>({});
const loading = ref(false);
const error = ref<string | null>(null);
const savingKey = ref<string | null>(null);

const filtered = computed(() => searchPairs(filterPairs(pairs.value, onlyUntranslated.value), search.value));
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const pageRows = computed(() => pageSlice(filtered.value, page.value));

function draftFor(p: TextPair): string {
  return p.chiave in drafts ? drafts[p.chiave] : (p.target?.label ?? '');
}
function isDirty(p: TextPair): boolean {
  return p.chiave in drafts && drafts[p.chiave] !== (p.target?.label ?? '');
}

async function load() {
  for (const k of Object.keys(drafts)) delete drafts[k];
  if (!gruppo.value) {
    pairs.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const [b, tg] = await Promise.all([
      b2bTextsService.listGroup(gruppo.value, baseLang.value),
      b2bTextsService.listGroup(gruppo.value, targetLang.value),
    ]);
    pairs.value = pairTexts(b, tg);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveRow(p: TextPair) {
  if (!p.base) return;
  savingKey.value = p.chiave;
  try {
    const payload = buildPayload(p.base, drafts[p.chiave] ?? '', p.target, targetLang.value);
    if (p.target) await b2bTextsService.update(p.target.id, payload);
    else await b2bTextsService.create(payload);
    toast.success(t('common.saved'));
    delete drafts[p.chiave];
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingKey.value = null;
  }
}

watch(baseLang, (b) => {
  targetLang.value = ensureDistinctTarget(b, targetLang.value);
});
watch([baseLang, targetLang, gruppo], () => {
  page.value = 1;
  load();
});
watch([search, onlyUntranslated], () => {
  page.value = 1;
});

onMounted(ensureProfile);
</script>

<style scoped>
.bt-table :deep(th) { font-weight: 600; white-space: nowrap; }
.bt-table :deep(td) { vertical-align: top; padding-top: 6px; padding-bottom: 6px; }
.bt-base { white-space: pre-wrap; }
</style>
