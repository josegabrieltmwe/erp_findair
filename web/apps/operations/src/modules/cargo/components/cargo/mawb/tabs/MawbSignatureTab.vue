<template>
  <FormSection
    :title="t('cargo.mawbv2.signature_execution')"
    icon="mdi-pen"
    last
    flat
  >
    <v-row dense>
      <!-- Three peer fields share one width (4+4+4) instead of 5+4+3. -->
      <v-col cols="12" md="4">
        <v-text-field
          :model-value="
            draft.displayValue('signature_ragsoc', mawb.signature_ragsoc)
          "
          :label="t('cargo.mawbv2.issuing_party')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('signature_ragsoc', v)
          "
          @blur="emit('commit', 'signature_ragsoc')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          :model-value="
            draft.displayValue('signature_agent', mawb.signature_agent)
          "
          :label="t('cargo.mawbv2.agent_name')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('signature_agent', v)
          "
          @blur="emit('commit', 'signature_agent')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <!-- Date input: commit on change, there is no meaningful "typing"
             state for a native picker. -->
        <v-text-field
          :model-value="mawb.executed_date ?? ''"
          :label="t('cargo.mawbv2.executed_on')"
          type="date"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => emit('patch', { executed_date: v })
          "
        />
      </v-col>
    </v-row>
  </FormSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";
import type {
  CargoMawb,
  CargoMawbPatch,
} from "@cargo/services/cargo_mawb.types";
import type { MawbFieldDraft } from "@cargo/composables/useMawbFieldDraft";

defineProps<{
  mawb: CargoMawb;
  draft: MawbFieldDraft;
  locked: boolean;
}>();

const emit = defineEmits<{
  (e: "commit", field: string): void;
  (e: "patch", patch: CargoMawbPatch): void;
}>();

const { t } = useI18n();
</script>
