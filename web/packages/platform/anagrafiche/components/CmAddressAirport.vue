<template>
  <!-- Modo TERMINAL (cargo): terminal por país desde cargo_terminals. -->
  <CmTerminalSelect
    v-if="variant === 'terminal'"
    :model-value="normalized"
    :country="String(country ?? '')"
    type="A"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    @update:model-value="onUpdate"
  />

  <!-- Modo NEAREST (courier): aeropuerto cercano por CAP + lista país. -->
  <v-autocomplete
    v-else
    :model-value="normalized"
    :items="items"
    :loading="loading"
    item-title="value"
    item-value="value"
    :custom-filter="nearestFilter"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    clearable
    hide-no-data
    density="compact"
    variant="outlined"
    prepend-inner-icon="mdi-airplane"
    @update:model-value="onUpdate"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :title="item.raw.label" />
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
/**
 * CmAddressAirport — selector unificado del aeropuerto de una dirección,
 * reutilizado por el bloque de dirección de courier (shipment) y cargo.
 *
 * Dos variantes, correspondientes a la divergencia real del legacy:
 *  - `nearest` (courier / spedy_form.php `dhl_airport`): autocomplete de la
 *    SIGLA IATA, alimentado por el aeropuerto más cercano al CAP/ciudad
 *    (`closer_airports`) y por la lista completa del país (terminalsService).
 *    Filtro que busca por "SIGLA — ciudad" aunque el campo muestre solo la sigla.
 *  - `terminal` (cargo / spedyc_form.php `terminal_dest`/`terminal_part`):
 *    delega en CmTerminalSelect (terminal cargo por país desde `cargo_terminals`
 *    vía api_cargo_terminals). El valor persiste igualmente como sigla.
 *
 * En ambos casos el valor "0"/"" del legacy (= sin aeropuerto) se normaliza a
 * null para mostrar el placeholder en vez de un "0" pelado.
 *
 * El padre alimenta `items` en modo nearest (los candidatos que resuelve por
 * CAP/país); este componente solo aporta el render + filtro + normalización.
 */
import { computed } from 'vue';
import CmTerminalSelect from './CmTerminalSelect.vue';

export interface AirportOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    /** 'nearest' (courier) | 'terminal' (cargo). */
    variant?: 'nearest' | 'terminal';
    /** País ISO2 — acota la lista de terminales (modo terminal) y el filtro. */
    country?: string | null;
    /** Candidatos (modo nearest), provistos por el bloque de dirección. */
    items?: AirportOption[];
    loading?: boolean;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    clearable?: boolean;
  }>(),
  {
    variant: 'nearest',
    country: '',
    items: () => [],
    loading: false,
    label: '',
    placeholder: '',
    disabled: false,
    readonly: false,
    clearable: true,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

// "0"/"" (legacy sin aeropuerto) → null para que se vea el placeholder.
const normalized = computed<string | null>(() => {
  const a = String(props.modelValue ?? '');
  return a === '' || a === '0' ? null : a;
});

const items = computed<AirportOption[]>(() => props.items);

function onUpdate(v: string | null): void {
  emit('update:modelValue', v || null);
}

/**
 * Filtro (modo nearest) que busca en el label completo "SIGLA — ciudad" aunque
 * el campo muestre solo la sigla (item-title="value"). Acento-insensible,
 * substring o por token. Vuetify siembra el input con la sigla seleccionada, así
 * que se elimina ese prefijo para filtrar por lo que el usuario realmente teclea.
 */
function nearestFilter(
  _value: string,
  query: string,
  item?: { raw?: { label?: string; value?: string } },
): boolean {
  const norm = (s: string) =>
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  const hay = norm(`${item?.raw?.label ?? ''} ${item?.raw?.value ?? ''}`);
  let q = norm(query).trim();
  if (!q) return true;
  const sel = norm(String(props.modelValue ?? ''));
  if (sel && q.startsWith(sel) && q.length > sel.length) {
    q = q.slice(sel.length);
  }
  if (hay.includes(q)) return true;
  return q
    .split(/[\s()\-—]+/)
    .filter((tok) => tok.length >= 2)
    .some((tok) => hay.includes(tok));
}
</script>
