<template>
  <ModalWrapper
    name="dgr"
    :title="t('shipment.dgr.title')"
    icon="mdi-hazard-lights"
    :max-width="900"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      icon="mdi-information-outline"
    >
      {{ t("shipment.dgr.intro") }}
    </v-alert>

    <!-- Lo que exige el courier asignado y falta (mismo control que bloquea la etiqueta). -->
    <v-alert
      v-if="requirements && requirements.missing.length"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
      icon="mdi-truck-alert-outline"
    >
      <div class="font-weight-medium mb-1">
        {{ t("shipment.dgr.req_missing_title", { courier: courierName }) }}
      </div>
      <ul class="dgr-req-list">
        <li v-for="m in requirements.missing" :key="m.code + m.message">{{ m.message }}</li>
      </ul>
    </v-alert>
    <v-alert
      v-else-if="requirements && requirements.dg"
      type="success"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("shipment.dgr.req_ok", { courier: courierName }) }}
    </v-alert>
    <v-alert
      v-if="requirements && requirements.warnings.length"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <ul class="dgr-req-list">
        <li v-for="w in requirements.warnings" :key="w.code + w.message">{{ w.message }}</li>
      </ul>
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <v-alert
        v-if="rows.length === 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ t("shipment.dgr.empty") }}
      </v-alert>

      <!-- Cada sustancia es una FormSection flat: cabecera con título + acción,
           divisor, y campos dentro. Sin cards outlined anidadas → sin bordes
           internos; se lee como un solo formulario armónico con el tema. -->
      <div v-for="(row, idx) in rows" :key="idx" class="dgr-substance mb-4">
        <div class="d-flex align-center px-1 mb-2">
          <v-icon
            icon="mdi-flask-outline"
            size="16"
            class="me-2 text-medium-emphasis"
          />
          <span class="text-subtitle-2 font-weight-medium">
            {{ t("shipment.dgr.substance_n", { n: idx + 1 }) }}
          </span>
          <span
            v-if="row.un_number"
            class="text-caption text-medium-emphasis ms-2"
          >
            · {{ row.un_number }}
          </span>
          <v-spacer />
          <v-btn
            icon="mdi-delete-outline"
            size="x-small"
            variant="text"
            color="error"
            @click="removeRow(idx)"
          />
        </div>

        <v-row dense>
          <v-col cols="12" md="7">
            <UnSubstanceAutocomplete
              v-model="row.id_dgr_substance"
              :initial-text="substanceText(row)"
              :label="t('shipment.dgr.un_substance')"
              @pick="(s) => onPick(row, s)"
            />
          </v-col>
          <v-col cols="12" md="5">
            <v-select
              v-model="row.transport_mode"
              :items="transportModeItems"
              :label="t('shipment.dgr.transport_mode')"
              hide-details="auto"
            />
          </v-col>
        </v-row>

        <v-row dense class="mt-1">
          <v-col cols="6" md="3">
            <v-text-field
              :model-value="row.un_number"
              :label="t('shipment.dgr.un_number')"
              readonly
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="3">
            <v-text-field
              :model-value="row.hazard_class"
              :label="t('shipment.dgr.class')"
              readonly
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              :model-value="row.packing_group"
              label="PG"
              readonly
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model.number="row.quantity_value"
              :label="t('shipment.dgr.quantity_net')"
              type="number"
              min="0"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="row.quantity_uom"
              :items="['KG', 'G', 'L', 'ML']"
              :label="t('shipment.dgr.uom')"
              hide-details="auto"
              density="compact"
              clearable
            />
          </v-col>
        </v-row>

        <!-- Datos que piden los couriers: embalaje, instrucción, avión, litio, ADR y bulto. -->
        <v-row dense class="mt-1">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="row.packaging_type"
              :label="t('shipment.dgr.packaging_type')"
              :placeholder="t('shipment.dgr.packaging_type_ph')"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model.number="row.packaging_count"
              :label="t('shipment.dgr.packaging_count')"
              type="number"
              min="1"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="row.packing_instruction"
              :label="t('shipment.dgr.packing_instruction')"
              placeholder="PI967"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="row.aircraft_limitation"
              :items="aircraftItems"
              :label="t('shipment.dgr.aircraft')"
              hide-details="auto"
              density="compact"
              clearable
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="row.id_collo"
              :items="packageItems"
              :label="t('shipment.dgr.package')"
              hide-details="auto"
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row dense class="mt-1">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="row.technical_name"
              :label="t('shipment.dgr.technical_name')"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="row.adr_transport_category"
              :items="['0', '1', '2', '3', '4']"
              :label="t('shipment.dgr.adr_category')"
              hide-details="auto"
              density="compact"
              clearable
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="row.adr_tunnel_code"
              :label="t('shipment.dgr.adr_tunnel')"
              placeholder="D/E"
              hide-details="auto"
              density="compact"
            />
          </v-col>
          <v-col v-if="isLithium(row)" cols="6" md="2">
            <v-select
              v-model="row.lithium_section"
              :items="['IA', 'IB', 'I', 'II']"
              :label="t('shipment.dgr.lithium_section')"
              hide-details="auto"
              density="compact"
              clearable
            />
          </v-col>
        </v-row>

        <!-- Aviso LQ: la cantidad no debe superar el máximo por bulto (ADR §3.4). -->
        <v-alert
          v-if="lqWarning(row)"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
        >
          {{ lqWarning(row) }}
        </v-alert>

        <v-divider v-if="idx < rows.length - 1" class="mt-4" />
      </div>

      <v-btn
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        size="small"
        @click="addRow"
      >
        {{ t("shipment.dgr.add_substance") }}
      </v-btn>
    </template>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        variant="flat"
        color="primary"
        :loading="saving"
        :disabled="!canSave"
        @click="save"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import ModalWrapper from "../modals/ModalWrapper.vue";
import UnSubstanceAutocomplete from "./UnSubstanceAutocomplete.vue";
import {
  dgrService,
  type DgrDeclaration,
  type DgrRequirements,
  type DgrSubstance,
} from "@shipment/services/dgr.service";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const { id, packages } = storeToRefs(store);
const toasts = useToastStore();

// Cache del límite LQ por sustancia (viene del catálogo, no de la declaración).
const lqMaxById = ref<Record<number, string | null>>({});

const rows = ref<DgrDeclaration[]>([]);
const requirements = ref<DgrRequirements | null>(null);

const courierName = computed(() => (requirements.value?.courier ?? "").toUpperCase());

const aircraftItems = computed(() => [
  { title: t("shipment.dgr.aircraft_pax"), value: "PAX" },
  { title: t("shipment.dgr.aircraft_cao"), value: "CAO" },
]);

// null = la sustancia va en todos los bultos (cantidad por bulto); un id = solo ese bulto.
const packageItems = computed(() => [
  { title: t("shipment.dgr.all_packages"), value: null },
  ...(packages.value ?? []).map((p, i) => ({
    title: t("shipment.dgr.package_n", { n: (p as { n_collo?: number }).n_collo ?? i + 1 }),
    value: Number((p as { id?: number | string }).id),
  })),
]);

const LITHIUM_UN = new Set(["UN3480", "UN3481", "UN3090", "UN3091"]);
function isLithium(row: DgrDeclaration): boolean {
  return !!row.un_number && LITHIUM_UN.has(row.un_number);
}

async function loadRequirements(): Promise<void> {
  if (!id.value) return;
  try {
    requirements.value = await dgrService.getRequirements(id.value);
  } catch {
    requirements.value = null;
  }
}
const loading = ref(false);
const saving = ref(false);

const transportModeItems = computed(() => [
  { title: t("shipment.dgr.mode_fr"), value: "FR" },
  { title: t("shipment.dgr.mode_lq"), value: "LQ" },
  { title: t("shipment.dgr.mode_eq"), value: "EQ" },
]);

function blankRow(): DgrDeclaration {
  return {
    id_dgr_substance: null,
    transport_mode: "FR",
    un_number: null,
    proper_shipping_name: null,
    hazard_class: null,
    packing_group: null,
    quantity_value: null,
    quantity_uom: null,
    packaging_type: null,
    packaging_count: null,
    packing_instruction: null,
    adr_transport_category: null,
    adr_tunnel_code: null,
    aircraft_limitation: null,
    lithium_section: null,
    technical_name: null,
    id_collo: null,
  };
}

function addRow(): void {
  rows.value.push(blankRow());
}
function removeRow(idx: number): void {
  rows.value.splice(idx, 1);
}

// Texto a mostrar en el autocomplete para una fila ya cargada (declaración
// existente): "UN3480 — Lithium ion batteries". Sin esto el autocomplete
// mostraría el id_dgr_substance crudo hasta que el usuario busque.
function substanceText(row: DgrDeclaration): string {
  if (!row.un_number) return "";
  return row.proper_shipping_name
    ? `${row.un_number} — ${row.proper_shipping_name}`
    : row.un_number;
}

// Al elegir una sustancia del catálogo, hereda sus campos (snapshot en la UI).
function onPick(row: DgrDeclaration, s: DgrSubstance | null): void {
  if (!s) {
    row.un_number = null;
    row.proper_shipping_name = null;
    row.hazard_class = null;
    row.packing_group = null;
    return;
  }
  row.un_number = s.un_number;
  row.proper_shipping_name = s.proper_shipping_name;
  row.hazard_class = s.hazard_class;
  row.packing_group = s.packing_group;
  row.technical_name = row.technical_name || s.technical_name;
  lqMaxById.value[s.id] = s.lq_max_per_package;
}

// Aviso cliente de que la cantidad LQ supera el máximo por bulto (el backend
// lo re-valida; aquí solo guía al usuario). Devuelve el mensaje o ''.
function lqWarning(row: DgrDeclaration): string {
  if (row.transport_mode !== "LQ" || row.id_dgr_substance == null) return "";
  const max = Number(lqMaxById.value[row.id_dgr_substance] ?? 0);
  if (!max || !row.quantity_value) return "";
  return Number(row.quantity_value) > max
    ? t("shipment.dgr.lq_exceeded", { max })
    : "";
}

// Guardable si toda fila tiene sustancia y ninguna viola el límite LQ.
const canSave = computed(() =>
  rows.value.every((r) => r.id_dgr_substance != null && !lqWarning(r)),
);

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    const existing = await dgrService.getDeclarations(id.value);
    rows.value = existing.length
      ? existing.map((r) => ({ ...blankRow(), ...r, id_collo: r.id_collo ? Number(r.id_collo) : null }))
      : [blankRow()];
    void loadRequirements();
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!id.value || !canSave.value) return;
  saving.value = true;
  try {
    // Solo filas con sustancia elegida; el POST reemplaza el conjunto.
    const payload = rows.value.filter((r) => r.id_dgr_substance != null);
    const res = await dgrService.saveDeclarations(id.value, payload);
    if (res?.success) {
      toasts.push("success", t("shipment.dgr.saved"));
      await loadRequirements();
      // Si el courier aún exige algo, el diálogo sigue abierto para completarlo.
      if (!requirements.value?.missing.length) ui.closeModal();
    } else {
      const err = res?.error;
      toasts.push("error", (typeof err === "string" ? err : (err as { message?: string } | undefined)?.message) ?? t("shipment.dgr.save_error"));
    }
  } catch (e) {
    // 422 de la validación (p. ej. régimen completo sin cantidad): se avisa y el diálogo sigue abierto.
    toasts.push("error", (e as Error)?.message || t("shipment.dgr.save_error"));
  } finally {
    saving.value = false;
  }
}

// Cargar las declaraciones cada vez que se abre el diálogo.
watch(
  () => ui.activeModal,
  (next) => {
    if (next === "dgr") void load();
  },
);
</script>

<style scoped>
.dgr-req-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.4;
}
</style>
