<template>
  <div class="composer-wrap">
    <div v-if="attachment" class="attachment-preview">
      <v-icon icon="mdi-paperclip" size="16" class="mr-1" />
      <span class="filename">{{ attachment.filename }}</span>
      <v-btn
        icon="mdi-close"
        size="x-small"
        variant="text"
        :aria-label="t('copilot.chat.remove_attachment')"
        @click="emit('remove-attachment')"
      />
    </div>

    <div
      v-else-if="showLongTextHint"
      class="text-caption text-medium-emphasis long-text-hint"
    >
      {{ t("copilot.chat.long_text_hint") }}
    </div>

    <div class="composer">
      <input
        ref="fileInput"
        type="file"
        class="hidden-file-input"
        :accept="ACCEPTED_FILE_EXTENSIONS"
        @change="onFilePicked"
      />
      <v-btn
        icon="mdi-paperclip"
        color="secondary"
        size="large"
        variant="tonal"
        :disabled="disabled"
        :aria-label="t('copilot.chat.attach')"
        @click="fileInput?.click()"
      />
      <v-textarea
        v-model="draft"
        :placeholder="t('copilot.chat.placeholder')"
        rows="1"
        auto-grow
        max-rows="6"
        hide-details
        density="comfortable"
        :disabled="disabled"
        @keydown.enter.exact.prevent="submit"
        @paste="onPaste"
      />
      <v-btn
        v-if="voiceSupported"
        :icon="listening ? 'mdi-microphone' : 'mdi-microphone-outline'"
        :color="listening ? 'error' : 'secondary'"
        size="large"
        variant="tonal"
        :disabled="disabled"
        :aria-label="'voice'"
        @click="emit('mic')"
      />
      <v-btn
        icon="mdi-send"
        color="primary"
        size="large"
        :disabled="disabled || (draft.trim() === '' && !attachment)"
        :aria-label="t('copilot.chat.send')"
        @click="submit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

/** Igual que ACCEPTED_ATTACHMENT_MIME_TYPES del store (chat.store.ts): solo pista visual del selector de fichero,
 * la validación real (tamaño y tipo) la hace attachFile(). */
const ACCEPTED_FILE_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.txt";

const props = defineProps<{
  disabled?: boolean;
  voiceSupported?: boolean;
  listening?: boolean;
  attachment?: { filename: string; mimeType: string } | null;
}>();
const emit = defineEmits<{
  (e: "send", value: string): void;
  (e: "mic"): void;
  (e: "attach", file: File): void;
  (e: "remove-attachment"): void;
}>();
const { t } = useI18n();

const draft = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

// C1 (docs/plan-extraccion-ia-erp.md): aviso suave de que un texto largo pegado también puede prepararse como
// expedición, sin forzar al staff a adjuntar nada — el Copilot ya sabe leer un párrafo largo en un mensaje normal.
const showLongTextHint = computed(() => draft.value.trim().length > 500);

function submit(): void {
  const text = draft.value.trim();
  if ((text === "" && !props.attachment) || props.disabled) return;
  emit("send", text);
  draft.value = "";
}

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("attach", file);
  input.value = "";
}

/** Una imagen pegada del portapapeles se trata como adjunto, no como texto (evita volcar basura en el textarea). */
function onPaste(event: ClipboardEvent): void {
  const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
    f.type.startsWith("image/"),
  );
  if (!file) return;
  event.preventDefault();
  emit("attach", file);
}
</script>

<style scoped>
.composer-wrap {
  border-top: 1px solid rgb(var(--v-theme-on-surface-variant) / 0.15);
  background: rgb(var(--v-theme-surface));
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
}
.composer :deep(.v-textarea) {
  flex: 1 1 auto;
}
.hidden-file-input {
  display: none;
}
.attachment-preview {
  display: flex;
  align-items: center;
  padding: 6px 16px 0;
  font-size: 13px;
}
.attachment-preview .filename {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.long-text-hint {
  padding: 4px 16px 0;
}
</style>
