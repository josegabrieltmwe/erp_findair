<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-confirm">
    <v-card-text class="carrier-confirm">
      <v-checkbox
        v-model="form.confirmPrice"
        :label="t('cargo.carrierOffer.confirm_price', { total })"
        hide-details
        density="comfortable"
        data-testid="carrier-confirm-price"
      />
      <v-checkbox
        v-model="form.confirmTerms"
        :label="t('cargo.carrierOffer.confirm_terms')"
        hide-details
        density="comfortable"
        data-testid="carrier-confirm-terms"
      />
      <v-alert v-if="message" type="error" variant="tonal" density="compact" class="mt-2" data-testid="carrier-send-error">{{ message }}</v-alert>
      <div class="carrier-confirm__actions">
        <v-btn color="primary" size="large" :loading="sending" :disabled="sending" data-testid="carrier-send" @click="$emit('send')">
          {{ t("cargo.carrierOffer.send") }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { QuoteForm } from "@cargo/composables/carrierOfferForm";

defineProps<{ form: QuoteForm; total: string; sending: boolean; message: string }>();
defineEmits<{ (e: "send"): void }>();
const { t } = useI18n();
</script>

<style scoped lang="scss">
.carrier-confirm { display: flex; flex-direction: column; }
.carrier-confirm__actions { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
