<template>
  <div>
    <CmSectionHeader :title="t('sections.site_notices')" :subtitle="t('site_notices.subtitle')" />

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('site_notices.help') }}
    </v-alert>
    <v-alert v-if="!canWrite" type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('site_notices.read_only') }}
    </v-alert>

    <div class="d-flex mb-3">
      <v-spacer />
      <v-btn v-if="canWrite" class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('site_notices.new') }}
      </v-btn>
    </div>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="4"
      :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiBullhornOutline" :title="t('site_notices.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="comfortable" class="cm-table-zebra">
            <thead>
              <tr>
                <th style="width:130px">{{ t('site_notices.state') }}</th>
                <th style="width:170px">{{ t('site_notices.start') }}</th>
                <th style="width:170px">{{ t('site_notices.end') }}</th>
                <th>{{ t('site_notices.text') }}</th>
                <th class="text-center" style="width:140px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>
                  <v-chip size="small" :color="stateColor(row)" variant="tonal">
                    {{ t(`site_notices.state_${noticeState(row)}`) }}
                  </v-chip>
                </td>
                <td>{{ fmt(row.data_start) }}</td>
                <td>{{ fmt(row.data_stop) }}</td>
                <td class="sn-text">{{ excerpt(row.testo) }}</td>
                <td class="text-center"><CmRowActions :actions="rowActions(row)" /></td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </CmAsyncSection>

    <!-- Alta / edicion -->
    <v-dialog v-model="dialogOpen" max-width="760" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiBullhornOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('site_notices.new') : t('site_notices.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />
        <v-card-text class="pt-5">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.data_start"
                type="datetime-local"
                :label="t('site_notices.start')"
                :readonly="!canWrite"
                variant="outlined" density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.data_stop"
                type="datetime-local"
                :label="t('site_notices.end')"
                :readonly="!canWrite"
                variant="outlined" density="comfortable"
              />
            </v-col>
          </v-row>
          <div class="text-caption mb-1">{{ t('site_notices.text') }} *</div>
          <HtmlRichEditor v-if="canWrite" v-model="form.testo" class="sn-editor" />
          <div v-else class="sn-preview pa-3" v-html="safeHtml" />
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mt-3">
            {{ t(`site_notices.err_${formError}`) }}
          </v-alert>

          <div class="text-caption mt-4 mb-1">{{ t('site_notices.preview') }}</div>
          <div class="sn-banner" v-html="safeHtml" />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn
            v-if="canWrite"
            class="cm-btn-accent" variant="flat" :loading="saving"
            :prepend-icon="mdiContentSave" @click="doSave"
          >
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Vista previa tal como la ven los clientes -->
    <v-dialog v-model="previewOpen" max-width="640">
      <v-card rounded="lg">
        <v-card-title>{{ t('site_notices.preview') }}</v-card-title>
        <v-card-text>
          <div class="sn-banner" v-html="previewHtml" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="previewOpen = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiEye, mdiBullhornOutline, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import HtmlRichEditor from '../../ui/HtmlRichEditor.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { useProfile } from '../../composables/useProfile';
import {
  siteNoticesService, noticeState, toInputValue, fromInputValue, validateNotice,
  sanitizeNoticeHtml, plainText, type SiteNotice, type NoticeErrorKey,
} from '../services/siteNotices.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();
const { isAdmin, ensureProfile } = useProfile();

// Las rutas de Settings ya exigen admin; el backend (modulo master_data) sigue
// siendo quien decide. Si el perfil dice que no es admin, la pantalla es de solo lectura.
const canWrite = computed(() => isAdmin.value !== false);

const rows = ref<SiteNotice[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await siteNoticesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function fmt(v: string | null): string {
  return v ? v.slice(0, 16).replace('T', ' ') : t('site_notices.no_limit');
}
function excerpt(html: string): string {
  const s = plainText(html);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}
function stateColor(r: SiteNotice): string {
  const s = noticeState(r);
  return s === 'active' ? 'success' : s === 'scheduled' ? 'info' : 'grey';
}

const dialogOpen = ref(false);
const editId = ref<number | null>(null);
const formError = ref<NoticeErrorKey | null>(null);
const form = reactive({ data_start: '', data_stop: '', testo: '' });
const safeHtml = computed(() => sanitizeNoticeHtml(form.testo));

function openCreate() {
  editId.value = null;
  formError.value = null;
  Object.assign(form, { data_start: toInputValue(new Date().toISOString()), data_stop: '', testo: '' });
  dialogOpen.value = true;
}
function openEdit(row: SiteNotice) {
  editId.value = row.id;
  formError.value = null;
  Object.assign(form, {
    data_start: toInputValue(row.data_start),
    data_stop: toInputValue(row.data_stop),
    testo: row.testo ?? '',
  });
  dialogOpen.value = true;
}

const previewOpen = ref(false);
const previewHtml = ref('');
function openPreview(row: SiteNotice) {
  previewHtml.value = sanitizeNoticeHtml(row.testo ?? '');
  previewOpen.value = true;
}

function rowActions(row: SiteNotice): RowAction[] {
  const actions: RowAction[] = [
    { key: 'preview', title: t('site_notices.preview'), icon: mdiEye, onClick: () => openPreview(row) },
  ];
  if (canWrite.value) {
    actions.push(
      { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
      { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
    );
  }
  return actions;
}

async function doSave() {
  const payload = {
    data_start: fromInputValue(form.data_start),
    data_stop: fromInputValue(form.data_stop),
    testo: form.testo,
  };
  formError.value = validateNotice(payload);
  if (formError.value) return;
  saving.value = true;
  try {
    if (editId.value === null) await siteNoticesService.create(payload);
    else await siteNoticesService.update(editId.value, payload);
    toast.success(t('common.saved'));
    dialogOpen.value = false;
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function removeRow(row: SiteNotice) {
  const ok = await confirm.askDanger(t('site_notices.delete_confirm'), t('site_notices.delete_title'));
  if (!ok) return;
  try {
    await siteNoticesService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(async () => {
  await ensureProfile();
  load();
});
</script>

<style scoped>
.sn-text { max-width: 420px; overflow: hidden; text-overflow: ellipsis; }
.sn-editor :deep(.hre-surface) { min-height: 140px; max-height: 260px; }
.sn-preview, .sn-banner {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}
.sn-banner { padding: 12px 16px; background: #fff8e1; color: #5d4300; border-color: #f0c36d; }
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
</style>
