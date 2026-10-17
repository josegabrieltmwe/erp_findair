<template>
  <div class="action-params">
    <div v-if="fields.length === 0" class="text-body-2 text-medium-emphasis">
      {{ t("invoicing.fiscal.reglas.wizard.sin_parametros") }}
    </div>

    <div class="params-grid">
      <template v-for="f in normales" :key="f.key">
        <v-select
          v-if="f.def.valores && f.def.valores.length"
          :model-value="textOf(f.key) || null"
          :items="f.def.valores"
          :label="labelOf(f)"
          :hint="f.def.ayuda"
          :persistent-hint="!!f.def.ayuda"
          :error-messages="errors[f.key] ? [errors[f.key]!] : []"
          :disabled="readonly"
          density="comfortable"
          variant="outlined"
          clearable
          @update:model-value="(v: unknown) => set(f.key, v)"
        />
        <v-switch
          v-else-if="f.def.tipo === 'booleano'"
          :model-value="!!modelValue[f.key]"
          :label="labelOf(f)"
          :error-messages="errors[f.key] ? [errors[f.key]!] : []"
          :disabled="readonly"
          color="primary"
          density="comfortable"
          hide-details="auto"
          @update:model-value="(v: unknown) => set(f.key, !!v)"
        />
        <v-text-field
          v-else
          :model-value="valueOf(f.key)"
          :label="labelOf(f)"
          :type="f.def.tipo === 'fecha' ? 'date' : 'text'"
          :inputmode="inputMode(f)"
          :hint="hintOf(f)"
          persistent-hint
          :error-messages="errors[f.key] ? [errors[f.key]!] : []"
          :disabled="readonly"
          :maxlength="f.def.tipo === 'pais' ? 2 : undefined"
          density="comfortable"
          variant="outlined"
          @update:model-value="(v: unknown) => set(f.key, v)"
        />
      </template>
    </div>

    <!-- Textos por idioma (MENCION): una pestaña por idioma -->
    <div v-if="textos.length" class="mt-2">
      <div class="text-caption text-medium-emphasis mb-1">
        {{ t("invoicing.fiscal.reglas.wizard.textos_idiomas") }}
      </div>
      <v-tabs
        v-model="langTab"
        density="compact"
        color="primary"
        :aria-label="t('invoicing.fiscal.reglas.wizard.textos_idiomas')"
      >
        <v-tab v-for="g in textos" :key="g.lang" :value="g.lang">
          {{ g.lang.toUpperCase() }}
          <v-icon
            v-if="filled(g.field.key)"
            icon="mdi-check-circle"
            size="14"
            color="success"
            class="ml-1"
          />
          <v-icon
            v-if="errors[g.field.key]"
            icon="mdi-alert-circle"
            size="14"
            color="error"
            class="ml-1"
          />
        </v-tab>
      </v-tabs>
      <v-window v-model="langTab" class="pt-3">
        <v-window-item v-for="g in textos" :key="g.lang" :value="g.lang">
          <v-textarea
            :model-value="textOf(g.field.key)"
            :label="labelOf(g.field)"
            :error-messages="errors[g.field.key] ? [errors[g.field.key]!] : []"
            :disabled="readonly"
            :counter="MAX_CAUSALE"
            rows="3"
            auto-grow
            density="comfortable"
            variant="outlined"
            @update:model-value="(v: unknown) => set(g.field.key, v)"
          />
        </v-window-item>
      </v-window>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ActionParamsForm — formulario de los parámetros de una acción, GENERADO
 * del esquema del catálogo (REGLAS_DINAMICAS §3.4): no conoce ninguna acción
 * concreta.
 *   - `valores` (lista cerrada) → desplegable (RETENCION.tipo, causale…);
 *   - tipo booleano → interruptor; fecha → selector de fecha;
 *   - entero/decimal → campo numérico (admite coma); país → 2 letras;
 *   - texto → campo de texto; los parámetros `texto_es…texto_nl` (MENCION)
 *     se agrupan en pestañas por idioma.
 * Los obligatorios llevan «*» y van primero. Los errores del backend
 * (`parametros.<clave>` en un 422) se pasan en `errors` por parámetro.
 *
 * Props: `accion` (acción del catálogo o null), `modelValue` (valores por
 * parámetro), `errors` (mensajes por parámetro), `readonly`.
 * Emits: `update:modelValue` (copia con el cambio).
 *
 * Ejemplo:
 *   <ActionParamsForm v-model="params" :accion="accion" :errors="errs" />
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ReglaAccion } from "../../../services/fiscReglas.service";
import { paramFields, splitTextos, type ParamField } from "./reglasModel";

/** Longitud máxima de una Causale de la FatturaPA (Fisc_Action_Mencion::MAX_CAUSALE). */
const MAX_CAUSALE = 200;

const props = withDefaults(
  defineProps<{
    accion: ReglaAccion | null;
    modelValue: Record<string, unknown>;
    errors?: Record<string, string>;
    readonly?: boolean;
  }>(),
  { errors: () => ({}), readonly: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: Record<string, unknown>): void;
}>();

const { t, locale } = useI18n();

const fields = computed(() => paramFields(props.accion, String(locale.value)));
const split = computed(() => splitTextos(fields.value));
const normales = computed(() => split.value.normales);
const textos = computed(() => split.value.textos);
const langTab = ref<string>("es");

watch(
  textos,
  (list) => {
    if (list.length && !list.some((g) => g.lang === langTab.value)) {
      langTab.value = list[0]!.lang;
    }
  },
  { immediate: true },
);

function labelOf(f: ParamField): string {
  return f.def.obligatorio ? `${f.label} *` : f.label;
}

function hintOf(f: ParamField): string {
  if (f.def.ayuda) return f.def.ayuda;
  if (f.def.defecto !== undefined && f.def.defecto !== "")
    return t("invoicing.fiscal.reglas.wizard.defecto", {
      v: String(f.def.defecto),
    });
  return "";
}

function inputMode(f: ParamField): "decimal" | "numeric" | "text" {
  if (f.def.tipo === "decimal") return "decimal";
  if (f.def.tipo === "entero") return "numeric";
  return "text";
}

/** Valor de un parámetro para los campos de texto, números y desplegables (null si está vacío). */
function valueOf(key: string): string | number | null {
  const v = props.modelValue[key];
  return typeof v === "string" || typeof v === "number" ? v : null;
}

/** Valor de un parámetro de texto largo. */
function textOf(key: string): string {
  const v = props.modelValue[key];
  return typeof v === "string" ? v : "";
}

function filled(key: string): boolean {
  const v = props.modelValue[key];
  return typeof v === "string" && v.trim() !== "";
}

function set(key: string, value: unknown): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value ?? "" });
}
</script>

<style scoped>
.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 4px 16px;
}
</style>
