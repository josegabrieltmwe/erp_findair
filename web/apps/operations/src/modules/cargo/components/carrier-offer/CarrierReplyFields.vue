<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-reply-form">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.reply_form_title") }}</v-card-title>
    <v-card-text class="carrier-fields">
      <v-textarea
        v-model="form.note"
        :label="t('cargo.carrierOffer.note_label')"
        :error-messages="message('note', NOTE_MAX)"
        :counter="NOTE_MAX"
        rows="4"
        auto-grow
        variant="outlined"
        density="comfortable"
        data-testid="carrier-note-input"
      />
      <v-textarea
        v-model="form.schedule"
        :label="t('cargo.carrierOffer.schedule_label')"
        :error-messages="message('schedule', SCHEDULE_MAX)"
        :counter="SCHEDULE_MAX"
        rows="3"
        auto-grow
        variant="outlined"
        density="comfortable"
        data-testid="carrier-schedule-input"
      />
      <v-text-field
        v-model="form.reference"
        :label="t('cargo.carrierOffer.reference_label')"
        :error-messages="message('reference', REFERENCE_MAX)"
        :counter="REFERENCE_MAX"
        variant="outlined"
        density="comfortable"
        data-testid="carrier-reference-input"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NOTE_MAX, REFERENCE_MAX, SCHEDULE_MAX, type QuoteForm } from "@cargo/composables/carrierOfferForm";

const props = defineProps<{ form: QuoteForm; errors: Record<string, string> }>();
const { t } = useI18n();

function message(field: string, max: number): string[] {
  const key = props.errors[field];
  return key ? [t(`cargo.carrierOffer.${key}`, { max })] : [];
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-fields { display: flex; flex-direction: column; gap: 4px; }
</style>
