<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-receipt">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.receipt_title") }}</v-card-title>
    <v-card-text>
      <div class="carrier-receipt">
        <v-btn :href="links.pdf()" download variant="outlined" size="small" prepend-icon="mdi-file-pdf-box" data-testid="carrier-pdf">
          {{ t("cargo.carrierOffer.receipt_pdf") }}
        </v-btn>
        <v-btn variant="outlined" size="small" prepend-icon="mdi-email-outline" :loading="sending" :disabled="sending" data-testid="carrier-mail-copy" @click="send">
          {{ t("cargo.carrierOffer.receipt_mail") }}
        </v-btn>
      </div>
      <v-alert v-if="sentTo" type="success" variant="tonal" density="compact" class="mt-3" data-testid="carrier-copy-sent">{{ t("cargo.carrierOffer.receipt_sent", { to: sentTo }) }}</v-alert>
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3" role="alert" data-testid="carrier-copy-error">{{ error }}</v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@tmwe/shared-frontend/http";
import { carrierOfferLinks, carrierOfferService } from "@cargo/services/carrier_offer.service";
import { copyErrorKey } from "@cargo/composables/carrierOfferFiles";

/**
 * Constancia de la respuesta (legado: «descargar el PDF» o «recibirlo por correo»). El PDF lo genera el servidor; la copia por correo
 * va SIEMPRE al contacto registrado de la aerolínea: aquí no se escribe ninguna dirección.
 */
const { t } = useI18n();
const links = carrierOfferLinks;
const sending = ref(false);
const sentTo = ref("");
const error = ref("");

async function send(): Promise<void> {
  sending.value = true;
  sentTo.value = "";
  error.value = "";
  try {
    const res = await carrierOfferService.sendPdfCopy();
    sentTo.value = res.sent_to ?? "";
    if (!res.success) error.value = t("cargo.carrierOffer.receipt_err");
  } catch (e) {
    error.value = t(`cargo.carrierOffer.${copyErrorKey(e instanceof ApiError ? e.errorCode : undefined)}`);
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-receipt { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
