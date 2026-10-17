<template>
  <CmEntityAutocomplete
    :model-value="modelValue"
    :fetcher="fetch"
    :item-getter="getItem"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :initial-option="initialOption"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :disabled="disabled"
    :clearable="clearable"
    :rules="rules"
    @update:model-value="onUpdate"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
/**
 * CmAnagraficaAutocomplete — Partner / cliente selector.
 *
 * Thin wrapper over CmEntityAutocomplete that wires the anagrafica service
 * and supplies the display formatters. Public API kept identical to the
 * pre-library version to avoid breaking existing pages (B2bPage, SmtpPage).
 */
import CmEntityAutocomplete from "./CmEntityAutocomplete.vue";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@shared/anagrafiche/services/anagrafica.service";

interface Props {
  modelValue: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  initialOption?: AnagraficaLite | null;
}

withDefaults(defineProps<Props>(), {
  label: "",
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
  initialOption: null,
});

const emit = defineEmits<{
  "update:modelValue": [value: number | null];
  select: [option: AnagraficaLite | null];
}>();

function fetch(q: string, perPage?: number): Promise<AnagraficaLite[]> {
  return anagraficaService.search(q, perPage ?? 25);
}

function getItem(id: number | string): Promise<AnagraficaLite | null> {
  return anagraficaService.getById(
    typeof id === "number" ? id : parseInt(id, 10),
  );
}

function formatPrimary(r: AnagraficaLite): string {
  return r.nome_breve ? `${r.rag_soc} (${r.nome_breve})` : r.rag_soc;
}

function formatSecondary(r: AnagraficaLite): string | undefined {
  return r.pi_cf ? `P.IVA/CF: ${r.pi_cf}` : undefined;
}

function onUpdate(v: number | string | null): void {
  emit("update:modelValue", typeof v === "string" ? parseInt(v, 10) : v);
}

function onSelect(opt: AnagraficaLite | null): void {
  emit("select", opt);
}
</script>
