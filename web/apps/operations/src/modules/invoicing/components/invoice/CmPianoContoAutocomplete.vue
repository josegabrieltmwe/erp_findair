<template>
  <v-autocomplete
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    item-title="title"
    item-value="id"
    :label="label"
    :placeholder="placeholder"
    density="compact"
    variant="plain"
    hide-details
    :clearable="clearable"
    auto-select-first
    @update:model-value="onPick"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  pianoContoService,
  type PianoContoLite,
} from "../../services/pianoConto.service";

const props = withDefaults(
  defineProps<{
    /** id del conto seleccionado (0 / undefined = ninguno). */
    modelValue: number | string | null | undefined;
    label?: string;
    placeholder?: string;
    clearable?: boolean;
  }>(),
  { label: "", placeholder: "", clearable: true },
);

const emit = defineEmits<{ (e: "update:modelValue", v: number): void }>();

interface Option {
  id: number;
  title: string;
}

const rows = ref<PianoContoLite[]>([]);
const loading = ref(false);

function toOption(p: PianoContoLite): Option {
  const id = Number(p.id) || 0;
  const label = [p.codice, p.descr].filter(Boolean).join(" — ");
  return { id, title: label || String(id) };
}

/**
 * Opciones = catálogo cargado + (si procede) una opción sintética para un id
 * persistido que ya no está en el catálogo, para no perder el valor guardado.
 */
const items = computed<Option[]>(() => {
  const opts = rows.value.map(toOption);
  const current = Number(props.modelValue) || 0;
  if (current > 0 && !opts.some((o) => o.id === current)) {
    opts.unshift({ id: current, title: `#${current}` });
  }
  return opts;
});

function onPick(v: string | number | null): void {
  emit("update:modelValue", Number(v) || 0);
}

onMounted(async () => {
  loading.value = true;
  try {
    rows.value = await pianoContoService.list();
  } finally {
    loading.value = false;
  }
});
</script>
