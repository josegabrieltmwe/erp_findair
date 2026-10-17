<template>
  <FormSection
    :title="t('cargo.mawbv2.other_charges_18')"
    icon="mdi-cash-multiple"
    last
    flat
  >
    <!-- Shared listing (same component as the other cargo lists) so the AWB's
         8 fixed "other charge" slots render in the project style. The slots
         are flat columns on `mawb` (oth_crg_lab_1..8 …), materialised here as
         8 rows keyed by their index. -->
    <div class="mawb-charges-listing">
      <ListingDataView
        :source="listSource"
        :headers="headers"
        :selected="[]"
        :mode="viewMode"
        :sort-key-map="sortKeyMap"
        :selectable="false"
      >
        <template #cell.idx="{ item }">
          <span class="text-caption text-medium-emphasis">{{
            (item as ChargeRow).id
          }}</span>
        </template>

        <template #cell.lab="{ item }">
          <v-combobox
            :model-value="(item as ChargeRow).lab"
            :items="options"
            density="compact"
            variant="plain"
            hide-details
            :disabled="locked"
            @update:model-value="
              (v: string | null) =>
                emit('patch', {
                  [`oth_crg_lab_${(item as ChargeRow).id}`]: v ?? '',
                })
            "
          />
        </template>

        <template #cell.opz="{ item }">
          <v-select
            :model-value="(item as ChargeRow).opz"
            :items="OTH_CRG_OPZ_ITEMS"
            density="compact"
            variant="plain"
            hide-details
            clearable
            :disabled="locked"
            @update:model-value="
              (v: string | null) =>
                emit('patch', {
                  [`oth_crg_opz_${(item as ChargeRow).id}`]: v ?? '',
                })
            "
          />
        </template>

        <template #cell.val="{ item }">
          <v-text-field
            :model-value="
              draft.displayValue(
                `oth_crg_val_${(item as ChargeRow).id}`,
                mawb[`oth_crg_val_${(item as ChargeRow).id}`] as
                  | string
                  | number
                  | null,
              )
            "
            type="number"
            step="0.01"
            density="compact"
            variant="plain"
            hide-details
            class="text-right"
            :disabled="locked"
            @update:model-value="
              (v: string) =>
                draft.setDraft(`oth_crg_val_${(item as ChargeRow).id}`, v)
            "
            @blur="commitValue((item as ChargeRow).id)"
          />
        </template>
      </ListingDataView>
    </div>
  </FormSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import type {
  CargoMawb,
  CargoMawbPatch,
} from "@cargo/services/cargo_mawb.types";
import type { MawbFieldDraft } from "@cargo/composables/useMawbFieldDraft";

const props = defineProps<{
  mawb: CargoMawb;
  draft: MawbFieldDraft;
  locked: boolean;
  options: string[];
}>();

const emit = defineEmits<{
  (e: "patch", patch: CargoMawbPatch): void;
}>();

const { t } = useI18n();

/**
 * "Other charges" option column — legacy `$pll_oth_crg_opz`: A=Agent,
 * C=Carrier (which AWB bucket the amount is due to). Persisted verbatim.
 */
const OTH_CRG_OPZ_ITEMS = computed(() => [
  { title: t("cargo.mawbv2.due_agent"), value: "A" },
  { title: t("cargo.mawbv2.due_carrier"), value: "C" },
]);

// The 8 fixed slots are flat columns on `mawb`; materialise them as rows keyed
// by index so the shared ListingDataView can render them. `id` doubles as the
// slot number (1..8) used to build the oth_crg_* field names on edit.
interface ChargeRow {
  id: number;
  lab: string;
  opz: string;
}
const rows = computed<ChargeRow[]>(() =>
  Array.from({ length: 8 }, (_, k) => {
    const i = k + 1;
    return {
      id: i,
      lab: String(props.mawb[`oth_crg_lab_${i}`] ?? ""),
      opz: String(props.mawb[`oth_crg_opz_${i}`] ?? ""),
    };
  }),
);

const headers = computed(() => [
  { title: "#", key: "idx", sortable: false, width: 40 },
  { title: t("cargo.col.description"), key: "lab", sortable: false },
  { title: t("cargo.col.code"), key: "opz", sortable: false, width: 160 },
  {
    title: t("cargo.mawbv2.value"),
    key: "val",
    sortable: false,
    width: 140,
    align: "end" as const,
  },
]);
const sortKeyMap: Record<string, string> = {};
const viewMode = useListViewMode("tmwe:mawb-charges-view-mode", "infinite");
const listSource = useClientSideListSource<ChargeRow>(() => rows.value, {
  mode: () => viewMode.value,
});

/** Numeric commit: empty stays empty, otherwise cast (legacy stores decimals). */
function commitValue(i: number): void {
  const field = `oth_crg_val_${i}`;
  const raw = props.draft.displayValue(field, props.mawb[field]);
  emit("patch", { [field]: raw === "" ? "" : Number(raw) });
}
</script>

<style scoped>
/* The shared ListingDataView owns the visual style. Adapt only for the
   editable in-tab list: cap height, drop the record-link affordance, and
   keep the plain inline inputs compact within the shared cell padding. */
.mawb-charges-listing {
  display: flex;
  flex-direction: column;
  max-height: 48vh;
  min-height: 200px;
}
.mawb-charges-listing :deep(.sdv-tr) {
  cursor: default;
}
.mawb-charges-listing :deep(.sdv-tr:hover) {
  transform: none;
  box-shadow: none;
}
.mawb-charges-listing :deep(td .v-input) {
  --v-input-padding-top: 0;
  margin-top: 0;
}
.mawb-charges-listing :deep(td .v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: 28px;
}
</style>
