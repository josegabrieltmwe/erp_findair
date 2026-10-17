<template>
  <!-- Surface-tinted block instead of an outlined card: three of these sit
       side by side inside an already-framed tab, and stacking borders inside
       borders is what made the form look boxed-in. -->
  <div class="mawb-block">
    <div
      class="mawb-block__head d-flex align-center text-subtitle-2 font-weight-medium"
    >
      <v-icon :icon="icon" size="16" class="me-2" />
      {{ label }}
    </div>
    <div class="mawb-block__body">
      <!-- Copy from well-known address (legacy AwbAddrSet) -->
      <div v-if="prefix" class="d-flex align-center flex-wrap gap-1 mb-2">
        <span class="text-caption text-medium-emphasis me-1">{{
          t("cargo.addr.copy_from")
        }}</span>
        <v-btn
          v-for="src in copySources"
          :key="src.value"
          size="x-small"
          variant="tonal"
          :loading="copyingSource === src.value"
          :disabled="readonly || copyingSource !== null"
          @click="copyFrom(src.value)"
        >
          {{ src.label }}
        </v-btn>
        <!-- Clear the block (legacy AwbAddrSet ZER option). -->
        <v-btn
          size="x-small"
          variant="text"
          color="error"
          prepend-icon="mdi-eraser"
          :disabled="readonly || copyingSource !== null"
          @click="clearBlock"
        >
          {{ t("cargo.addr.clear") }}
        </v-btn>
      </div>

      <!-- Picker: busca en la rubrica del cliente (paridad legacy rubrica.php) -->
      <v-autocomplete
        :model-value="pickerSelection"
        :items="pickerItems"
        :loading="pickerLoading"
        item-title="name"
        :item-value="(row: RubricaRow) => row.id"
        return-object
        clearable
        no-filter
        density="compact"
        hide-no-data
        :placeholder="t('cargo.addr.search_anagrafiche')"
        prepend-inner-icon="mdi-account-search"
        :disabled="readonly"
        @update:search="onPickerSearch"
        @update:model-value="onPickerPick"
      />

      <!-- Inline edit fields — same 8px gap rhythm as the grid below. -->
      <div class="mawb-block__stack mt-2">
        <v-text-field
          :model-value="local.nome"
          :label="t('cargo.addr.name')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('nome', v)"
        />
        <v-text-field
          :model-value="local.attenzione"
          :label="t('cargo.addr.attention_contact')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('attenzione', v)"
        />
        <v-text-field
          :model-value="local.adress"
          :label="t('cargo.addr.address')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('adress', v)"
        />
      </div>
      <!-- Two even columns instead of four hardcoded pixel widths: the block
           is only ~320px wide, so 100/auto/120/70px squeezed the fields into
           unreadable slivers and left every block's rows misaligned. -->
      <div class="mawb-block__grid">
        <v-text-field
          :model-value="local.cap"
          :label="t('cargo.addr.cap')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('cap', v)"
        />
        <v-text-field
          :model-value="local.citta"
          :label="t('cargo.addr.city')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('citta', v)"
        />
        <CmProvinciaSelect
          :model-value="local.prov"
          :country="String(local.id_paese_iso ?? '')"
          mode="auto"
          :disabled="readonly"
          :label="t('cargo.addr.prov')"
          @update:model-value="
            (v: string | null) => onLocalChange('prov', v ?? '')
          "
        />
        <v-text-field
          :model-value="local.id_paese_iso"
          :label="t('cargo.addr.country')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('id_paese_iso', v)"
        />
        <v-text-field
          :model-value="local.tel"
          :label="t('cargo.addr.phone')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('tel', v)"
        />
        <v-text-field
          :model-value="local.mail"
          :label="t('cargo.addr.email')"
          :disabled="readonly"
          @change="(v: string) => onLocalChange('mail', v)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  awbAddressPickerService,
  type AwbAddressSource,
} from "@cargo/services/cargo_mawb.service";
import type {
  MawbAddress,
  AnagraficaPickerTipo,
} from "@cargo/services/cargo_mawb.types";
import {
  rubricaService,
  type RubricaRow,
} from "@cargo/services/rubrica.service";
import CmProvinciaSelect from "@shared/anagrafiche/components/CmProvinciaSelect.vue";

const props = defineProps<{
  label: string;
  icon: string;
  modelValue: MawbAddress;
  tipo?: AnagraficaPickerTipo;
  readonly?: boolean;
  /** Cargo id — required to enable the "Copia da" quick-fill buttons. */
  cargoId?: number | null;
  /** Which AWB block this is; enables the copy buttons and the column prefix. */
  prefix?: "shipper_" | "consignee_" | "notify_";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: MawbAddress): void;
  (
    e: "field-change",
    payload: { field: keyof MawbAddress; value: string },
  ): void;
  /** Batched variant: several fields set at once (copy-from / rubrica pick). */
  (
    e: "fields-change",
    payload: Partial<Record<keyof MawbAddress, string>>,
  ): void;
}>();

const { t } = useI18n();
const local = reactive<MawbAddress>({ ...props.modelValue });

/**
 * Fields the operator has edited whose save has not been confirmed yet. A
 * refresh of `props.modelValue` (which happens on EVERY patch of the MAWB, not
 * just this block's) must not overwrite them — that was the data-loss bug.
 */
const dirty = new Set<keyof MawbAddress>();

watch(
  () => props.modelValue,
  (v) => {
    for (const k of Object.keys(v) as (keyof MawbAddress)[]) {
      if (dirty.has(k)) continue; // operator owns this field right now
      (local as Record<string, unknown>)[k] = v[k];
    }
  },
  // No `deep`: the parent hands us a fresh object on each refresh, so a
  // shallow watch already fires — and deep multiplied the clobbering.
);

function onLocalChange<K extends keyof MawbAddress>(
  field: K,
  value: string,
): void {
  (local as Record<string, unknown>)[field] = value;
  dirty.add(field);
  emit("update:modelValue", { ...local });
  emit("field-change", { field, value });
}

/**
 * Release a field once the parent has persisted it, so server refreshes own it
 * again. Called by the parent through `defineExpose` after a successful PATCH.
 */
function releaseField(field: keyof MawbAddress): void {
  dirty.delete(field);
}

function releaseAll(): void {
  dirty.clear();
}

defineExpose({ releaseField, releaseAll });

// --- Autocomplete ---
// Paridad legacy (rubrica.php / RubricaAOpenAWB): la búsqueda de direcciones del
// AWB consulta la RUBRICA del cliente (spedizioni_rubrica, filtrada por el
// cliente del contexto en el backend), NO la tabla anagrafiche ni por `tipo`.
// Se reutiliza `rubricaService`, el mismo servicio del bloque de direcciones del
// cargo (CargoAddressBlock) que ya funciona. `props.tipo` ya no gobierna la
// búsqueda (era la causa del bug de 0 resultados).
const pickerItems = ref<RubricaRow[]>([]);
const pickerLoading = ref(false);
const pickerSelection = ref<RubricaRow | null>(null);
let pickerTimer: ReturnType<typeof setTimeout> | null = null;

function onPickerSearch(q: string): void {
  if (pickerTimer) clearTimeout(pickerTimer);
  pickerTimer = setTimeout(async () => {
    const trimmed = (q ?? "").trim();
    if (trimmed.length < 2) {
      pickerItems.value = [];
      return;
    }
    pickerLoading.value = true;
    try {
      pickerItems.value = await rubricaService.search({
        text: trimmed,
        limit: 12,
      });
    } catch {
      pickerItems.value = [];
    } finally {
      pickerLoading.value = false;
    }
  }, 250);
}

// --- Copy from well-known address (legacy AwbAddrSet) ---
const copySources = computed<{ value: AwbAddressSource; label: string }[]>(
  () => [
    { value: "destinazione", label: t("cargo.addr.src_dest") },
    { value: "presa", label: t("cargo.addr.src_pickup") },
    { value: "sede", label: t("cargo.addr.src_sede") },
    { value: "tmwe", label: "TMWE" },
    { value: "partner", label: t("cargo.overview.partner") },
  ],
);
const copyingSource = ref<AwbAddressSource | null>(null);

/** Map the picker's prefixed columns back to MawbAddress fields. */
const COLUMN_TO_FIELD: Record<string, keyof MawbAddress> = {
  nome: "nome",
  address: "adress",
  cap: "cap",
  citta: "citta",
  prov: "prov",
  paese: "id_paese_iso",
  attenzione: "attenzione",
  tel: "tel",
  mail: "mail",
};

async function copyFrom(source: AwbAddressSource): Promise<void> {
  if (!props.cargoId || !props.prefix) return;
  // Hoisted so the narrowing survives inside the loop closure below.
  const prefix: string = props.prefix;
  copyingSource.value = source;
  try {
    const res = await awbAddressPickerService.resolve(
      props.cargoId,
      source,
      props.prefix,
    );
    const fields = res?.fields ?? {};
    const batch: Partial<Record<keyof MawbAddress, string>> = {};
    for (const [key, raw] of Object.entries(fields)) {
      // Strip the shipper_/consignee_/notify_ prefix the backend added.
      const bare = key.startsWith(prefix) ? key.slice(prefix.length) : key;
      const field = COLUMN_TO_FIELD[bare];
      if (!field) continue;
      const value = raw == null ? "" : String(raw);
      (local as Record<string, unknown>)[field] = value;
      batch[field] = value;
    }
    emit("update:modelValue", { ...local });
    // One PATCH for the whole block instead of one per field (was up to 9).
    if (Object.keys(batch).length) emit("fields-change", batch);
  } catch {
    /* swallow — leave fields untouched on error */
  } finally {
    copyingSource.value = null;
  }
}

/** Empty every field of this block and persist the cleared values (ZER). */
function clearBlock(): void {
  if (props.readonly) return;
  const fields: (keyof MawbAddress)[] = [
    "nome",
    "adress",
    "cap",
    "citta",
    "prov",
    "id_paese_iso",
    "attenzione",
    "tel",
    "mail",
  ];
  const batch: Partial<Record<keyof MawbAddress, string>> = {};
  for (const f of fields) {
    if (local[f] === "" || local[f] == null) continue;
    (local as Record<string, unknown>)[f] = "";
    batch[f] = "";
  }
  emit("update:modelValue", { ...local });
  if (Object.keys(batch).length) emit("fields-change", batch);
}

function onPickerPick(row: RubricaRow | null): void {
  if (!row) return;
  // Mapea RubricaRow (nombres "modernos": name/city/country/contact_name) a
  // MawbAddress (columnas legacy: nome/citta/id_paese_iso/attenzione), igual que
  // CargoAddressBlock.onRubricaPick. Se emite field-change por campo para que el
  // padre persista cada columna vía PATCH.
  const mapped: Partial<Record<keyof MawbAddress, string>> = {
    nome: row.name ?? "",
    adress: row.adress ?? row.address ?? "",
    cap: row.cap ?? "",
    citta: row.city ?? "",
    prov: row.prov ?? "",
    id_paese_iso: row.country ?? "",
    attenzione: row.contact_name ?? "",
    tel: row.tel ?? "",
  };
  const batch: Partial<Record<keyof MawbAddress, string>> = {};
  for (const [field, value] of Object.entries(mapped) as [
    keyof MawbAddress,
    string,
  ][]) {
    if (value !== "" && value !== local[field]) {
      (local as Record<string, unknown>)[field] = value;
      batch[field] = value;
    }
  }
  emit("update:modelValue", { ...local });
  if (Object.keys(batch).length) emit("fields-change", batch);
  // Limpiar la selección para poder re-elegir la misma entrada más tarde.
  pickerSelection.value = null;
}
</script>

<style scoped>
.mawb-block {
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant));
  overflow: hidden;
}
.mawb-block__head {
  padding: 8px 12px;
  /* Hairline separator carries the grouping instead of a full outline. */
  border-block-end: 1px solid rgba(var(--v-border-color), 0.5);
}
.mawb-block__body {
  padding: 12px;
}
/* CAP · city / prov · country / phone · email — 2×3 even grid, so all three
   address blocks share the exact same field rhythm side by side. */
.mawb-block__stack {
  display: grid;
  gap: 8px;
}
.mawb-block__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.gap-2 {
  gap: 8px;
}
</style>
