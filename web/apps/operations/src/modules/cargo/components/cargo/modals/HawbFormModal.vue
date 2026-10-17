<template>
  <ModalWrapper
    name="hawb_form"
    :title="t('cargo.modal.edit_hawb')"
    icon="mdi-tag-edit-outline"
    :max-width="1100"
  >
    <v-skeleton-loader v-if="!hawb" type="card, card" />

    <!-- One place to keep the whole form's field density uniform (project
         standard). Fields drop their per-field variant/hide-details and
         inherit these + the app defaults, so nothing looks oversized. -->
    <v-defaults-provider
      v-else
      :defaults="{
        VTextField: { density: 'compact' },
        VTextarea: { density: 'compact' },
        VSelect: { density: 'compact' },
        VAutocomplete: { density: 'compact' },
      }"
    >
      <!-- Identity row. NOTE: the HAWB number is NOT edited here — the legacy
           "INFORMAZIONI HOUSE AWB" form does not expose it (it is assigned
           elsewhere), so we keep parity and only edit the linked express +
           house weight. -->
      <FormSection
        :title="t('cargo.hawbform.identity')"
        icon="mdi-barcode"
        flat
      >
        <div class="d-flex ga-2">
          <v-text-field
            :model-value="String(hawb.id_spediz ?? '')"
            :label="t('cargo.hawbform.linked_express_id')"
            type="number"
            hide-details
            style="flex: 0 0 240px"
            :disabled="store.saving"
            @change="(v: string) => patch({ id_spediz: toNum(v) })"
          />
          <v-text-field
            :model-value="String(hawb.peso_house ?? '')"
            :label="t('cargo.hawbform.house_weight')"
            type="number"
            step="0.01"
            hide-details
            style="flex: 0 0 200px"
            :disabled="store.saving"
            @change="(v: string) => patch({ peso_house: toNum(v) })"
          />
        </div>
      </FormSection>

      <!-- Shipper / consignee / notify — reuses MawbAddressBlock -->
      <div class="hawb-grid">
        <MawbAddressBlock
          ref="shipperRef"
          :label="t('cargo.mawbv2.shipper')"
          icon="mdi-truck-fast-outline"
          tipo="PRS"
          :model-value="shipper"
          :readonly="store.saving"
          @field-change="(p) => onAddressFieldChange('shipper', p)"
        />
        <MawbAddressBlock
          ref="consigneeRef"
          :label="t('cargo.mawbv2.consignee')"
          icon="mdi-package-variant-closed"
          tipo="DST"
          :model-value="consignee"
          :readonly="store.saving"
          @field-change="(p) => onAddressFieldChange('consignee', p)"
        />
        <MawbAddressBlock
          ref="notifyRef"
          :label="t('cargo.mawbv2.notify')"
          icon="mdi-bell-outline"
          tipo="DST"
          :model-value="notify"
          :readonly="store.saving"
          @field-change="(p) => onAddressFieldChange('notify', p)"
        />
      </div>

      <!-- Goods description -->
      <FormSection
        :title="t('cargo.mawbv2.declaration')"
        icon="mdi-file-document-edit-outline"
        class="mt-3"
        flat
      >
        <v-textarea
          :model-value="hawb.goods_descr ?? ''"
          :label="t('cargo.hawb.goods_description')"
          variant="outlined"
          rows="2"
          auto-grow
          hide-details
          class="mb-2"
          :disabled="store.saving"
          @change="(v: string) => patch({ goods_descr: v })"
        />
        <v-textarea
          :model-value="String(hawb.mnf_descr ?? '')"
          :label="t('cargo.mawbv2.manifest_description')"
          variant="outlined"
          rows="2"
          auto-grow
          hide-details
          class="mb-2"
          :disabled="store.saving"
          @change="(v: string) => patch({ mnf_descr: v })"
        />
        <div class="d-flex ga-2">
          <v-text-field
            :model-value="String(hawb.SSR ?? '')"
            :label="t('cargo.mawbv2.ssr')"
            variant="outlined"
            hide-details
            :disabled="store.saving"
            class="flex-grow-1"
            @change="(v: string) => patch({ SSR: v })"
          />
          <v-text-field
            :model-value="String(hawb.OSI ?? '')"
            :label="t('cargo.mawbv2.osi')"
            variant="outlined"
            hide-details
            :disabled="store.saving"
            class="flex-grow-1"
            @change="(v: string) => patch({ OSI: v })"
          />
          <v-text-field
            :model-value="String(hawb.wvc ?? '')"
            :label="t('cargo.mawbv2.wvc')"
            variant="outlined"
            hide-details
            :disabled="store.saving"
            class="flex-grow-1"
            @change="(v: string) => patch({ wvc: v })"
          />
          <v-switch
            :model-value="hawb.rated_as_agreed === 'S'"
            :label="t('cargo.mawbv2.as_agreed')"
            color="primary"
            hide-details
            inset
            :disabled="store.saving"
            @change="(v: boolean) => patch({ rated_as_agreed: v ? 'S' : 'N' })"
          />
        </div>
        <v-textarea
          :model-value="String(hawb.note_interne ?? '')"
          :label="t('cargo.hawbform.internal_notes')"
          variant="outlined"
          rows="2"
          auto-grow
          hide-details
          class="mt-2"
          :disabled="store.saving"
          @change="(v: string) => patch({ note_interne: v })"
        />
      </FormSection>

      <!-- Other charges (8 structured legacy slots) — shared ListingDataView
           so the table matches the rest of the project. Slots are flat
           columns on the hawb row (oth_crg_lab_1..8 …), materialised as rows
           keyed by index. -->
      <FormSection
        :title="t('cargo.mawbv2.other_charges_18')"
        icon="mdi-cash-multiple"
        class="mt-3"
        last
        flat
      >
        <div class="hawb-charges-listing">
          <ListingDataView
            :source="chargesSource"
            :headers="chargeHeaders"
            :selected="[]"
            :mode="chargesMode"
            :sort-key-map="{}"
            :selectable="false"
          >
            <template #cell.idx="{ item }">
              <span class="text-caption text-medium-emphasis">{{
                (item as ChargeRow).id
              }}</span>
            </template>
            <!-- Voce di addebito: combobox con las voces predefinidas
                 (awb_other_charge) permitiendo texto libre — paridad legacy
                 <select> pero mejor (autocomplete). Misma UX que el MAWB. -->
            <template #cell.lab="{ item }">
              <v-combobox
                :model-value="(item as ChargeRow).lab"
                :items="otherChargeOptions"
                variant="plain"
                density="compact"
                hide-details
                :disabled="store.saving"
                @update:model-value="
                  (v: string | null) =>
                    patch({
                      [`oth_crg_lab_${(item as ChargeRow).id}`]: v ?? '',
                    })
                "
              />
            </template>
            <!-- Opzione: Agente (A) / Transportista (C) — legacy $pll_oth_crg_opz. -->
            <template #cell.opz="{ item }">
              <v-select
                :model-value="(item as ChargeRow).opz"
                :items="OTH_CRG_OPZ_ITEMS"
                variant="plain"
                density="compact"
                hide-details
                clearable
                :disabled="store.saving"
                @update:model-value="
                  (v: string | null) =>
                    patch({
                      [`oth_crg_opz_${(item as ChargeRow).id}`]: v ?? '',
                    })
                "
              />
            </template>
            <template #cell.val="{ item }">
              <v-text-field
                :model-value="(item as ChargeRow).val"
                type="number"
                step="0.01"
                variant="plain"
                density="compact"
                hide-details
                class="text-right"
                :disabled="store.saving"
                @change="
                  (v: string) =>
                    patch({
                      [`oth_crg_val_${(item as ChargeRow).id}`]: toNum(v) ?? '',
                    })
                "
              />
            </template>
          </ListingDataView>
        </div>
      </FormSection>
    </v-defaults-provider>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoHawbStore } from "@cargo/stores/cargo_hawb.store";
import { useCargoMawbStore } from "@cargo/stores/cargo_mawb.store";
import type { HawbPatch, HawbRow } from "@cargo/services/cargo_hawb.service";
import type { MawbAddress } from "@cargo/services/cargo_mawb.types";
import ModalWrapper from "./ModalWrapper.vue";
import MawbAddressBlock from "../mawb/MawbAddressBlock.vue";
import FormSection from "@shared/ui/FormSection.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const { id: cargoId } = storeToRefs(cargoStore);
const store = useCargoHawbStore();
const mawbStore = useCargoMawbStore();

/**
 * Voces predefinidas para el combobox de "Other charges" (tabla global
 * awb_other_charge). Se reutilizan las que ya trae el MAWB del mismo cargo
 * (`_other_charge_options`): la lista es idéntica para MAWB y HAWB.
 */
const otherChargeOptions = computed<string[]>(
  () => mawbStore.mawb?._other_charge_options ?? [],
);

// Si el HAWB se abre sin que el MAWB del cargo esté cargado, las voces del
// combobox estarían vacías. Se asegura la carga (GET puro, sin efectos) al
// abrir el modal si aún no hay opciones. El combobox funciona como texto libre
// mientras tanto, así que esto solo enriquece las sugerencias.
watch(
  () => ui.activeModal,
  (active) => {
    if (
      active === "hawb_form" &&
      otherChargeOptions.value.length === 0 &&
      !mawbStore.loading &&
      Number(cargoId.value) > 0
    ) {
      void mawbStore.load(Number(cargoId.value));
    }
  },
  { immediate: true },
);

/**
 * Columna "Opzione" — legacy `$pll_oth_crg_opz`: A=Agente, C=Transportista
 * (a qué bucket del AWB se debe el importe). Se persiste tal cual.
 */
const OTH_CRG_OPZ_ITEMS = computed(() => [
  { title: t("cargo.mawbv2.due_agent"), value: "A" },
  { title: t("cargo.mawbv2.due_carrier"), value: "C" },
]);

/**
 * `ui.pendingHawbId` is set right before `openModal('hawb_form')` by the
 * HAWB list's row "edit" buttons. When the modal opens without a pending id,
 * the parent should redirect to the list instead.
 */
const hawb = computed<HawbRow | null>(() => {
  const targetId = ui.pendingHawbId;
  if (!targetId) return null;
  return store.rows.find((r) => Number(r.id) === Number(targetId)) ?? null;
});

// Other-charges table: the 8 fixed slots are flat columns on the hawb row;
// materialise them as rows for the shared ListingDataView (id = slot 1..8).
interface ChargeRow {
  id: number;
  lab: string;
  opz: string;
  val: string;
}
const chargeRows = computed<ChargeRow[]>(() => {
  const h = hawb.value;
  return Array.from({ length: 8 }, (_, k) => {
    const i = k + 1;
    return {
      id: i,
      lab: String(h?.[`oth_crg_lab_${i}`] ?? ""),
      opz: String(h?.[`oth_crg_opz_${i}`] ?? ""),
      val: String(h?.[`oth_crg_val_${i}`] ?? ""),
    };
  });
});
const chargeHeaders = computed(() => [
  { title: "#", key: "idx", sortable: false, width: 40 },
  { title: t("cargo.col.description"), key: "lab", sortable: false },
  { title: t("cargo.col.code"), key: "opz", sortable: false, width: 140 },
  {
    title: t("cargo.mawbv2.value"),
    key: "val",
    sortable: false,
    width: 140,
    align: "end" as const,
  },
]);
const chargesMode = useListViewMode("tmwe:hawb-charges-view-mode", "infinite");
const chargesSource = useClientSideListSource<ChargeRow>(
  () => chargeRows.value,
  {
    mode: () => chargesMode.value,
  },
);

/**
 * Build a MawbAddress from the hawb row's prefixed columns.
 *
 * Exposed through three memoised `computed`s (below) rather than called
 * straight from the template: a template call re-runs on every render and
 * returns a NEW object each time, whose changed reference re-fires
 * MawbAddressBlock's shallow `modelValue` watch and clobbers the field the
 * operator is mid-typing — which read as "the inputs won't accept text".
 */
function addressFor(prefix: "shipper" | "consignee" | "notify"): MawbAddress {
  const h = hawb.value;
  if (!h) return { nome: "", adress: "", citta: "", id_paese_iso: "" };
  return {
    nome: String(h[`${prefix}_nome`] ?? ""),
    adress: String(h[`${prefix}_address`] ?? ""),
    cap: (h[`${prefix}_cap`] as string | null) ?? null,
    citta: String(h[`${prefix}_citta`] ?? ""),
    prov: (h[`${prefix}_prov`] as string | null) ?? null,
    id_paese_iso: String(h[`${prefix}_paese`] ?? ""),
    attenzione: (h[`${prefix}_attne`] as string | null) ?? null,
    tel: (h[`${prefix}_tel`] as string | null) ?? null,
    mail: (h[`${prefix}_mail`] as string | null) ?? null,
  };
}

const shipper = computed(() => addressFor("shipper"));
const consignee = computed(() => addressFor("consignee"));
const notify = computed(() => addressFor("notify"));

// Refs to each block so we can release its dirty flags once the parent has
// persisted a field — mirrors MawbAddressesTab, otherwise a field stays
// "owned" locally forever and later server refreshes never reach it.
type AddressBlockExposed = {
  releaseField: (f: keyof MawbAddress) => void;
  releaseAll: () => void;
};
const shipperRef = ref<AddressBlockExposed | null>(null);
const consigneeRef = ref<AddressBlockExposed | null>(null);
const notifyRef = ref<AddressBlockExposed | null>(null);

function blockRef(
  prefix: "shipper" | "consignee" | "notify",
): AddressBlockExposed | null {
  if (prefix === "shipper") return shipperRef.value;
  if (prefix === "consignee") return consigneeRef.value;
  return notifyRef.value;
}

/**
 * Coerce a text-field value to a number for a nullable numeric column.
 * Empty → null; a non-numeric entry → null (never NaN, which the backend
 * would reject or silently persist as 0).
 */
function toNum(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function patch(body: HawbPatch): Promise<void> {
  if (!cargoId.value || !hawb.value) return;
  await store.update(Number(cargoId.value), Number(hawb.value.id), body);
}

async function onAddressFieldChange(
  prefix: "shipper" | "consignee" | "notify",
  { field, value }: { field: keyof MawbAddress; value: string },
): Promise<void> {
  const columnMap: Record<keyof MawbAddress, string> = {
    nome: `${prefix}_nome`,
    adress: `${prefix}_address`,
    cap: `${prefix}_cap`,
    citta: `${prefix}_citta`,
    prov: `${prefix}_prov`,
    id_paese_iso: `${prefix}_paese`,
    attenzione: `${prefix}_attne`,
    tel: `${prefix}_tel`,
    mail: `${prefix}_mail`,
  };
  const col = columnMap[field];
  if (!col) return;
  await patch({ [col]: value });
  // Persisted: hand the field back to server refreshes (drops the local
  // "dirty" hold so the next reload can update it again).
  blockRef(prefix)?.releaseField(field);
}
</script>

<style scoped>
.hawb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

/* Other-charges table adapted for the modal: bound height, non-clickable
   rows, compact plain inputs — same treatment as the other cargo lists. */
.hawb-charges-listing {
  display: flex;
  flex-direction: column;
  max-height: 40vh;
  min-height: 160px;
}
.hawb-charges-listing :deep(.sdv-tr) {
  cursor: default;
}
.hawb-charges-listing :deep(.sdv-tr:hover) {
  transform: none;
  box-shadow: none;
}
.hawb-charges-listing :deep(td .v-input) {
  --v-input-padding-top: 0;
  margin-top: 0;
}
.hawb-charges-listing :deep(td .v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: 28px;
}
</style>
