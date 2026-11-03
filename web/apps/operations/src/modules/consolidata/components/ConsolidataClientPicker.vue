<template>
  <!-- Autocompletar remoto de clientes (mismo servicio que el filtro de cargo).
       Emite el id; `initialLabel` evita enseñar el id crudo al reabrir. -->
  <v-autocomplete
    :model-value="selection"
    :items="items"
    :loading="loading"
    item-title="rag_soc"
    item-value="id"
    return-object
    :label="label"
    :error-messages="errorMessages"
    density="comfortable"
    variant="outlined"
    clearable
    hide-no-data
    no-filter
    prepend-inner-icon="mdi-account-search"
    :hide-details="hideDetails"
    @update:search="onSearch"
    @update:model-value="onPick"
  />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@shared/services/anagrafica.service";

const props = withDefaults(
  defineProps<{
    modelValue: number | null;
    label: string;
    initialLabel?: string | null;
    errorMessages?: string | string[];
    hideDetails?: boolean;
  }>(),
  { initialLabel: null, errorMessages: undefined, hideDetails: false },
);
const emit = defineEmits<{
  (e: "update:modelValue", v: number | null): void;
  (e: "picked", v: AnagraficaLite | null): void;
}>();

const items = ref<AnagraficaLite[]>([]);
const selection = ref<AnagraficaLite | null>(null);
const loading = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function onSearch(q: string | null): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const trimmed = (q ?? "").trim();
    if (trimmed.length < 2 || trimmed === selection.value?.rag_soc) return;
    loading.value = true;
    try {
      items.value = await anagraficaService.search(trimmed, 25);
    } catch {
      items.value = [];
    } finally {
      loading.value = false;
    }
  }, 250);
}

function onPick(sel: AnagraficaLite | null): void {
  selection.value = sel;
  emit("update:modelValue", sel ? Number(sel.id) : null);
  emit("picked", sel);
}

/** Resuelve un id ya elegido a su nombre (al abrir con un valor). */
async function syncSelection(): Promise<void> {
  const id = Number(props.modelValue || 0);
  if (!id) {
    selection.value = null;
    return;
  }
  if (selection.value && Number(selection.value.id) === id) return;
  selection.value = { id, rag_soc: props.initialLabel || String(id) };
  items.value = [selection.value];
  if (props.initialLabel) return;
  const row = await anagraficaService.getById(id);
  if (row && Number(props.modelValue) === id) {
    selection.value = row;
    items.value = [row];
  }
}

watch(
  () => props.modelValue,
  () => void syncSelection(),
  { immediate: true },
);
</script>
