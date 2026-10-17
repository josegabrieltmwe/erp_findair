<template>
  <div
    class="cond-row"
    role="group"
    :aria-label="t('invoicing.fiscal.cond.row')"
  >
    <v-select
      :model-value="selectValue"
      :items="options"
      item-title="title"
      item-value="value"
      :label="t('invoicing.fiscal.cond.dato')"
      :readonly="readonly"
      :error="hasError"
      density="compact"
      hide-details
      class="cond-dato"
      @update:model-value="onDato"
    />
    <v-text-field
      v-if="freeKind === 'param'"
      :model-value="free"
      :label="t('invoicing.fiscal.cond.param_key')"
      :readonly="readonly"
      :error="hasError"
      density="compact"
      hide-details
      class="cond-free cond-mono"
      @update:model-value="(v: string) => onFree((v ?? '').toUpperCase())"
    />
    <v-select
      v-else-if="freeKind === 'natura'"
      :model-value="free"
      :items="NATURAS"
      :label="t('invoicing.fiscal.cond.natura')"
      :readonly="readonly"
      :error="hasError"
      density="compact"
      hide-details
      class="cond-free"
      @update:model-value="onFree"
    />
    <v-select
      :model-value="modelValue.op"
      :items="opItems"
      item-title="title"
      item-value="value"
      :label="t('invoicing.fiscal.cond.operador')"
      :readonly="readonly"
      density="compact"
      hide-details
      class="cond-op"
      @update:model-value="onOp"
    />

    <div class="cond-valor">
      <template v-if="sinValor" />
      <!-- booleano -->
      <v-select
        v-else-if="tipo === 'booleano'"
        :model-value="modelValue.valor === true"
        :items="boolItems"
        item-title="title"
        item-value="value"
        :label="t('invoicing.fiscal.cond.valor')"
        :readonly="readonly"
        density="compact"
        hide-details
        @update:model-value="(v: boolean) => setValor(v)"
      />
      <!-- lista de países (en / no_en) -->
      <v-autocomplete
        v-else-if="isList && tipo === 'pais'"
        :model-value="listStrings"
        :items="countryItems"
        item-title="title"
        item-value="value"
        :label="t('invoicing.fiscal.cond.valores')"
        :readonly="readonly"
        :error="hasError"
        multiple
        chips
        closable-chips
        density="compact"
        hide-details
        @update:model-value="
          (v: readonly string[]) =>
            setValor((v ?? []).map((x) => x.toUpperCase()))
        "
      />
      <!-- lista de valores libres (en / no_en) -->
      <v-combobox
        v-else-if="isList"
        :model-value="listStrings"
        :items="suggestions"
        :label="t('invoicing.fiscal.cond.valores')"
        :hint="t('invoicing.fiscal.cond.valores_hint')"
        persistent-hint
        :readonly="readonly"
        :error="hasError"
        multiple
        chips
        closable-chips
        density="compact"
        @update:model-value="(v: readonly string[]) => setValor(toTyped(v))"
      />
      <!-- entre: dos valores -->
      <div v-else-if="op === 'entre'" class="cond-between">
        <v-text-field
          :model-value="pairValue(0)"
          :type="inputType"
          :label="t('invoicing.fiscal.cond.desde')"
          :readonly="readonly"
          :error="hasError"
          density="compact"
          hide-details
          @update:model-value="(v: string) => setPair(0, v)"
        />
        <v-text-field
          :model-value="pairValue(1)"
          :type="inputType"
          :label="t('invoicing.fiscal.cond.hasta')"
          :readonly="readonly"
          :error="hasError"
          density="compact"
          hide-details
          @update:model-value="(v: string) => setPair(1, v)"
        />
      </div>
      <!-- país único -->
      <CmCountrySelect
        v-else-if="tipo === 'pais'"
        :model-value="scalarText"
        :label="t('invoicing.fiscal.cond.valor')"
        :clearable="false"
        :disabled="readonly"
        @update:model-value="(v: string | null) => setValor(v ?? '')"
      />
      <!-- texto, con los valores conocidos como sugerencia -->
      <v-combobox
        v-else-if="tipo === 'texto' || tipo === 'lista'"
        :model-value="scalarText"
        :items="suggestions"
        :label="t('invoicing.fiscal.cond.valor')"
        :readonly="readonly"
        :error="hasError"
        density="compact"
        hide-details
        @update:model-value="(v: unknown) => setValor(String(v ?? ''))"
      />
      <!-- entero, decimal, fecha -->
      <v-text-field
        v-else
        :model-value="scalarText"
        :type="inputType"
        :step="tipo === 'decimal' ? 'any' : undefined"
        :label="t('invoicing.fiscal.cond.valor')"
        :readonly="readonly"
        :error="hasError"
        density="compact"
        hide-details
        @update:model-value="(v: string) => setValor(parseScalar(v))"
      />
    </div>

    <v-btn
      v-if="!readonly"
      icon="mdi-close"
      size="x-small"
      variant="text"
      :title="t('invoicing.fiscal.cond.remove_row')"
      :aria-label="t('invoicing.fiscal.cond.remove_row')"
      @click="emit('remove')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ConditionLeafRow — una fila «dato · operador · valor» del constructor de
 * condiciones (ver ConditionBuilder.vue). Muestra el control de valor que
 * corresponde al tipo del dato y al operador: texto, entero, decimal,
 * booleano, fecha, país (selector) o lista con chips (en/no_en), o dos campos
 * para «entre».
 *
 * Props:
 *   - modelValue: la fila (CondLeaf). No se muta: cada cambio sale por
 *     `update:modelValue` con una fila nueva.
 *   - catalogo: catálogo de `op=catalogo` (tipos y operadores).
 *   - options: datos ofrecidos en la etapa de la regla (datoOptions()).
 *   - hasError: marca los campos en rojo (el texto del error lo pinta el padre).
 *   - readonly: solo lectura.
 * Emits:
 *   - update:modelValue(CondLeaf): fila modificada.
 *   - remove(): el usuario quiere borrar la fila.
 *
 * Ejemplo:
 *   <ConditionLeafRow v-model="leaf" :catalogo="cat" :options="opts" @remove="drop" />
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import { paesiService } from "@shared/anagrafiche/services/paesi.service";
import type {
  FiscCatalogo,
  FiscTipoDato,
} from "../../services/fiscConfig.service";
import {
  NATURAS,
  OPS_SIN_VALOR,
  composeDato,
  datoFreePart,
  datoSelectValue,
  defaultValue,
  findDato,
  type CondLeaf,
  type DatoOption,
} from "./conditionModel";

const props = defineProps<{
  modelValue: CondLeaf;
  catalogo: FiscCatalogo;
  options: DatoOption[];
  hasError?: boolean;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: CondLeaf): void;
  (e: "remove"): void;
}>();

const { t } = useI18n();

const SUGGESTIONS: Record<string, string[]> = {
  "expedicion.tipo": ["EXPRESS", "CARGO"],
  "expedicion.fase": ["PRIMERA", "POST"],
};

const def = computed(() => findDato(props.modelValue.dato, props.catalogo));
const tipo = computed<FiscTipoDato>(() => def.value?.tipo ?? "texto");
const op = computed(() => props.modelValue.op);
const sinValor = computed(() => OPS_SIN_VALOR.includes(op.value));
const isList = computed(() => op.value === "en" || op.value === "no_en");
const selectValue = computed(() => datoSelectValue(props.modelValue.dato));
const free = computed(() => datoFreePart(props.modelValue.dato));
const freeKind = computed(() =>
  selectValue.value === "param.*"
    ? "param"
    : selectValue.value === "factura.total_por_natura[*]"
      ? "natura"
      : "",
);
const suggestions = computed(() => SUGGESTIONS[props.modelValue.dato] ?? []);
const inputType = computed(() =>
  tipo.value === "fecha" ? "date" : tipo.value === "texto" ? "text" : "number",
);

/** Operadores del dato; las comparaciones se muestran con su símbolo. */
const opItems = computed(() => {
  const symbols: Record<string, string> = {
    ">": ">",
    ">=": "≥",
    "<": "<",
    "<=": "≤",
  };
  return (def.value?.operadores ?? [op.value]).map((o) => ({
    value: o,
    title: symbols[o] ?? t(`invoicing.fiscal.cond.op.${o}`),
  }));
});

const boolItems = computed(() => [
  { value: true, title: t("invoicing.fiscal.cond.yes") },
  { value: false, title: t("invoicing.fiscal.cond.no") },
]);

const listValue = computed<Array<string | number>>(() =>
  Array.isArray(props.modelValue.valor)
    ? (props.modelValue.valor as Array<string | number>)
    : [],
);

const listStrings = computed(() => listValue.value.map((v) => String(v)));

const countries = ref<Array<{ value: string; title: string }>>([]);
const countryItems = computed(() => {
  const known = new Set(countries.value.map((c) => c.value));
  const extra = listValue.value
    .filter((v) => !known.has(String(v)))
    .map((v) => ({ value: String(v), title: String(v) }));
  return [...extra, ...countries.value];
});

onMounted(async () => {
  if (!props.options.some((o) => o.dato.tipo === "pais")) return;
  try {
    const list = await paesiService.list();
    countries.value = list.map((c) => {
      const iso = String(c.ISO ?? "").toUpperCase();
      return { value: iso, title: `${iso} — ${String(c.nome ?? "")}` };
    });
  } catch {
    /* sin catálogo de países el campo sigue editable con los valores actuales */
  }
});

const scalarText = computed(() => {
  const v = props.modelValue.valor;
  return v === null || v === undefined || Array.isArray(v) ? "" : String(v);
});

function pairValue(i: number): string {
  const v = props.modelValue.valor;
  if (!Array.isArray(v) || v[i] === null || v[i] === undefined) return "";
  return String(v[i]);
}

function update(patch: Partial<CondLeaf>): void {
  emit("update:modelValue", { ...props.modelValue, ...patch });
}

function setValor(valor: unknown): void {
  update({ valor });
}

/** Convierte el texto de un campo al tipo del dato (null si está vacío). */
function parseScalar(v: unknown): unknown {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (tipo.value === "entero" || tipo.value === "decimal") {
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
  }
  return s;
}

function toTyped(list: readonly unknown[]): unknown[] {
  return (list ?? []).map((x) => parseScalar(x)).filter((x) => x !== null);
}

function setPair(i: number, v: string): void {
  const cur = Array.isArray(props.modelValue.valor)
    ? [...props.modelValue.valor]
    : [null, null];
  cur[i] = parseScalar(v);
  setValor(cur);
}

function onDato(select: string): void {
  const opt = props.options.find((o) => o.value === select);
  if (!opt) return;
  const ops = opt.dato.operadores;
  const keepOp = ops.includes(op.value) && opt.dato.tipo === tipo.value;
  const nextOp = keepOp ? op.value : (ops[0] ?? "es");
  update({
    dato: composeDato(select, ""),
    op: nextOp,
    valor: keepOp
      ? props.modelValue.valor
      : defaultValue(opt.dato.tipo, nextOp),
  });
}

function onFree(v: string): void {
  update({ dato: composeDato(selectValue.value, v ?? "") });
}

function onOp(next: string): void {
  update({ op: next, valor: defaultValue(tipo.value, next) });
}
</script>

<style scoped>
.cond-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
}

.cond-dato {
  flex: 2 1 220px;
}

.cond-free {
  flex: 1 1 140px;
}

.cond-op {
  flex: 0 1 150px;
  min-width: 110px;
}

.cond-valor {
  flex: 3 1 240px;
  min-width: 160px;
}

.cond-between {
  display: flex;
  gap: 8px;
}

.cond-mono :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
