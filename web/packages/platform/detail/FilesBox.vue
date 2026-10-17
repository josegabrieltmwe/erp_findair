<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-paperclip" class="me-2" />
      {{ t('platform.files.title') }}
      <v-badge :content="activeFiles.length" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-btn-toggle v-model="scope" mandatory density="compact" variant="outlined" divided>
        <v-btn value="ext" size="small" prepend-icon="mdi-earth">{{ t('platform.files.external') }}</v-btn>
        <v-btn value="int" size="small" prepend-icon="mdi-lock-outline">{{ t('platform.files.internal') }}</v-btn>
      </v-btn-toggle>
    </v-card-title>

    <v-card-subtitle v-if="scope === 'int'" class="text-caption pb-0">
      {{ t('platform.files.internal_hint') }}
    </v-card-subtitle>

    <v-card-text>
      <div
        class="upload-zone"
        :class="{ 'upload-zone--drag': isDragging, 'upload-zone--busy': uploading }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="(($refs.fileInput as HTMLInputElement | undefined))?.click()"
      >
        <input ref="fileInput" type="file" multiple style="display:none" @change="onPicked" />
        <v-icon icon="mdi-cloud-upload-outline" size="40" color="primary" />
        <div class="text-subtitle-2 mt-2">
          {{ uploading ? t('platform.files.uploading') : t('platform.files.drop_hint') }}
        </div>
        <div class="text-caption text-medium-emphasis">{{ t('platform.files.formats_hint') }}</div>
        <v-progress-linear v-if="uploading" indeterminate color="primary" class="mt-3" />
      </div>
    </v-card-text>

    <v-data-table
      v-if="activeFiles.length"
      :headers="headers"
      :items="activeFiles"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
    >
      <template #item.nome="{ item }">
        <div class="d-flex align-center">
          <v-icon :icon="iconForFile((item as FileRow).nome)" class="me-2" />
          <div>
            <a :href="downloadUrl(item as FileRow)" target="_blank" rel="noopener"
               class="text-body-2 font-weight-medium text-decoration-none">
              {{ (item as FileRow).nome || `File #${(item as FileRow).id}` }}
            </a>
            <div v-if="(item as FileRow).descrizione" class="text-caption text-medium-emphasis">
              {{ (item as FileRow).descrizione }}
            </div>
          </div>
        </div>
      </template>
      <template #item.peso_kb="{ item }">
        <span class="text-caption text-medium-emphasis">{{ formatKb((item as FileRow).peso_kb) }}</span>
      </template>
      <template #item.visibility="{ item }">
        <div v-if="scope === 'ext'" class="d-flex gap-1">
          <v-btn
            v-for="r in recipients"
            :key="r.key"
            size="x-small"
            :variant="isVisible(item as FileRow, r.key) ? 'flat' : 'tonal'"
            :color="isVisible(item as FileRow, r.key) ? 'success' : undefined"
            :title="r.label"
            @click="onToggle(item as FileRow, r.key)"
          >
            {{ r.short }}
          </v-btn>
        </div>
        <span v-else class="text-caption text-medium-emphasis">—</span>
      </template>
      <template #item.created="{ item }">
        <span class="text-caption">{{ String((item as FileRow).created ?? '').slice(0, 16) }}</span>
      </template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" @click="onDelete((item as FileRow).id)" />
      </template>
    </v-data-table>

    <v-empty-state
      v-else-if="!loading"
      icon="mdi-folder-open-outline"
      :title="scope === 'int' ? t('platform.files.empty_internal') : t('platform.files.empty_external')"
      :text="t('platform.files.empty_hint')"
    />
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * Files box shell — shared by cargo and shipment detail. Pure presentation:
 * the host injects the file lists (ext/int), the recipients, and the action
 * callbacks (upload/remove/toggle-visibility) plus a download-url builder. The
 * per-app store/service stay in the app (they hit different endpoints).
 */
export interface FileRow {
  id: number;
  nome: string;
  descrizione?: string;
  peso_kb: number;
  created?: string | null;
  show_cliente?: boolean;
  show_partner?: boolean;
  show_agdogan?: boolean;
  show_vettore?: boolean;
  [k: string]: unknown;
}

export type FileScope = 'ext' | 'int';
export type FileRecipient = 'cliente' | 'partner' | 'agdogan' | 'vettore';

const props = defineProps<{
  ext: FileRow[];
  int: FileRow[];
  loading?: boolean;
  uploading?: boolean;
  downloadUrl: (f: FileRow) => string;
  onUpload: (files: File[], scope: FileScope) => void | Promise<void>;
  onRemove: (fileId: number, scope: FileScope) => void | Promise<void>;
  onToggleVisibility: (fileId: number, recipient: FileRecipient, visible: boolean) => void | Promise<void>;
}>();

const scope = ref<FileScope>('ext');
const activeFiles = computed<FileRow[]>(() => (scope.value === 'int' ? props.int : props.ext));

const recipients = computed<{ key: FileRecipient; label: string; short: string }[]>(() => [
  { key: 'cliente', label: t('platform.files.visible_client') as string, short: 'CL' },
  { key: 'partner', label: t('platform.files.visible_partner') as string, short: 'PR' },
  { key: 'agdogan', label: t('platform.files.visible_agdogan') as string, short: 'AG' },
  { key: 'vettore', label: t('platform.files.visible_carrier') as string, short: 'VT' },
]);

const headers = computed(() => [
  { title: t('platform.files.col_file'), key: 'nome', sortable: true },
  { title: t('platform.files.col_size'), key: 'peso_kb', width: 90, sortable: true },
  { title: t('platform.files.col_visibility'), key: 'visibility', width: 200, sortable: false },
  { title: t('platform.files.col_uploaded'), key: 'created', width: 150, sortable: true },
  { title: '', key: 'actions', width: 56, sortable: false },
]);

const isDragging = ref(false);

function isVisible(item: FileRow, r: FileRecipient): boolean {
  return Boolean(item[`show_${r}`]);
}

async function onToggle(item: FileRow, r: FileRecipient): Promise<void> {
  await props.onToggleVisibility(item.id, r, !isVisible(item, r));
}

async function uploadList(list: File[]): Promise<void> {
  if (list.length === 0) return;
  await props.onUpload(list, scope.value);
  isDragging.value = false;
}

async function onPicked(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  await uploadList(Array.from(input.files));
  input.value = '';
}

async function onDrop(e: DragEvent): Promise<void> {
  if (!e.dataTransfer?.files) return;
  await uploadList(Array.from(e.dataTransfer.files));
}

async function onDelete(fileId: number): Promise<void> {
  if (!confirm(t('platform.files.delete_confirm') as string)) return;
  await props.onRemove(fileId, scope.value);
}

function iconForFile(name: string): string {
  const e = name.split('.').pop()?.toLowerCase() ?? '';
  if (e === 'pdf') return 'mdi-file-pdf-box';
  if (['png', 'jpg', 'jpeg', 'gif', 'tif', 'tiff'].includes(e)) return 'mdi-file-image-outline';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'mdi-file-table-outline';
  if (['doc', 'docx'].includes(e)) return 'mdi-file-document-outline';
  return 'mdi-file-outline';
}

function formatKb(kb: number): string {
  const n = Number(kb ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} KB`;
  return `${(n / 1024).toFixed(1)} MB`;
}
</script>

<style scoped>
.upload-zone {
  border: 2px dashed rgb(var(--v-theme-on-surface), 0.18);
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.upload-zone:hover {
  background: rgb(var(--v-theme-surface-variant), 0.4);
  border-color: rgb(var(--v-theme-primary));
}
.upload-zone--drag {
  background: rgb(var(--v-theme-primary), 0.08);
  border-color: rgb(var(--v-theme-primary));
}
.upload-zone--busy { cursor: progress; }
.gap-1 { gap: 4px; }
</style>
