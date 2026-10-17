<template>
  <div class="scope-picker">
    <p class="text-body-2 mb-3">
      {{ t("invoicing.fiscal.reglas.wizard.ambito_intro") }}
    </p>
    <div class="scope-grid">
      <v-autocomplete
        :model-value="modelValue.iso_paese || null"
        :items="paises"
        :label="t('invoicing.fiscal.reglas.wizard.pais')"
        :hint="t('invoicing.fiscal.reglas.wizard.pais_hint')"
        persistent-hint
        :error-messages="errors.iso_paese ? [errors.iso_paese] : []"
        :disabled="readonly"
        clearable
        density="comfortable"
        variant="outlined"
        @update:model-value="
          (v: string | null) => patch({ iso_paese: v ?? '' })
        "
      />

      <v-autocomplete
        :model-value="modelValue.id_partner || null"
        :items="mergedPartners"
        :loading="searching.partner"
        item-title="label"
        item-value="id"
        :label="t('invoicing.fiscal.reglas.wizard.partner')"
        :hint="t('invoicing.fiscal.reglas.wizard.partner_hint')"
        persistent-hint
        :error-messages="errors.id_partner ? [errors.id_partner] : []"
        :disabled="readonly"
        no-filter
        clearable
        density="comfortable"
        variant="outlined"
        @update:search="(s: string) => onSearch('partner', s)"
        @update:model-value="(v: number | null) => pick('partner', v)"
      >
        <template #no-data>
          <div class="px-3 py-2 text-medium-emphasis text-body-2">
            {{ searching.partner ? t("common.loading") : "—" }}
          </div>
        </template>
      </v-autocomplete>

      <v-autocomplete
        :model-value="modelValue.id_cliente || null"
        :items="mergedClientes"
        :loading="searching.cliente"
        item-title="label"
        item-value="id"
        :label="t('invoicing.fiscal.reglas.wizard.cliente')"
        :hint="t('invoicing.fiscal.reglas.wizard.cliente_hint')"
        persistent-hint
        :error-messages="errors.id_cliente ? [errors.id_cliente] : []"
        :disabled="readonly"
        no-filter
        clearable
        density="comfortable"
        variant="outlined"
        @update:search="(s: string) => onSearch('cliente', s)"
        @update:model-value="(v: number | null) => pick('cliente', v)"
      >
        <template #no-data>
          <div class="px-3 py-2 text-medium-emphasis text-body-2">
            {{ searching.cliente ? t("common.loading") : "—" }}
          </div>
        </template>
      </v-autocomplete>

      <v-text-field
        :model-value="modelValue.id_servizio || ''"
        :label="t('invoicing.fiscal.reglas.wizard.servicio')"
        :hint="t('invoicing.fiscal.reglas.wizard.servicio_hint')"
        persistent-hint
        inputmode="numeric"
        :error-messages="errors.id_servizio ? [errors.id_servizio] : []"
        :disabled="readonly"
        clearable
        density="comfortable"
        variant="outlined"
        @update:model-value="
          (v: string | null) =>
            patch({ id_servizio: Math.max(0, parseInt(v ?? '', 10) || 0) })
        "
      />
    </div>

    <v-alert type="info" variant="tonal" density="compact" class="mt-2">
      {{ summary }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
/**
 * ScopePicker — paso «Ámbito» del asistente de reglas: a quién se aplica la
 * regla. Cada campo vacío significa «todos»; cuanto más concreto el ámbito,
 * más específica es la regla (cliente > servicio > partner > país > todos) y
 * gana en caso de conflicto con política «fijar».
 *   - país: desplegable con búsqueda (códigos ISO; vacío = todos);
 *   - partner y cliente: buscadores remotos por nombre o NIF (si la búsqueda
 *     no está disponible se muestra el id guardado);
 *   - servicio: id numérico (no hay catálogo de servicios en esta pantalla).
 *
 * Props: `modelValue` ({iso_paese, id_partner, id_servizio, id_cliente}),
 * `errors` por campo del 422, `readonly`.
 * Emits: `update:modelValue` (copia con el cambio).
 *
 * Ejemplo:
 *   <ScopePicker v-model="ambito" :errors="fieldErrs" />
 */
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  anagraficaService,
  type AnagraficaLite,
} from "../../../services/anagrafica.service";
import { PAISES, ambitoText } from "./reglasModel";

interface Scope {
  iso_paese: string;
  id_partner: number;
  id_servizio: number;
  id_cliente: number;
}

interface Item {
  id: number;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: Scope;
    errors?: Record<string, string>;
    readonly?: boolean;
  }>(),
  { errors: () => ({}), readonly: false },
);

const emit = defineEmits<{ (e: "update:modelValue", v: Scope): void }>();

const { t } = useI18n();
const paises: string[] = [...PAISES];
const searching = reactive({ partner: false, cliente: false });
const found = reactive<{ partner: Item[]; cliente: Item[] }>({
  partner: [],
  cliente: [],
});
const selected = reactive<{ partner: Item | null; cliente: Item | null }>({
  partner: null,
  cliente: null,
});
const timers: Record<string, ReturnType<typeof setTimeout> | null> = {};

function label(a: AnagraficaLite): string {
  return `${a.rag_soc} (#${String(a.id)})`;
}

/** Items del desplegable = resultados de la búsqueda + el elegido (así no se pierde el nombre). */
function merged(kind: "partner" | "cliente", id: number): Item[] {
  const items = [...found[kind]];
  const sel = selected[kind];
  if (sel && !items.some((i) => i.id === sel.id)) items.unshift(sel);
  if (id > 0 && !items.some((i) => i.id === id))
    items.unshift({ id, label: `#${id}` });
  return items;
}

const mergedPartners = computed(() =>
  merged("partner", props.modelValue.id_partner),
);
const mergedClientes = computed(() =>
  merged("cliente", props.modelValue.id_cliente),
);

const summary = computed(() => {
  const txt = ambitoText(props.modelValue, "");
  return txt
    ? t("invoicing.fiscal.reglas.wizard.ambito_resumen", { ambito: txt })
    : t("invoicing.fiscal.reglas.wizard.ambito_todos");
});

function patch(p: Partial<Scope>): void {
  emit("update:modelValue", { ...props.modelValue, ...p });
}

function pick(kind: "partner" | "cliente", id: number | null): void {
  selected[kind] = id
    ? (merged(kind, id).find((i) => i.id === id) ?? null)
    : null;
  patch(kind === "partner" ? { id_partner: id ?? 0 } : { id_cliente: id ?? 0 });
}

/** Búsqueda remota con debounce (el autocompletado es de un solo sentido, regla del proyecto). */
function onSearch(kind: "partner" | "cliente", text: string): void {
  const t0 = timers[kind];
  if (t0) clearTimeout(t0);
  timers[kind] = setTimeout(async () => {
    searching[kind] = true;
    try {
      const rows =
        kind === "partner"
          ? await anagraficaService.searchPartners(text ?? "")
          : await anagraficaService.search(text ?? "");
      found[kind] = rows.map((a) => ({ id: Number(a.id), label: label(a) }));
    } catch {
      found[kind] = [];
    } finally {
      searching[kind] = false;
    }
  }, 300);
}

// Al editar una regla, resuelve el nombre de los ids guardados.
watch(
  () => [props.modelValue.id_partner, props.modelValue.id_cliente],
  async ([p, c]) => {
    for (const [kind, id] of [
      ["partner", p],
      ["cliente", c],
    ] as const) {
      if (id && !selected[kind]) {
        const a = await anagraficaService.getById(id);
        if (a) selected[kind] = { id, label: label(a) };
      }
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 4px 16px;
}
</style>
