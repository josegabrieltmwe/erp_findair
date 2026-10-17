<template>
  <div>
    <CmSectionHeader
      :title="t('sections.good_types')"
      :subtitle="t('good_types.subtitle')"
    />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('good_types.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('good_types.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="6"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiPackageVariant" :title="t('good_types.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="gt-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:90px">{{ t('good_types.sigla') }}</th>
                <th style="width:90px">{{ t('good_types.sigla2') }}</th>
                <th>{{ t('good_types.label') }}</th>
                <th class="text-center" style="width:110px">{{ t('good_types.lista_base') }}</th>
                <th class="text-center" style="width:90px" :title="t('good_types.dang_hint')">{{ t('good_types.dang') }}</th>
                <th class="text-center" style="width:90px" :title="t('good_types.dryice_hint')">{{ t('good_types.dryice') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.sigla">
                <td class="text-center"><b>{{ row.sigla }}</b></td>
                <td class="text-center">{{ row.sigla2 || '—' }}</td>
                <td>
                  <span class="d-flex align-center" style="gap:8px">
                    <img v-if="row.icon" :src="row.icon" alt="" style="width:20px;height:20px;object-fit:contain" />
                    <span>{{ row.label }}</span>
                  </span>
                </td>
                <td class="text-center"><FlagIcon :value="row.lista_base" /></td>
                <td class="text-center"><FlagIcon :value="row.dangerous_goods_supplement" warn /></td>
                <td class="text-center"><FlagIcon :value="row.dry_ice_goods_supplement" warn /></td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('good_types.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <!-- Dialog crear / editar -->
    <v-dialog v-model="dialogOpen" max-width="640" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiPackageVariant" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editSigla === null ? t('good_types.new') : t('good_types.edit') }}</span>
          <v-chip v-if="editSigla" size="small" variant="flat" class="cm-dialog-head__chip ms-2">{{ editSigla }}</v-chip>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.sigla"
                  :label="t('good_types.sigla')"
                  :rules="[requiredRule]"
                  :hint="t('good_types.sigla_hint')" persistent-hint
                  :disabled="editSigla !== null"
                  variant="outlined" density="comfortable" class="text-uppercase"
                  :prepend-inner-icon="mdiTagOutline" maxlength="10"
                  @update:model-value="(v:string) => (form.sigla = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.sigla2"
                  :label="t('good_types.sigla2')"
                  variant="outlined" density="comfortable" maxlength="10"
                  :prepend-inner-icon="mdiTagOutline"
                />
              </v-col>

              <v-col cols="12" sm="4">
                <v-text-field v-model="form.labelITA" :label="t('good_types.label_ita')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field v-model="form.labelENG" :label="t('good_types.label_eng')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field v-model="form.labelSPA" :label="t('good_types.label_spa')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>

              <v-col cols="12" sm="4">
                <v-select v-model="form.lista_base" :items="flagItems" item-title="title" item-value="value" :label="t('good_types.lista_base')" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select v-model="form.danggoods" :items="flagItems" item-title="title" item-value="value" :label="t('good_types.dang')" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select v-model="form.dryice" :items="flagItems" item-title="title" item-value="value" :label="t('good_types.dryice')" variant="outlined" density="comfortable" />
              </v-col>
            </v-row>
            <p class="text-caption text-medium-emphasis mt-2">{{ t('good_types.label_required_hint') }}</p>
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
import { ref, reactive, computed, h, onMounted, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiPackageVariant,
  mdiClose, mdiContentSave, mdiTagOutline, mdiCheckCircle, mdiCircleOutline, mdiAlertCircle,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  goodTypesService,
  type GoodType,
  type Flag,
} from '../services/goodTypes.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

// Icono S/N (verde check / gris; ámbar cuando `warn` para dang/dryice).
const FlagIcon = defineComponent({
  props: { value: { type: String, default: 'N' }, warn: { type: Boolean, default: false } },
  setup(props) {
    return () =>
      h('i', {
        class: 'v-icon notranslate v-icon--size-default',
        style: `color:${props.value === 'S' ? (props.warn ? '#e65100' : '#2e7d32') : '#bdbdbd'}`,
      }, [
        h('svg', { viewBox: '0 0 24 24', style: 'width:20px;height:20px;fill:currentColor' }, [
          h('path', { d: props.value === 'S' ? (props.warn ? mdiAlertCircle : mdiCheckCircle) : mdiCircleOutline }),
        ]),
      ]);
  },
});

const rows = ref<GoodType[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) =>
      r.sigla.toLowerCase().includes(q) ||
      (r.sigla2 ?? '').toLowerCase().includes(q) ||
      (r.label ?? '').toLowerCase().includes(q),
  );
});

const flagItems = [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
];

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await goodTypesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// ── Crear / Editar ──
const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editSigla = ref<string | null>(null);
const form = reactive({
  sigla: '', sigla2: '', labelITA: '', labelENG: '', labelSPA: '',
  lista_base: 'N' as Flag, danggoods: 'N' as Flag, dryice: 'N' as Flag,
});
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, {
    sigla: '', sigla2: '', labelITA: '', labelENG: '', labelSPA: '',
    lista_base: 'N', danggoods: 'N', dryice: 'N',
  });
}
function openCreate() {
  editSigla.value = null;
  resetForm();
  dialogOpen.value = true;
}
/** Acciones de fila: editar (visible) + eliminar en kebab. */
function rowActions(row: GoodType): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function openEdit(row: GoodType) {
  editSigla.value = row.sigla;
  resetForm();
  dialogOpen.value = true;
  // Fetch full detail (3 raw labels) — the list only carries the localized one.
  try {
    const d = await goodTypesService.getBySigla(row.sigla);
    if (d) {
      Object.assign(form, {
        sigla: d.sigla,
        sigla2: d.sigla2 ?? '',
        labelITA: d.labelITA ?? '',
        labelENG: d.labelENG ?? '',
        labelSPA: d.labelSPA ?? '',
        lista_base: d.lista_base ?? 'N',
        danggoods: d.danggoods ?? 'N',
        dryice: d.dryice ?? 'N',
      });
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  if (!form.sigla.trim()) { toast.error(t('good_types.sigla_required')); return; }
  if (!form.labelITA.trim() && !form.labelENG.trim() && !form.labelSPA.trim()) {
    toast.error(t('good_types.label_required')); return;
  }
  saving.value = true;
  try {
    const payload = {
      sigla: form.sigla.trim().toUpperCase(),
      sigla2: form.sigla2.trim(),
      labelITA: form.labelITA.trim(),
      labelENG: form.labelENG.trim(),
      labelSPA: form.labelSPA.trim(),
      lista_base: form.lista_base,
      danggoods: form.danggoods,
      dryice: form.dryice,
    };
    if (editSigla.value === null) {
      await goodTypesService.create(payload);
    } else {
      await goodTypesService.update(editSigla.value, payload);
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

async function removeRow(row: GoodType) {
  const ok = await confirm.askDanger(
    t('good_types.delete_confirm', { sigla: row.sigla }),
    t('good_types.delete_title'),
  );
  if (!ok) return;
  try {
    await goodTypesService.remove(row.sigla);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.gt-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.cm-dialog-head__chip { background: var(--cm-accent, #1648b4) !important; color: #fff !important; font-weight: 700; }
.cm-btn-accent { background: var(--cm-accent, #1648b4) !important; color: #fff !important; }
.gt-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.gt-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.gt-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
