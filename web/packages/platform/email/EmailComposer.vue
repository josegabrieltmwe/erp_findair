<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="ec-card">
      <!-- Cabecera compartida: la misma que usan los modales de respuestas del
           flujo, para que todos los pasos se vean de la misma familia. -->
      <ModalHeader
        :title="adapter.title"
        :subtitle="adapter.subtitle"
        :icon="adapter.icon"
      />

      <v-divider />

      <v-card-text class="ec-body">
        <!-- Controles propios del escenario (doc type, modo, selector HAWB…). -->
        <div v-if="$slots['scenario-fields']" class="ec-field">
          <slot name="scenario-fields" />
        </div>

        <!-- Destinatarios -->
        <RecipientPicker
          v-model="recipients"
          :audience="audience"
          :loading="loadingAudience"
          :allow-manual="adapter.supportsManualRecipients"
          :label="t('platform.email.recipients')"
        />

        <!-- CC -->
        <RecipientPicker
          v-if="adapter.supportsCc"
          v-model="cc"
          :audience="audience"
          :loading="loadingAudience"
          :allow-manual="adapter.supportsManualRecipients"
          :label="t('platform.email.cc')"
          :hint="t('platform.email.cc_hint')"
        />

        <!-- Idioma + nota -->
        <div class="ec-row2">
          <div v-if="adapter.supportsLangSelect" class="ec-field ec-field--lang">
            <div class="ec-field__label">{{ t('platform.email.language') }}</div>
            <v-select
              v-model="lang"
              :items="adapter.langItems()"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </div>
          <div v-if="adapter.supportsNote" class="ec-field ec-field--note">
            <div class="ec-field__label">{{ t('platform.email.note') }}</div>
            <v-textarea
              v-model="text"
              :placeholder="t('platform.email.note_ph')"
              density="comfortable"
              variant="outlined"
              rows="2"
              auto-grow
              hide-details
            />
          </div>
        </div>

        <!-- Adjuntos -->
        <div v-if="adapter.supportsAttachments && attachmentItems.length" class="ec-field">
          <div class="ec-field__label">{{ t('platform.email.attachments') }}</div>
          <v-autocomplete
            v-model="attachments"
            :items="attachmentItems"
            :placeholder="t('platform.email.attachments_ph')"
            multiple
            chips
            closable-chips
            density="comfortable"
            variant="outlined"
            hide-details
            item-title="name"
            item-value="id"
            prepend-inner-icon="mdi-paperclip"
          />
        </div>

        <!-- Preview WYSIWYG del correo real -->
        <div v-if="adapter.supportsPreview" class="ec-field">
          <div class="ec-field__label ec-field__label--row">
            <span>{{ t('platform.email.email_body') }}</span>
            <v-progress-circular
              v-if="previewLoading"
              indeterminate
              size="14"
              width="2"
              color="primary"
            />
            <button
              type="button"
              class="ec-reset"
              :title="t('platform.email.reset_body')"
              @click="reloadPreview(true)"
            >
              <v-icon icon="mdi-refresh" size="14" />
              {{ t('platform.email.reset_body') }}
            </button>
          </div>
          <div v-if="subject" class="ec-subject">
            <span class="ec-subject__label">{{ t('platform.email.subject') }}</span>
            {{ subject }}
          </div>
          <HtmlRichEditor v-model="bodyHtml" class="ec-editor" />
        </div>

        <!-- Contenido adicional del escenario tras el cuerpo (p.ej. lista de
             envíos ya realizados). -->
        <div v-if="$slots['after-body']">
          <slot name="after-body" />
        </div>

        <!-- Resultado del envío (visible dentro del modal). -->
        <v-alert
          v-if="result"
          :type="result.type"
          variant="tonal"
          density="compact"
          class="mt-1"
          :text="result.message"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions class="ec-actions">
        <span v-if="recipients.length" class="ec-count">
          {{ t('platform.email.selected_count', { count: recipients.length }) }}
        </span>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-send-outline"
          :loading="sending"
          :disabled="!recipients.length"
          @click="submit"
        >
          {{ t('platform.email.send') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HtmlRichEditor from '../ui/HtmlRichEditor.vue';
import ModalHeader from '../ui/ModalHeader.vue';
import RecipientPicker from './RecipientPicker.vue';
import type {
  AttachmentRef,
  EmailComposerModel,
  EmailScenarioAdapter,
  Recipient,
} from './types';

const props = defineProps<{
  modelValue: boolean;
  adapter: EmailScenarioAdapter;
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  sent: [{ sent: number; errors: string[] }];
}>();

const { t } = useI18n();

const recipients = ref<Recipient[]>([]);
const cc = ref<Recipient[]>([]);
const audience = ref<Recipient[]>([]);
const loadingAudience = ref(false);
const attachmentItems = ref<AttachmentRef[]>([]);
const attachments = ref<number[]>([]);

const lang = ref(props.adapter.defaultLang());
const text = ref('');
const subject = ref('');
const bodyHtml = ref('');
const previewBaseline = ref('');
const previewLoading = ref(false);
const sending = ref(false);
// Resultado del último envío, mostrado como banner dentro del modal.
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null);

let previewTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

async function loadAudience(): Promise<void> {
  loadingAudience.value = true;
  try {
    audience.value = await props.adapter.loadRecipients();
  } finally {
    loadingAudience.value = false;
  }
}

async function loadAttachments(): Promise<void> {
  if (!props.adapter.supportsAttachments || !props.adapter.loadAttachments) return;
  attachmentItems.value = await props.adapter.loadAttachments();
}

/**
 * Trae el correo real renderizado y lo carga en el editor. `force` ignora
 * ediciones locales del operador (botón restablecer / cambio de plantilla).
 */
async function reloadPreview(force = false): Promise<void> {
  if (!props.adapter.supportsPreview) return;
  if (!force && bodyHtml.value !== previewBaseline.value && bodyHtml.value !== '') {
    return;
  }
  previewLoading.value = true;
  try {
    const p = await props.adapter.preview({ lang: lang.value, text: text.value });
    if (p) {
      subject.value = p.subject;
      bodyHtml.value = p.body;
      previewBaseline.value = p.body;
      if (p.lang) lang.value = p.lang;
    }
  } finally {
    previewLoading.value = false;
  }
}

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => reloadPreview(false), 400);
}

function reset(): void {
  recipients.value = [];
  cc.value = [];
  attachments.value = [];
  text.value = '';
  subject.value = '';
  bodyHtml.value = '';
  previewBaseline.value = '';
  result.value = null;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  lang.value = props.adapter.defaultLang();
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    reset();
    await Promise.all([loadAudience(), loadAttachments()]);
    await reloadPreview(true);
  },
);

// Cambio de idioma = cambio de plantilla → recarga forzada.
watch(lang, () => {
  if (props.modelValue) reloadPreview(true);
});
// El adapter puede cambiar de identidad cuando el escenario altera un control
// propio que afecta al render (p.ej. el modo Q/I de partner-offer). Recarga
// forzada del preview en ese caso.
watch(
  () => props.adapter,
  () => {
    if (props.modelValue) reloadPreview(true);
  },
);
// La nota se inyecta en el cuerpo → recarga con debounce (si no editado a mano).
watch(text, () => {
  if (props.modelValue) schedulePreview();
});

async function submit(): Promise<void> {
  if (!recipients.value.length) return;
  sending.value = true;
  try {
    // Solo se envía body_html si el operador editó el cuerpo; si no, el backend
    // resuelve el template (regresión segura respecto a los flujos actuales).
    const edited =
      props.adapter.supportsPreview &&
      bodyHtml.value !== '' &&
      bodyHtml.value !== previewBaseline.value;

    const model: EmailComposerModel = {
      lang: lang.value,
      text: text.value,
      subject: subject.value,
      bodyHtml: edited ? bodyHtml.value : '',
      recipients: [...recipients.value],
      cc: [...cc.value],
      attachments: [...attachments.value],
    };
    const res = await props.adapter.send(model);
    emit('sent', res);
    if (res.sent > 0) {
      // Confirmación clara dentro del modal + cierre tras un instante para que
      // el usuario vea que la solicitud se envió.
      result.value = {
        type: 'success',
        message: t('platform.email.sent_ok', { count: res.sent }),
      };
      closeTimer = setTimeout(() => emit('update:modelValue', false), 1200);
    } else {
      // Fallo: banner de error con el motivo del backend (no cerrar, para que
      // el usuario corrija).
      result.value = {
        type: 'error',
        message: res.errors && res.errors.length
          ? res.errors[0]
          : t('platform.email.send_failed'),
      };
    }
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped lang="scss">
.ec-card {
  border-radius: 14px;
  overflow: hidden;
}
.ec-body {
  padding: 18px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ec-field__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 7px;
}
.ec-field__label--row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ec-reset {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
}
.ec-reset:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}
.ec-row2 {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 520px) {
  .ec-row2 {
    grid-template-columns: 1fr;
  }
}
.ec-subject {
  font-size: 12.5px;
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
  border-radius: 8px;
  padding: 7px 10px;
  margin-bottom: 8px;
  line-height: 1.35;
}
.ec-subject__label {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-right: 6px;
}
.ec-editor {
  border-radius: 8px;
}
.ec-actions {
  padding: 10px 16px;
}
.ec-count {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
