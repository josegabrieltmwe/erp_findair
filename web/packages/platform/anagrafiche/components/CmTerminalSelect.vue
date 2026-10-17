<template>
  <v-autocomplete
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled || !country"
    :clearable="clearable"
    :prepend-inner-icon="icon"
    item-title="label"
    item-value="sigla"
    density="compact"
    variant="outlined"
    auto-select-first
    :custom-filter="() => true"
    @update:model-value="onUpdate"
    @update:search="onSearch"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="item.raw.citta">
        <template #prepend>
          <v-icon :icon="icon" size="18" class="mr-1" />
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
/**
 * CmTerminalSelect — selector reutilizable de terminal cargo (aeropuerto /
 * puerto) filtrado por país. Búsqueda remota contra api_cargo_terminals.
 * value = sigla (IATA / código puerto). type 'A'=aeropuerto, 'P'=puerto.
 */
import { computed, ref, watch } from 'vue';
import { mdiAirplane, mdiFerry } from '@mdi/js';
import { terminalsService, type TerminalOption } from '../services/terminals.service';

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    /** País ISO2 que acota el catálogo (id_paese_iso de la sede). */
    country?: string | null;
    /** 'A' aeropuerto | 'P' puerto. */
    type?: 'A' | 'P';
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  { country: '', type: 'A', label: '', placeholder: '', disabled: false, clearable: true },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const loading = ref(false);
const terminals = ref<TerminalOption[]>([]);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const icon = computed(() => (props.type === 'P' ? mdiFerry : mdiAirplane));

const items = computed(() => {
  const list = terminals.value.map((t) => ({ sigla: t.sigla, label: t.label, citta: t.citta }));
  // Conserva el valor actual aunque no venga en el resultado actual.
  const cur = props.modelValue ?? '';
  if (cur && !list.some((i) => i.sigla === cur)) {
    list.unshift({ sigla: cur, label: cur, citta: '' });
  }
  return list;
});

async function load(q = ''): Promise<void> {
  if (!props.country) {
    terminals.value = [];
    return;
  }
  loading.value = true;
  try {
    terminals.value = await terminalsService.list(props.country, props.type, q);
  } catch {
    terminals.value = [];
  } finally {
    loading.value = false;
  }
}

function onSearch(q: string): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(q), 250);
}

function onUpdate(v: string | null): void {
  emit('update:modelValue', v || null);
}

// Recargar al cambiar el país (preload sin query).
watch(() => props.country, () => load(''), { immediate: true });
</script>
