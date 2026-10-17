<template>
  <FormSection
    :title="t('cargo.mawbv2.declaration')"
    icon="mdi-file-document-edit-outline"
    flat
  >
    <v-row dense>
      <v-col cols="12" md="6">
        <v-textarea
          :model-value="draft.displayValue('goods_descr', mawb.goods_descr)"
          :label="t('cargo.hawb.goods_description')"
          density="compact"
          rows="2"
          auto-grow
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('goods_descr', v)"
          @blur="emit('commit', 'goods_descr')"
        />
        <MawbTagInserter
          :items="GOODS_DESCR_TAGS"
          :disabled="locked"
          @insert="
            (p) =>
              emit('append-tag', { field: 'goods_descr', phrase: p, sep: ' ' })
          "
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea
          :model-value="draft.displayValue('mnf_descr', mawb.mnf_descr)"
          :label="t('cargo.mawbv2.manifest_description')"
          density="compact"
          rows="2"
          auto-grow
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('mnf_descr', v)"
          @blur="emit('commit', 'mnf_descr')"
        />
        <MawbTagInserter
          :items="MNF_DESCR_TAGS"
          :disabled="locked"
          @insert="
            (p) =>
              emit('append-tag', { field: 'mnf_descr', phrase: p, sep: ' ' })
          "
        />
      </v-col>

      <!-- SSR / OSI: both carry a tag inserter, so they pair as equals (6+6)
           and their bottoms line up. handling_SCI has no inserter, so it goes
           on its own row instead of leaving a ragged gap beside them. -->
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="draft.displayValue('SSR', mawb.SSR)"
          :label="t('cargo.mawbv2.ssr')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('SSR', v)"
          @blur="emit('commit', 'SSR')"
        />
        <MawbTagInserter
          :items="SSR_TAGS"
          :disabled="locked"
          @insert="
            (p) => emit('append-tag', { field: 'SSR', phrase: p, sep: ', ' })
          "
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="draft.displayValue('OSI', mawb.OSI)"
          :label="t('cargo.mawbv2.osi')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('OSI', v)"
          @blur="emit('commit', 'OSI')"
        />
        <MawbTagInserter
          :items="OSI_TAGS"
          :disabled="locked"
          @insert="
            (p) => emit('append-tag', { field: 'OSI', phrase: p, sep: ', ' })
          "
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          :model-value="draft.displayValue('handling_SCI', mawb.handling_SCI)"
          :label="t('cargo.mawbv2.handling_sci')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('handling_SCI', v)"
          @blur="emit('commit', 'handling_SCI')"
        />
      </v-col>
      <v-col cols="12" md="6" />
    </v-row>
  </FormSection>

  <FormSection
    :title="t('cargo.mawbv2.tact_rate')"
    icon="mdi-cash-multiple"
    flat
  >
    <!-- Uniform 4+4+4: three equal columns per row, so every field in this
         section shares one width and the row bottoms align. -->
    <v-row dense>
      <v-col cols="12" md="4">
        <MawbTactField
          :cargo-id="cargoId"
          :tact="mawb.TACT"
          :disabled="locked"
          @update:tact="(v) => emit('patch', { TACT: v ?? '' })"
          @looked-up="emit('tact-looked-up')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          :model-value="
            draft.displayValue('TACT_MinimumCharge', mawb.TACT_MinimumCharge)
          "
          :label="t('cargo.mawbv2.tact_min_charge')"
          type="number"
          step="0.01"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('TACT_MinimumCharge', v)
          "
          @blur="commitNumber('TACT_MinimumCharge')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <!-- The switch is not an input box: given its own cell it keeps the
             row height instead of dragging the baseline of its neighbours. -->
        <div class="tact-switch">
          <v-switch
            :model-value="mawb.rated_as_agreed === 'S'"
            :label="t('cargo.mawbv2.as_agreed')"
            color="primary"
            density="compact"
            hide-details
            inset
            :disabled="locked"
            @update:model-value="
              (v: boolean | null) =>
                emit('patch', { rated_as_agreed: v ? 'S' : 'N' })
            "
          />
        </div>
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          :model-value="mawb.wvc ?? ''"
          :items="PAYMENT_MODE_ITEMS"
          :label="t('cargo.mawbv2.wvc')"
          density="compact"
          hide-details
          clearable
          :disabled="locked"
          @update:model-value="
            (v: string | null) => emit('patch', { wvc: v ?? '' })
          "
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          :model-value="mawb.oth_crg ?? ''"
          :items="PAYMENT_MODE_ITEMS"
          :label="t('cargo.mawbv2.other_charges')"
          density="compact"
          hide-details
          clearable
          :disabled="locked"
          @update:model-value="
            (v: string | null) => emit('patch', { oth_crg: v ?? '' })
          "
        />
      </v-col>
      <v-col cols="12" md="4" />
    </v-row>
  </FormSection>

  <FormSection
    :title="t('cargo.mawbv2.values_and_notes')"
    icon="mdi-shield-check-outline"
    last
    flat
  >
    <v-row dense>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="
            draft.displayValue(
              'declared_val_carriage',
              mawb.declared_val_carriage,
            )
          "
          :label="t('cargo.mawbv2.declared_val_carriage')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('declared_val_carriage', v)
          "
          @blur="emit('commit', 'declared_val_carriage')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="
            draft.displayValue(
              'declared_val_customs',
              mawb.declared_val_customs,
            )
          "
          :label="t('cargo.mawbv2.declared_val_customs')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('declared_val_customs', v)
          "
          @blur="emit('commit', 'declared_val_customs')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea
          :model-value="draft.displayValue('accounting', mawb.accounting)"
          :label="t('cargo.mawbv2.accounting_info')"
          density="compact"
          rows="2"
          auto-grow
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('accounting', v)"
          @blur="emit('commit', 'accounting')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea
          :model-value="draft.displayValue('note_interne', mawb.note_interne)"
          :label="t('cargo.mawbv2.internal_notes')"
          density="compact"
          rows="2"
          auto-grow
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('note_interne', v)"
          @blur="emit('commit', 'note_interne')"
        />
      </v-col>
    </v-row>
  </FormSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";
import MawbTagInserter from "../MawbTagInserter.vue";
import MawbTactField from "../MawbTactField.vue";
import type {
  CargoMawb,
  CargoMawbPatch,
} from "@cargo/services/cargo_mawb.types";
import type { MawbFieldDraft } from "@cargo/composables/useMawbFieldDraft";

const props = defineProps<{
  mawb: CargoMawb;
  draft: MawbFieldDraft;
  locked: boolean;
  cargoId: number;
}>();

const emit = defineEmits<{
  (e: "commit", field: string): void;
  (e: "patch", patch: CargoMawbPatch): void;
  (
    e: "append-tag",
    payload: { field: string; phrase: string; sep: string },
  ): void;
  (e: "tact-looked-up"): void;
}>();

const { t } = useI18n();

/** Payment-mode options — paridad legacy `$pll_wvc` / `$pll_oth_crg`. */
const PAYMENT_MODE_ITEMS = ["Prepaid", "Charge Collect"];

/**
 * "INSERT THIS TAG" predefined phrases — paridad exacta con
 * `spedyc_mawb_form.php`.
 */
const SSR_TAGS = [
  "DO NOT FEED",
  "MAINTAIN TEMPERATURE BETWEEN 2-5 DEGREES CELSIUS",
  "LITHIUM METAL BATTERIES NOT RESTRICTED AS PER PI969 II",
];
const OSI_TAGS = [
  "SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTATCHED",
  "5 PACKAGES DANGEROUS GOODS AS PER ATTACHED DGD - CAO",
];
const GOODS_DESCR_TAGS = ["CONSOLIDATION AS PER MANIFEST", "HS CODE"];
const MNF_DESCR_TAGS = ["GENERAL CARGO", "SPARE PARTS"];

/** Numeric commit — legacy stores TACT min charge as a decimal. */
function commitNumber(field: string): void {
  const raw = props.draft.displayValue(field, props.mawb[field]);
  emit("patch", { [field]: raw === "" ? "" : Number(raw) });
}
</script>

<style scoped>
/* Match the switch's optical height to a compact input so it sits on the
   same baseline as the fields beside it. */
.tact-switch {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding-inline-start: 4px;
}
</style>
