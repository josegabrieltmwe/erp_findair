<template>
  <v-select
    v-if="field.type === 'enum' || field.type === 'sn'"
    :model-value="modelValue"
    :items="enumItems"
    item-title="title"
    item-value="value"
    :label="label"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    density="compact"
    @update:model-value="emitValue"
  />
  <v-select
    v-else-if="field.type === 'voce'"
    :model-value="modelValue === '' ? null : Number(modelValue)"
    :items="voceItems"
    item-title="title"
    item-value="value"
    :label="label"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    density="compact"
    @update:model-value="emitValue"
  />
  <v-select
    v-else-if="field.type === 'intermediario'"
    :model-value="modelValue === '' ? null : Number(modelValue)"
    :items="intermediarioItems"
    item-title="title"
    item-value="value"
    :label="label"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    density="compact"
    @update:model-value="emitValue"
  />
  <v-combobox
    v-else-if="field.type === 'condition'"
    :model-value="modelValue === null ? null : String(modelValue)"
    :items="conditionItems"
    :label="label"
    :hint="t('invoicing.fiscal.hint.condicion')"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    density="compact"
    persistent-hint
    @update:model-value="
      (v: unknown) => emitValue(String(v ?? '').toUpperCase())
    "
  />
  <v-textarea
    v-else-if="field.type === 'textarea'"
    :model-value="modelValue"
    :label="label"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    rows="2"
    auto-grow
    density="compact"
    @update:model-value="emitValue"
  />
  <v-text-field
    v-else
    :model-value="modelValue"
    :label="label"
    :type="inputType"
    :hint="hint"
    :persistent-hint="!!hint"
    :error-messages="error ? [error] : []"
    :readonly="readonly"
    :maxlength="field.type === 'iso' ? 2 : undefined"
    :class="{ 'fisc-mono': field.type === 'regex' }"
    density="compact"
    @update:model-value="onText"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FiscTabla } from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import type { FieldDef } from "./fiscFields";

const props = defineProps<{
  field: FieldDef;
  tabla: FiscTabla;
  modelValue: string | number | null;
  error?: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string | number | null): void;
}>();

const { t } = useI18n();
const store = useFiscConfigStore();

const label = computed(
  () =>
    t(`invoicing.fiscal.field.${props.field.key}`) +
    (props.field.required ? " *" : ""),
);

const inputType = computed(() => {
  switch (props.field.type) {
    case "date":
      return "date";
    case "int":
      return "number";
    default:
      return "text";
  }
});

const hint = computed(() => {
  switch (props.field.type) {
    case "iso":
      return t("invoicing.fiscal.hint.iso");
    case "regex":
      return t("invoicing.fiscal.hint.regex");
    case "decimal":
      return t("invoicing.fiscal.hint.decimal");
    default:
      if (
        ["id_partner", "id_servizio", "id_cliente"].includes(props.field.key)
      ) {
        return t("invoicing.fiscal.hint.zero_all");
      }
      return "";
  }
});

const enumItems = computed(() => {
  const values =
    props.field.type === "sn"
      ? ["S", "N"]
      : store.enumOf(props.tabla, props.field.key);
  const items = values.map((v) => ({ value: v, title: v }));
  if (props.field.allowEmpty) {
    items.unshift({ value: "", title: t("invoicing.fiscal.all") });
  }
  return items;
});

const voceItems = computed(() =>
  (store.meta?.voci ?? []).map((v) => ({
    value: v.id,
    title: `${v.codice} — ${v.nome}`,
  })),
);

const intermediarioItems = computed(() =>
  (store.meta?.intermediari ?? []).map((i) => ({
    value: i.id,
    title: `${i.codice} (${i.modo})`,
  })),
);

const conditionItems = computed(() => [
  ...(store.meta?.condiciones.codigos ?? []),
  ...(store.meta?.condiciones.prefijos ?? []),
]);

function emitValue(v: unknown): void {
  emit(
    "update:modelValue",
    v === undefined ? null : (v as string | number | null),
  );
}

function onText(v: string): void {
  if (props.field.type === "upper" || props.field.type === "iso") {
    emit("update:modelValue", (v ?? "").toUpperCase());
    return;
  }
  emit("update:modelValue", v);
}
</script>

<style scoped>
.fisc-mono :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
