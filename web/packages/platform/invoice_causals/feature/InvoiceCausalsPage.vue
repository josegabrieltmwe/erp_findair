<template>
  <div>
    <CmSectionHeader :title="t('sections.invoice_causals')" :subtitle="t('invoice_causals.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('invoice_causals.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('invoice_causals.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('invoice_causals.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="10"
      :skeleton-cols="6"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiGavel" :title="t('invoice_causals.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ic-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:70px">{{ t('invoice_causals.ordine') }}</th>
                <th style="width:80px">{{ t('invoice_causals.tipo') }}</th>
                <th style="width:80px">{{ t('invoice_causals.art') }}</th>
                <th>{{ t('invoice_causals.descr') }}</th>
                <th style="width:90px">{{ t('invoice_causals.aliquota') }}</th>
                <th style="width:110px">{{ t('invoice_causals.xml_natura') }}</th>
                <th style="width:120px">{{ t('invoice_causals.route') }}</th>
                <th class="text-center" style="width:100px">{{ t('invoice_causals.stato') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td class="text-center">
                  {{ row.ordine }}
                  <v-icon v-if="isSystemFixedRow(row)" :icon="mdiLock" size="14" class="ml-1 text-medium-emphasis" />
                </td>
                <td><b>{{ row.tipo }}</b></td>
                <td>{{ row.art || '—' }}</td>
                <td>{{ row.descr }}</td>
                <td>{{ row.aliquota ?? '—' }}</td>
                <td>{{ row.xml_natura || '—' }}</td>
                <td class="text-caption">
                  <span v-if="isRouteRuleEditable(row) && (row.iso_from || row.iso_to)">
                    {{ row.iso_from || '' }} <span v-if="row.iso_from && row.iso_to">/</span> {{ row.iso_to || '' }}
                  </span>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.stato === 'A' ? 'success' : 'default'" variant="tonal">
                    {{ row.stato === 'A' ? t('invoice_causals.stato_a') : t('invoice_causals.stato_o') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('invoice_causals.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="680" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiGavel" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('invoice_causals.new') : t('invoice_causals.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-alert v-if="editId !== null && systemFixed" type="info" variant="tonal" density="compact" tile>
          {{ t('invoice_causals.system_fixed_hint') }}
        </v-alert>
        <v-alert v-if="editId !== null && articleLocked" type="info" variant="tonal" density="compact" tile>
          {{ t('invoice_causals.article_locked_hint') }}
        </v-alert>

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="6" sm="3">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  item-title="label" item-value="value"
                  :label="t('invoice_causals.tipo')"
                  :rules="[requiredRule]"
                  :disabled="systemFixed"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model.number="form.ordine"
                  :label="t('invoice_causals.ordine')"
                  type="number"
                  :disabled="systemFixed"
                  :hint="systemFixed ? t('invoice_causals.ordine_hint') : ''"
                  persistent-hint
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model="form.tipo_cli_base"
                  :label="t('invoice_causals.tipo_cli_base')"
                  :disabled="systemFixed"
                  maxlength="10"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model="form.art"
                  :label="t('invoice_causals.art')"
                  :disabled="articleLocked"
                  :hint="articleLocked ? t('invoice_causals.article_locked_hint') : ''"
                  persistent-hint
                  maxlength="10"
                  variant="outlined" density="comfortable"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="form.descr"
                  :label="t('invoice_causals.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="form.descrEN"
                  :label="t('invoice_causals.descr_en')"
                  variant="outlined" density="comfortable"
                />
              </v-col>

              <v-col cols="6" sm="3">
                <v-text-field
                  v-model.number="form.aliquota"
                  :label="t('invoice_causals.aliquota')"
                  type="number" step="0.01"
                  :disabled="articleLocked"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="6" sm="4">
                <v-select
                  v-model="form.xml_natura"
                  :items="natureItems"
                  item-title="label" item-value="value"
                  :label="t('invoice_causals.xml_natura')"
                  :disabled="articleLocked"
                  clearable
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="form.xml_rif_norm"
                  :label="t('invoice_causals.xml_rif_norm')"
                  :disabled="articleLocked"
                  variant="outlined" density="comfortable"
                />
              </v-col>

              <v-col cols="12">
                <v-divider class="mb-2" />
                <div class="text-caption text-medium-emphasis mb-2">
                  {{ t('invoice_causals.route_section_title') }}
                  <span v-if="!routeEditable">— {{ t('invoice_causals.route_disabled_hint') }}</span>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <CountryTogglePicker
                  v-model="isoFromTokens"
                  :countries="ceeCountries"
                  :disabled="!routeEditable"
                  :label="t('invoice_causals.iso_from')"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <CountryTogglePicker
                  v-model="isoToTokens"
                  :countries="ceeCountries"
                  :disabled="!routeEditable"
                  :label="t('invoice_causals.iso_to')"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.nota_uso"
                  :label="t('invoice_causals.nota_uso')"
                  variant="outlined" density="comfortable" maxlength="250"
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-switch
                  v-model="flagNoIva"
                  :label="t('invoice_causals.flag_noiva')"
                  color="warning" density="comfortable" hide-details
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-switch
                  v-model="blocca"
                  :label="t('invoice_causals.blocca')"
                  color="error" density="comfortable" hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
            <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" type="button" @click="doSave">
              {{ t('common.save') }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiGavel, mdiClose, mdiContentSave, mdiLock } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  invoiceCausalsService,
  type InvoiceCausal,
  CAUSAL_TIPO_OPTIONS,
  isSystemFixedRow,
  isRouteRuleEditable,
} from '../services/invoiceCausals.service';
import CountryTogglePicker from './CountryTogglePicker.vue';

/**
 * Editor del motor de determinación de IVA/SDI (`fatture_causali_new`).
 * Réplica moderna de `fatt_causali.php`, incluyendo sus reglas de UI
 * condicionales (no solo el CRUD): filas "system-fixed" (ordine<20),
 * bloqueo de iso_from/iso_to fuera de tipo='IE' sin clase de cliente, y
 * bloqueo de aliquota/xml_natura/xml_rif_norm cuando el `art` ya está en
 * uso por otra fila del mismo partner (evita reglas duplicadas — el
 * legacy lo valida vía ConfChk()/artprecarr). Ver Invoice_Causal_Model.php
 * y Vat_Determination_Service.php para el consumo real en facturación.
 */

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<InvoiceCausal[]>([]);
const natures = ref<Record<string, string>>({});
const ceeCountries = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const tipoItems = computed(() =>
  CAUSAL_TIPO_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
);
const natureItems = computed(() =>
  Object.entries(natures.value).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) =>
      (r.tipo ?? '').toLowerCase().includes(q) ||
      (r.art ?? '').toLowerCase().includes(q) ||
      (r.descr ?? '').toLowerCase().includes(q) ||
      (r.descrEN ?? '').toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const meta = await invoiceCausalsService.listWithMeta();
    rows.value = meta.causals;
    natures.value = meta.natures;
    ceeCountries.value = meta.cee_countries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive<{
  tipo: string; ordine: number; tipo_cli_base: string; art: string;
  descr: string; descrEN: string; aliquota: number | null;
  xml_natura: string | null; xml_rif_norm: string; nota_uso: string;
}>({
  tipo: '', ordine: 0, tipo_cli_base: '', art: '',
  descr: '', descrEN: '', aliquota: null,
  xml_natura: null, xml_rif_norm: '', nota_uso: '',
});
const flagNoIva = ref(false);
const blocca = ref(false);
const isoFromTokens = ref<string[]>([]);
const isoToTokens = ref<string[]>([]);
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

// Fila con ordine<20: sembrada por el sistema, tipo/tipo_cli_base/ordine bloqueados.
const systemFixed = computed(() => editId.value !== null && isSystemFixedRow({ ordine: form.ordine }));

// Solo editable si tipo='IE' y sin clase de cliente asociada.
const routeEditable = computed(() =>
  isRouteRuleEditable({ tipo: form.tipo, tipo_cli_base: form.tipo_cli_base }),
);

// Si el `art` ya está en uso por OTRA fila del mismo partner, aliquota/
// xml_natura/xml_rif_norm quedan bloqueados (evita reglas de artículo
// duplicadas — paridad legacy artprecarr/ConfChk()).
const articleLocked = computed(() => {
  const art = form.art.trim();
  if (!art) return false;
  return rows.value.some((r) => r.id !== editId.value && (r.art ?? '').trim() === art);
});

function resetForm() {
  Object.assign(form, {
    tipo: '', ordine: nextOrdine(), tipo_cli_base: '', art: '',
    descr: '', descrEN: '', aliquota: null,
    xml_natura: null, xml_rif_norm: '', nota_uso: '',
  });
  flagNoIva.value = false;
  blocca.value = false;
  isoFromTokens.value = [];
  isoToTokens.value = [];
}

function nextOrdine(): number {
  const max = rows.value.reduce((m, r) => Math.max(m, r.ordine ?? 0), 19);
  return max + 1;
}

function parseTokens(v?: string | null): string[] {
  return (v ?? '').split(' ').map((s) => s.trim()).filter(Boolean);
}
function joinTokens(tokens: string[]): string {
  return tokens.join(' ');
}

function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(row: InvoiceCausal) {
  editId.value = row.id;
  Object.assign(form, {
    tipo: row.tipo ?? '',
    ordine: row.ordine ?? 0,
    tipo_cli_base: row.tipo_cli_base ?? '',
    art: row.art ?? '',
    descr: row.descr ?? '',
    descrEN: row.descrEN ?? '',
    aliquota: row.aliquota ?? null,
    xml_natura: row.xml_natura ?? null,
    xml_rif_norm: row.xml_rif_norm ?? '',
    nota_uso: row.nota_uso ?? '',
  });
  flagNoIva.value = row.flag_noiva === 'S';
  blocca.value = row.blocca === 'S';
  isoFromTokens.value = parseTokens(row.iso_from);
  isoToTokens.value = parseTokens(row.iso_to);
  dialogOpen.value = true;
}

function rowActions(row: InvoiceCausal): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload: Partial<InvoiceCausal> = {
      tipo: form.tipo,
      ordine: Number(form.ordine) || 0,
      tipo_cli_base: form.tipo_cli_base.trim(),
      art: form.art.trim(),
      descr: form.descr.trim(),
      descrEN: form.descrEN.trim(),
      aliquota: form.aliquota,
      xml_natura: form.xml_natura,
      xml_rif_norm: form.xml_rif_norm.trim(),
      nota_uso: form.nota_uso.trim(),
      flag_noiva: flagNoIva.value ? 'S' : 'N',
      blocca: blocca.value ? 'S' : 'N',
      iso_from: routeEditable.value ? joinTokens(isoFromTokens.value) : '',
      iso_to: routeEditable.value ? joinTokens(isoToTokens.value) : '',
    };
    if (editId.value === null) {
      await invoiceCausalsService.create(payload);
    } else {
      await invoiceCausalsService.update(editId.value, payload);
    }
    toast.success(t('common.saved'));
    dialogOpen.value = false;
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function removeRow(row: InvoiceCausal) {
  const ok = await confirm.askDanger(
    t('invoice_causals.delete_confirm', { descr: row.descr ?? '' }),
    t('invoice_causals.delete_title'),
  );
  if (!ok) return;
  try {
    await invoiceCausalsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ic-table :deep(th) { font-weight: 600; white-space: nowrap; }
.cm-dialog-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 12px 14px 20px;
  background: var(--cm-tone-accent-bg, #e6efff);
}
.cm-dialog-head__icon { color: var(--cm-accent, #1648b4); }
.cm-dialog-head__title {
  font-size: var(--cm-fs-md, 1rem); font-weight: var(--cm-fw-semibold, 600);
  color: var(--cm-tone-accent-text, #1648b4);
}
.cm-btn-accent { background: var(--cm-accent, #1648b4) !important; color: #fff !important; }
.ic-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ic-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ic-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
