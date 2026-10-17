<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";

import { useCrmStore } from "../stores/crm.store";
import type { MetodoInvio } from "../types";

const props = defineProps<{
  modelValue: boolean;
  idCrm: number;
  defaultEmail: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const store = useCrmStore();
const { t } = useI18n();

// Canales soportados (paridad docsstory: metodo M/S/F/C). El legacy sólo deja
// eMail activo por defecto; se conservan los demás como en el compositor.
const METODI: { title: string; value: MetodoInvio; icon: string }[] = [
  { title: "eMail", value: "M", icon: "mdi-email-outline" },
  { title: "SMS", value: "S", icon: "mdi-message-text-outline" },
  { title: "FAX", value: "F", icon: "mdi-fax" },
  { title: "Posta", value: "C", icon: "mdi-mailbox-outline" },
];
const MAX_FILES = 3; // paridad legacy file1/file2/file3

const metodo = ref<MetodoInvio>("M");
const dest = ref("");
const subject = ref("");
const text = ref("");
const useBase = ref(true);
const files = ref<File[]>([]);
const sending = ref(false);
const feedback = ref<{ type: "success" | "error"; msg: string } | null>(null);

// El asunto es obligatorio salvo en SMS (paridad validación legacy DCSTYJS04),
// y sólo si no se usa la plantilla base (que aporta su propio asunto).
const subjectRequired = computed(() => metodo.value !== "S" && !useBase.value);
const canSend = computed(
  () =>
    !sending.value && (!subjectRequired.value || subject.value.trim() !== ""),
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      metodo.value = "M";
      dest.value = props.defaultEmail || "";
      subject.value = "";
      text.value = "";
      useBase.value = true;
      files.value = [];
      feedback.value = null;
    }
  },
);

function close(): void {
  emit("update:modelValue", false);
}

const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

/** Añade archivos ACUMULANDO (no reemplaza) hasta el máximo, evitando
 *  duplicados por nombre+tamaño. */
function addFiles(incoming: FileList | File[] | null): void {
  if (!incoming) return;
  const list = Array.from(incoming);
  const merged = [...files.value];
  for (const f of list) {
    if (merged.length >= MAX_FILES) break;
    const dup = merged.some((x) => x.name === f.name && x.size === f.size);
    if (!dup) merged.push(f);
  }
  files.value = merged.slice(0, MAX_FILES);
}

function onInputChange(e: Event): void {
  const el = e.target as HTMLInputElement;
  addFiles(el.files);
  el.value = ""; // permite volver a elegir el mismo archivo
}

function onDrop(e: DragEvent): void {
  dragging.value = false;
  addFiles(e.dataTransfer?.files ?? null);
}

function removeFile(idx: number): void {
  files.value = files.value.filter((_, i) => i !== idx);
}

function pickFiles(): void {
  fileInput.value?.click();
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function send(): Promise<void> {
  if (!canSend.value) return;
  sending.value = true;
  feedback.value = null;
  try {
    const rec = await store.sendMessage(
      {
        id_crm: props.idCrm,
        metodo: metodo.value,
        dest_msg: dest.value.trim() || undefined,
        descriz: subject.value.trim() || undefined,
        text: text.value.trim() || undefined,
        usabase: useBase.value ? "S" : "N",
      },
      files.value,
    );
    feedback.value = {
      type: rec.esito === "KO" ? "error" : "success",
      msg: t("crm.send.result", { esito: rec.esito }),
    };
    if (rec.esito !== "KO") {
      setTimeout(close, 900);
    }
  } catch (e) {
    feedback.value = {
      type: "error",
      msg: e instanceof Error ? e.message : t("crm.send.error"),
    };
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AppDialog
    :open="modelValue"
    :title="t('crm.send.title')"
    icon="mdi-email-fast-outline"
    size="md"
    @close="close"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-alert
      v-if="feedback"
      :type="feedback.type"
      variant="tonal"
      density="compact"
      class="mb-4"
      :text="feedback.msg"
    />

    <!-- Canal + destinatario -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-select
          v-model="metodo"
          :items="METODI"
          :label="t('crm.send.metodo')"
          density="compact"
          variant="outlined"
          hide-details
        >
          <template #item="{ props: ip, item }">
            <v-list-item v-bind="ip" :prepend-icon="item.raw.icon" />
          </template>
        </v-select>
      </v-col>
      <v-col cols="12" sm="8">
        <v-text-field
          v-model="dest"
          :label="t('crm.send.dest')"
          :hint="t('crm.send.dest_hint')"
          persistent-hint
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-account-arrow-right-outline"
        />
      </v-col>
    </v-row>

    <!-- Asunto -->
    <v-text-field
      v-model="subject"
      :label="t('crm.send.subject')"
      :hint="t('crm.send.subject_hint')"
      persistent-hint
      density="compact"
      variant="outlined"
      class="mt-2"
      :error="subjectRequired && subject.trim() === ''"
    />

    <!-- Cuerpo -->
    <v-textarea
      v-model="text"
      :label="t('crm.send.text')"
      density="compact"
      variant="outlined"
      rows="5"
      auto-grow
      class="mt-2"
    />

    <!-- Adjuntos (paridad legacy file1/2/3): zona drag & drop + lista con
         botón para quitar cada archivo. -->
    <div class="mt-3">
      <div class="ec-field__label mb-1">
        {{ t("crm.send.files") }}
        <span class="text-caption text-medium-emphasis"
          >· {{ files.length }}/{{ MAX_FILES }}</span
        >
      </div>
      <div
        class="dropzone"
        :class="{
          'dropzone--drag': dragging,
          'dropzone--full': files.length >= MAX_FILES,
        }"
        role="button"
        tabindex="0"
        @click="files.length < MAX_FILES && pickFiles()"
        @keydown.enter.prevent="pickFiles"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <v-icon
          :icon="dragging ? 'mdi-tray-arrow-down' : 'mdi-cloud-upload-outline'"
          size="26"
          class="dropzone__icon"
        />
        <div class="dropzone__text">
          <template v-if="files.length >= MAX_FILES">
            {{ t("crm.send.files_full", { max: MAX_FILES }) }}
          </template>
          <template v-else>
            <strong>{{ t("crm.send.files_cta") }}</strong>
            <span class="text-medium-emphasis">
              · {{ t("crm.send.files_hint", { max: MAX_FILES }) }}</span
            >
          </template>
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="d-none"
        @change="onInputChange"
      />

      <!-- Lista de archivos seleccionados -->
      <div v-if="files.length" class="filelist mt-2">
        <div v-for="(f, i) in files" :key="`${f.name}-${i}`" class="fileitem">
          <v-icon icon="mdi-file-outline" size="16" class="fileitem__icon" />
          <span class="fileitem__name text-truncate">{{ f.name }}</span>
          <span class="fileitem__size">{{ humanSize(f.size) }}</span>
          <v-btn
            icon="mdi-close"
            size="x-small"
            variant="text"
            color="error"
            :aria-label="t('common.delete')"
            @click="removeFile(i)"
          />
        </div>
      </div>
    </div>

    <!-- Usar plantilla base -->
    <v-switch
      v-model="useBase"
      :label="t('crm.send.use_base')"
      :hint="t('crm.send.use_base_hint')"
      persistent-hint
      color="primary"
      density="compact"
      class="mt-1"
    />

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-send-outline"
        :loading="sending"
        :disabled="!canSend"
        @click="send"
      >
        {{ t("crm.send.button") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<style scoped>
.ec-field__label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.75);
}

/* Zona de arrastre: borde punteado, realce al arrastrar encima. */
.dropzone {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px dashed rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease;
}
.dropzone:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  background: rgba(var(--v-theme-primary), 0.03);
}
.dropzone--drag {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.dropzone--full {
  cursor: default;
  opacity: 0.7;
}
.dropzone--full:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.25);
  background: transparent;
}
.dropzone__icon {
  color: rgb(var(--v-theme-primary));
  flex: 0 0 auto;
}
.dropzone__text {
  font-size: 13px;
  line-height: 1.3;
}

/* Lista de archivos adjuntos con botón para quitar cada uno. */
.filelist {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fileitem {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.fileitem__icon {
  flex: 0 0 auto;
  opacity: 0.7;
}
.fileitem__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
}
.fileitem__size {
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
</style>
