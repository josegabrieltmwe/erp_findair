<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-check-decagram-outline" size="18" class="me-2" />
      {{ t("cargo.delivery.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="consegnaStato.local"
            :label="t('cargo.delivery.status')"
            @blur="consegnaStato.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="consegnaData.local"
            :label="t('cargo.delivery.delivered_datetime')"
            @blur="consegnaData.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="consegnaFirma.local"
            :label="t('cargo.delivery.signature')"
            @blur="consegnaFirma.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn
            variant="text"
            prepend-icon="mdi-package-variant-closed-check"
            :href="trackingUrl"
            target="_blank"
          >
            {{ t("cargo.delivery.tracking") }}
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";

const { t } = useI18n();
const store = useCargoStore();
const { id } = storeToRefs(store);

const consegnaStato = useFieldBinding("consegna_stato", "");
const consegnaData = useFieldBinding("consegna_data", "");
const consegnaFirma = useFieldBinding("consegna_firma", "");

const trackingUrl = computed(() =>
  id.value
    ? `/erp/tmwe_json/get-tracking-list?id=${id.value}&modality=cargo`
    : "#",
);
</script>
