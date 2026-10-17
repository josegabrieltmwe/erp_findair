<template>
  <AppDialog
    :open="modelValue"
    size="xl"
    :title="
      isNew
        ? t('email_templates.new')
        : t('email_templates.edit_title', { tipo: form.tipo })
    "
    :icon="mdiEmailEditOutline"
    @close="close"
  >
    <v-alert
      v-if="loadError"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
      :text="loadError"
    />

    <v-alert
      v-if="isBaseReadOnly"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3"
      :text="t('email_templates.base_readonly')"
    />

    <FormSection
      :title="t('email_templates.section_meta')"
      :icon="mdiTagOutline"
    >
      <v-row dense>
        <v-col cols="12" sm="3">
          <v-text-field
            v-model="form.tipo"
            :label="t('email_templates.tipo')"
            :disabled="!isNew"
            :hint="t('email_templates.tipo_hint')"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select
            v-model="form.lingua"
            :items="LINGUE"
            :label="t('email_templates.lingua')"
            :disabled="!isNew"
          />
        </v-col>
        <!--
          Dueño de la plantilla. Solo TMWE lo elige, y solo al crear:
            · sin partner  → plantilla BASE (id_anagrafica = 1), la que se usa
              cuando un partner no tiene la suya.
            · con partner  → especialización de ese partner.
          Un partner siempre crea para sí mismo (lo impone el servidor), así
          que no se le muestra. Al editar es de solo lectura: una plantilla no
          cambia de dueño.
        -->
        <v-col v-if="isTmwe && isNew" cols="12" sm="6">
          <CmAnagraficaAutocomplete
            v-model="ownerId"
            :label="t('email_templates.owner_select')"
            :hint="t('email_templates.owner_select_hint')"
          />
        </v-col>
        <v-col v-else-if="isTmwe" cols="12" sm="6">
          <v-text-field
            :model-value="ownerLabel"
            :label="t('email_templates.owner')"
            readonly
            :hint="t('email_templates.owner_readonly_hint')"
            persistent-hint
          />
        </v-col>

        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.descriz"
            :label="t('email_templates.descriz')"
            :hint="t('email_templates.descriz_hint')"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" sm="8">
          <v-text-field
            v-model="form.oggetto"
            :label="t('email_templates.oggetto')"
            :hint="t('email_templates.oggetto_hint')"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="form.mittente_msg"
            :label="t('email_templates.mittente')"
            :hint="t('email_templates.mittente_hint')"
            persistent-hint
          />
        </v-col>
      </v-row>
    </FormSection>

    <FormSection :title="t('email_templates.section_body')" :icon="mdiCodeTags">
      <v-tabs v-model="tab" density="compact" class="mb-3">
        <v-tab value="visual">{{ t("email_templates.tab_visual") }}</v-tab>
        <v-tab value="code">{{ t("email_templates.tab_code") }}</v-tab>
        <v-tab value="preview">{{ t("email_templates.tab_preview") }}</v-tab>
        <v-tab value="help">{{ t("email_templates.tab_help") }}</v-tab>
        <v-tab value="ai">{{ t("email_templates.tab_ai") }}</v-tab>
      </v-tabs>

      <!-- VISUAL -->
      <div v-show="tab === 'visual'">
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="t('email_templates.visual_hint')"
        />
        <HtmlRichEditor
          v-model="form.html"
          :tokens="editorTokens"
          :tokens-label="t('email_templates.tab_help')"
          :link-title="t('email_templates.visual_link')"
          :clear-title="t('email_templates.visual_clear')"
        />
      </div>

      <!-- CÓDIGO -->
      <div v-show="tab === 'code'">
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="t('email_templates.code_hint')"
        />
        <v-textarea
          v-model="form.html"
          :label="t('email_templates.html')"
          rows="18"
          class="et-code"
          spellcheck="false"
        />
      </div>

      <!-- PREVISUALIZACIÓN -->
      <div v-show="tab === 'preview'">
        <div class="d-flex align-center mb-2" style="gap: 12px">
          <v-btn
            size="small"
            variant="tonal"
            :loading="previewing"
            :prepend-icon="mdiEyeOutline"
            @click="runPreview"
          >
            {{ t("email_templates.refresh_preview") }}
          </v-btn>
          <v-chip v-if="preview" size="x-small" variant="tonal">
            {{
              preview.engine === "modern"
                ? t("email_templates.engine_modern")
                : t("email_templates.engine_legacy")
            }}
          </v-chip>
          <span class="text-caption">{{
            t("email_templates.preview_sample_note")
          }}</span>
        </div>

        <v-alert
          v-if="preview && !preview.success"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="preview.error"
        />

        <div v-if="preview?.subject" class="et-subject mb-2">
          <strong>{{ t("email_templates.oggetto") }}:</strong>
          {{ preview.subject }}
        </div>

        <!--
          iframe con sandbox: el cuerpo es HTML arbitrario escrito por un
          operador. Nunca v-html — un srcdoc aislado no puede ejecutar scripts
          ni tocar la SPA que lo contiene.
        -->
        <iframe
          v-if="preview"
          class="et-frame"
          sandbox=""
          :srcdoc="previewDocument"
          :title="t('email_templates.tab_preview')"
        />
      </div>

      <!-- AYUDA -->
      <div v-show="tab === 'help'">
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="t('email_templates.help_hint')"
        />
        <v-text-field
          v-model="tokenSearch"
          :prepend-inner-icon="mdiMagnify"
          :label="t('email_templates.search')"
          density="compact"
          hide-details
          clearable
          class="mb-2"
        />
        <v-table density="compact" class="cm-table-zebra">
          <thead>
            <tr>
              <th style="width: 230px">{{ t("email_templates.token") }}</th>
              <th>{{ t("email_templates.token_desc") }}</th>
              <th style="width: 80px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="tk in filteredTokens" :key="tk.token">
              <td>
                <code>{{ tk.token }}</code>
              </td>
              <td>
                {{ tk.desc }}
                <span v-if="tk.alias_of" class="text-caption d-block">
                  {{ t("email_templates.same_as", { token: tk.alias_of }) }}
                </span>
              </td>
              <td>
                <v-btn
                  size="x-small"
                  variant="text"
                  @click="insertToken(tk.token)"
                >
                  {{ t("email_templates.insert") }}
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <!-- AYUDA AUTOMÁTICA -->
      <div v-show="tab === 'ai'">
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="t('email_templates.ai_hint')"
        />

        <div class="d-flex flex-wrap align-center mb-3" style="gap: 8px">
          <v-btn
            size="small"
            variant="tonal"
            :loading="assisting === 'draft'"
            :disabled="!!assisting"
            @click="runAssist('draft')"
          >
            {{ t("email_templates.ai_draft") }}
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            :loading="assisting === 'translate'"
            :disabled="!!assisting || !form.html"
            @click="runAssist('translate')"
          >
            {{ t("email_templates.ai_translate") }}
          </v-btn>
          <v-select
            v-model="targetLingua"
            :items="LINGUE"
            :label="t('email_templates.ai_target')"
            density="compact"
            hide-details
            style="max-width: 120px"
          />
          <v-btn
            size="small"
            variant="tonal"
            :loading="assisting === 'explain'"
            :disabled="!!assisting || !form.html"
            @click="runAssist('explain')"
          >
            {{ t("email_templates.ai_explain") }}
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            :loading="assisting === 'fix'"
            :disabled="!!assisting || !form.html"
            @click="runAssist('fix')"
          >
            {{ t("email_templates.ai_fix") }}
          </v-btn>
        </div>

        <v-text-field
          v-model="instruction"
          :label="t('email_templates.ai_instruction')"
          :hint="t('email_templates.ai_instruction_hint')"
          persistent-hint
          density="compact"
          class="mb-3"
        />

        <v-alert
          v-if="assist && !assist.success"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="assist.error"
        />

        <v-card v-if="assist?.success" variant="outlined" class="pa-3">
          <div class="text-subtitle-2 mb-2">
            {{ t("email_templates.ai_suggestion") }}
          </div>

          <v-alert
            v-if="!assist.valid"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            :text="t('email_templates.ai_invalid')"
          />

          <p v-if="assist.explanation" class="text-body-2 mb-2">
            {{ assist.explanation }}
          </p>

          <template v-if="assist.html">
            <div v-if="assist.oggetto" class="et-subject mb-2">
              <strong>{{ t("email_templates.oggetto") }}:</strong>
              {{ assist.oggetto }}
            </div>
            <pre class="et-suggestion">{{ assist.html }}</pre>
            <div class="d-flex" style="gap: 8px">
              <v-btn
                size="small"
                variant="flat"
                class="cm-btn-accent"
                @click="applySuggestion"
              >
                {{ t("email_templates.ai_apply") }}
              </v-btn>
              <v-btn size="small" variant="text" @click="assist = null">
                {{ t("email_templates.ai_discard") }}
              </v-btn>
            </div>
          </template>
        </v-card>
      </div>
    </FormSection>

    <!-- PROBLEMAS DETECTADOS -->
    <FormSection
      v-if="issues.length"
      :title="t('email_templates.section_issues')"
      :icon="mdiAlertCircleOutline"
      last
    >
      <v-list density="compact">
        <v-list-item v-for="(i, idx) in issues" :key="idx">
          <template #prepend>
            <v-chip
              size="x-small"
              :color="
                i.severity === 'error'
                  ? 'error'
                  : i.severity === 'warning'
                    ? 'warning'
                    : undefined
              "
              variant="tonal"
            >
              {{ t(`email_templates.sev_${i.severity}`) }}
            </v-chip>
          </template>
          <v-list-item-title class="text-body-2 ms-2">{{
            i.message
          }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </FormSection>

    <template #actions>
      <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
      <v-btn
        v-if="!isBaseReadOnly"
        class="cm-btn-accent"
        variant="flat"
        :loading="saving"
        :disabled="!canSave"
        :prepend-icon="mdiContentSave"
        @click="save"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  mdiEmailEditOutline,
  mdiTagOutline,
  mdiCodeTags,
  mdiEyeOutline,
  mdiMagnify,
  mdiContentSave,
  mdiAlertCircleOutline,
} from "@mdi/js";
import AppDialog from "@shared/ui/AppDialog.vue";
import FormSection from "@shared/ui/FormSection.vue";
import HtmlRichEditor from "@shared/ui/HtmlRichEditor.vue";
import CmAnagraficaAutocomplete from "./CmAnagraficaAutocomplete.vue";
import { useIsTmwe } from "../useIsTmwe";
import { anagraficaService } from "@shared/anagrafiche/services/anagrafica.service";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import {
  emailTemplatesService,
  type AssistAction,
  type AssistResult,
  type EmailTemplatePayload,
  type TemplateIssue,
  type TemplatePreview,
  type TemplateToken,
} from "../services/emailTemplates.service";

const props = defineProps<{
  modelValue: boolean;
  templateId: number | null;
  /**
   * Id de la plantilla de la que copiar el contenido al CREAR. Con esto el
   * editor se abre relleno pero sin templateId, así que guardar crea una
   * plantilla nueva en vez de sobrescribir el original.
   */
  cloneFrom?: number | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const { t } = useI18n();
const toast = useToastStore();

/** El ENUM de la columna `modelli.lingua`. */
const LINGUE = ["ITA", "ENG", "SPA", "FRA"];

const tab = ref<"visual" | "code" | "preview" | "help" | "ai">("visual");
const saving = ref(false);
const previewing = ref(false);
const loadError = ref<string | null>(null);
const tokenSearch = ref("");

const isTmwe = computed(() => useIsTmwe());

/**
 * Dueño de la plantilla.
 *   null → BASE (id_anagrafica = 1): la que se usa cuando el partner no tiene
 *          la suya.
 *   id   → especialización de ese partner.
 * Solo TMWE lo elige, y solo al crear.
 */
const ownerId = ref<number | null>(null);
const ownerLabel = ref("");

/** Anagrafica dueña de las plantillas base (espejo del backend). */
const BASE_ANAGRAFICA_ID = 1;

/** id_anagrafica de la plantilla cargada; null al crear. */
const loadedOwner = ref<number | null>(null);

/**
 * Un partner abre una plantilla BASE en modo consulta: puede leerla y
 * duplicarla, pero no guardar cambios (el backend lo rechazaría igualmente).
 */
const isBaseReadOnly = computed(
  () =>
    !isTmwe.value && !isNew.value && loadedOwner.value === BASE_ANAGRAFICA_ID,
);

/** Acción de IA en curso, o null. Sirve de loading por botón. */
const assisting = ref<AssistAction | null>(null);
const assist = ref<AssistResult | null>(null);
const instruction = ref("");
const targetLingua = ref("ENG");

const preview = ref<TemplatePreview | null>(null);
const issues = ref<TemplateIssue[]>([]);
const available = ref<TemplateToken[]>([]);

const form = ref<EmailTemplatePayload & { html: string }>({
  tipo: "",
  lingua: "ITA",
  descriz: "",
  oggetto: "",
  html: "",
  mittente_msg: "",
  mail: "S",
});

/**
 * Copia del contenido tal y como llegó del servidor. Sirve para garantizar
 * que abrir y cerrar sin editar no produce ningún cambio: el editor NUNCA
 * debe reescribir un HTML que el usuario no ha tocado (285 de las 336
 * plantillas son HTML de email con tablas anidadas y estilos inline).
 */
const pristine = ref<string | null>(null);

const isNew = computed(() => props.templateId === null);

const canSave = computed(
  () => form.value.tipo.trim() !== "" && form.value.lingua.trim() !== "",
);

/**
 * Marcadores para el desplegable del editor visual. Mismo catálogo que la
 * pestaña de ayuda, proyectado a lo que necesita HtmlRichEditor.
 */
const editorTokens = computed(() =>
  available.value.map((tk) => ({ token: tk.token, desc: tk.desc })),
);

const filteredTokens = computed(() => {
  const q = tokenSearch.value.trim().toLowerCase();
  if (!q) return available.value;
  return available.value.filter(
    (tk) =>
      tk.token.toLowerCase().includes(q) || tk.desc.toLowerCase().includes(q),
  );
});

/**
 * Documento del iframe. Las plantillas son FRAGMENTOS (331 de 336), no
 * documentos completos, así que se envuelven en un shell mínimo con charset
 * para que los acentos se vean bien.
 */
const previewDocument = computed(() => {
  const body = preview.value?.body ?? "";
  if (/<html[\s>]/i.test(body)) return body;
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<style>body{margin:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px}</style>` +
    `</head><body>${body}</body></html>`
  );
});

function reset(): void {
  form.value = {
    tipo: "",
    lingua: "ITA",
    descriz: "",
    oggetto: "",
    html: "",
    mittente_msg: "",
    mail: "S",
  };
  pristine.value = null;
  preview.value = null;
  issues.value = [];
  available.value = [];
  loadError.value = null;
  tab.value = "visual";
  assist.value = null;
  assisting.value = null;
  instruction.value = "";
  targetLingua.value = "ENG";
  ownerId.value = null;
  ownerLabel.value = "";
  loadedOwner.value = null;
}

/**
 * Carga una plantilla en el formulario.
 *
 * @param id      plantilla de origen
 * @param asClone true = DUPLICAR: se copia el contenido pero el resultado se
 *                trata como nueva (tipo/idioma editables, dueño elegible), de
 *                modo que guardar CREA en vez de sobrescribir el original.
 */
async function loadTemplate(id: number, asClone = false): Promise<void> {
  loadError.value = null;
  try {
    const d = await emailTemplatesService.getById(id);
    form.value = {
      tipo: d.tipo ?? "",
      lingua: d.lingua ?? "ITA",
      descriz: d.descriz ?? "",
      oggetto: d.oggetto ?? "",
      html: d.html ?? "",
      mittente_msg: d.mittente_msg ?? "",
      mail: d.mail ?? "S",
    };
    pristine.value = d.html ?? "";

    if (asClone) {
      // La descripción avisa de la procedencia; el dueño queda a elección
      // (el caso típico es clonar una BASE para especializarla a un partner).
      form.value.descriz = d.descriz ? `${d.descriz} (copia)` : "";
      ownerId.value = null;
      ownerLabel.value = "";
      await runPreview();
      return;
    }

    // Dueño, solo informativo al editar.
    const owner = Number(d.id_anagrafica ?? 0);
    loadedOwner.value = owner;
    ownerId.value = owner > 1 ? owner : null;
    ownerLabel.value =
      owner === 1 ? t("email_templates.owner_base") : `#${owner}`;
    if (owner > 1) {
      try {
        const a = await anagraficaService.getById(owner);
        if (a?.rag_soc) ownerLabel.value = a.rag_soc;
      } catch {
        /* se queda el #id */
      }
    }

    await runPreview();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

async function runPreview(): Promise<void> {
  previewing.value = true;
  try {
    const p = await emailTemplatesService.preview({
      html: form.value.html,
      oggetto: form.value.oggetto,
      tipo: form.value.tipo,
    });
    preview.value = p;
    issues.value = p.issues ?? [];
    available.value = p.available ?? [];
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    previewing.value = false;
  }
}

function insertToken(token: string): void {
  form.value.html = `${form.value.html}${token}`;
  tab.value = "code";
}

/**
 * Pide una sugerencia. La IA NUNCA escribe en el formulario: el resultado se
 * muestra aparte y solo se aplica si el usuario pulsa Aplicar.
 */
async function runAssist(action: AssistAction): Promise<void> {
  assisting.value = action;
  assist.value = null;
  try {
    assist.value = await emailTemplatesService.assist({
      action,
      html: form.value.html,
      oggetto: form.value.oggetto,
      tipo: form.value.tipo,
      lingua: form.value.lingua,
      target_lingua: targetLingua.value,
      instruction: instruction.value,
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    assisting.value = null;
  }
}

/** Vuelca la sugerencia en el formulario y revalida con datos de ejemplo. */
function applySuggestion(): void {
  const s = assist.value;
  if (!s?.html) return;

  form.value.html = s.html;
  if (s.oggetto) form.value.oggetto = s.oggetto;

  assist.value = null;
  tab.value = "code";
  void runPreview();
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    // Validar antes de guardar: el autor ve los problemas aunque no haya
    // abierto la pestaña de previsualización.
    await runPreview();

    const payload: EmailTemplatePayload = {
      tipo: form.value.tipo,
      lingua: form.value.lingua,
      descriz: form.value.descriz,
      oggetto: form.value.oggetto,
      html: form.value.html,
      mittente_msg: form.value.mittente_msg,
      mail: form.value.mail,
    };

    if (isNew.value) {
      // Solo TMWE puede fijar el dueño. Sin selección → 1 (plantilla base).
      // Para un partner el servidor lo ignora y asigna el suyo.
      if (isTmwe.value) {
        payload.id_anagrafica = ownerId.value ?? 1;
      }
      await emailTemplatesService.create(payload);
    } else {
      // En update NO se envía id_anagrafica: una plantilla no cambia de dueño.
      await emailTemplatesService.update(props.templateId as number, payload);
    }

    toast.success(t("email_templates.saved"));
    emit("saved");
    close();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

watch(
  () => [props.modelValue, props.templateId, props.cloneFrom] as const,
  ([open, id, clone]) => {
    if (!open) return;
    reset();
    if (id === null && clone) {
      void loadTemplate(clone, true);
      return;
    }
    // Al EDITAR, loadTemplate() acaba llamando a runPreview(), que es quien
    // trae el catálogo de marcadores. Al CREAR no había nada que cargar, así
    // que `available` quedaba vacío y el desplegable de Marcadores del editor
    // visual salía sin opciones.
    if (id !== null) {
      void loadTemplate(id);
    } else {
      void runPreview();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.et-code :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}

.et-frame {
  width: 100%;
  height: 420px;
  border: 1px solid rgb(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
  background: #fff;
}

.et-subject {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.et-suggestion {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
