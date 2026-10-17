<template>
  <!-- Autocomplete contra el directorio UNR (dgr_substances). Busca por número
       UN o por nombre técnico. Al elegir, emite la sustancia completa para que
       el padre herede clase/PG/PSN. Patrón autocomplete remoto del proyecto:
       :model-value one-way + búsqueda con debounce + emit onPick.
       El item de la selección actual se inyecta desde initialText para que una
       declaración ya guardada muestre "UN3480 — ..." en vez del id crudo. -->
  <v-autocomplete
    :model-value="modelValue"
    :items="mergedItems"
    :loading="loading"
    :label="label"
    :readonly="readonly"
    item-title="display"
    item-value="id"
    :no-data-text="
      searchText.length < 2
        ? t('shipment.dgr.type_to_search')
        : t('shipment.dgr.no_substances')
    "
    :menu-props="{ maxHeight: 320 }"
    clearable
    hide-details="auto"
    no-filter
    @update:search="onSearch"
    @update:model-value="onPick"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :title="undefined">
        <v-list-item-title>
          <strong>{{ item.raw.un_number }}</strong> —
          {{ item.raw.proper_shipping_name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("shipment.dgr.class") }} {{ item.raw.hazard_class || "—" }} · PG
          {{ item.raw.packing_group || "—" }}
          <span v-if="item.raw.tipomerce_sigla">
            · {{ item.raw.tipomerce_sigla }}</span
          >
        </v-list-item-subtitle>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  searchDgrSubstances,
  type DgrSubstance,
} from "@shared/services/dgr.service";

const props = withDefaults(
  defineProps<{
    /** id de la sustancia seleccionada (dgr_substances.id) o null. */
    modelValue?: number | null;
    label?: string;
    readonly?: boolean;
    /**
     * Etiqueta de la sustancia ya seleccionada (p.ej. "UN3480 — Lithium ion
     * batteries"), para hidratar el item cuando el diálogo abre con una
     * declaración existente y aún no se ha buscado nada. Sin esto el
     * autocomplete mostraría el id crudo.
     */
    initialText?: string | null;
  }>(),
  {
    modelValue: null,
    label: "",
    readonly: false,
    initialText: null,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", id: number | null): void;
  /** Sustancia completa elegida (o null al limpiar) — para heredar sus campos. */
  (e: "pick", substance: DgrSubstance | null): void;
}>();

const { t } = useI18n();

interface Item extends Partial<DgrSubstance> {
  id: number;
  display: string;
}
const items = ref<Item[]>([]);
const loading = ref(false);
const searchText = ref("");
let debounce: ReturnType<typeof setTimeout> | null = null;

function toItem(s: DgrSubstance): Item {
  return { ...s, display: `${s.un_number} — ${s.proper_shipping_name}` };
}

// El item de la selección actual (from props) SIEMPRE debe estar en la lista,
// aunque no se haya buscado, para que v-autocomplete muestre su texto y no el id.
const mergedItems = computed<Item[]>(() => {
  const list = [...items.value];
  if (
    props.modelValue != null &&
    !list.some((i) => i.id === props.modelValue)
  ) {
    list.unshift({
      id: props.modelValue,
      display: props.initialText || String(props.modelValue),
    });
  }
  return list;
});

function onSearch(term: string): void {
  searchText.value = term ?? "";
  if (debounce) clearTimeout(debounce);
  if (!term || term.trim().length < 2) {
    items.value = [];
    return;
  }
  debounce = setTimeout(async () => {
    loading.value = true;
    try {
      const res = await searchDgrSubstances(term.trim());
      items.value = res.map(toItem);
    } finally {
      loading.value = false;
    }
  }, 250);
}

function onPick(id: number | null): void {
  emit("update:modelValue", id);
  const found =
    id != null ? (items.value.find((i) => i.id === id) ?? null) : null;
  emit("pick", (found as DgrSubstance | null) ?? null);
}
</script>
