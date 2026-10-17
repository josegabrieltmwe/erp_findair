<template>
  <!-- Autocomplete remoto: one-way + onPick + mergedItems (misma regla que facturación). -->
  <v-autocomplete
    :model-value="modelValue"
    :items="mergedItems"
    :loading="searching"
    item-title="label"
    item-value="id"
    :label="label"
    density="comfortable"
    variant="outlined"
    no-filter
    clearable
    hide-details
    @update:search="onSearch"
    @update:model-value="onPick"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { anagraficaService } from "../../invoicing/services/anagrafica.service";

interface ClientItem {
  id: number;
  label: string;
}

const props = defineProps<{
  modelValue: number | null | undefined;
  label: string;
  /** Nombre ya conocido del cliente seleccionado (p. ej. al llegar con un filtro). */
  initialName?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [number | null] }>();

const items = ref<ClientItem[]>([]);
const selected = ref<ClientItem | null>(null);
const searching = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const mergedItems = computed<ClientItem[]>(() => {
  const list = [...items.value];
  let sel = selected.value;
  if (!sel && props.modelValue && props.initialName) {
    sel = { id: props.modelValue, label: props.initialName };
  }
  if (sel && !list.some((i) => i.id === sel!.id)) list.unshift(sel);
  return list;
});

function onSearch(text: string): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const q = (text ?? "").trim();
    if (q.length < 2) return;
    searching.value = true;
    try {
      const rows = await anagraficaService.search(q);
      items.value = rows
        .filter((a) => Number(a.id) > 0)
        .map((a) => ({
          id: Number(a.id),
          label: (a.rag_soc || a.nome_breve || `#${a.id}`).toString().trim(),
        }));
    } catch {
      items.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
}

function onPick(id: number | null): void {
  selected.value = items.value.find((i) => i.id === id) ?? null;
  emit("update:modelValue", id ? Number(id) : null);
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>
