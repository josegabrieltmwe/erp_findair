<template>
  <ModalWrapper
    name="cliente"
    :title="t('shipment.modals.cliente.title')"
    icon="mdi-account-outline"
    size="sm"
  >
    <FormSection
      :title="t('common.sections.identification')"
      icon="mdi-account-outline"
      flat
    >
      <v-row dense>
        <v-col cols="12" md="8">
          <v-text-field
            v-model="cliente.local"
            :label="t('shipment.modals.cliente.cliente')"
            @blur="cliente.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="rif.local"
            :label="t('shipment.modals.cliente.customer_rif')"
            placeholder="—"
            @blur="rif.commit"
          />
        </v-col>
      </v-row>
    </FormSection>

    <FormSection
      :title="t('common.sections.location')"
      icon="mdi-office-building-outline"
      flat
      last
    >
      <v-text-field
        v-model="sedeName.local"
        :label="t('shipment.modals.cliente.ufficio')"
        @blur="sedeName.commit"
      />
    </FormSection>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();

// Bind directly to the shipment store. Edits are buffered in the store draft
// (opened by ModalWrapper); the wrapper's default Annulla/Salva footer
// validates and persists the whole draft on Salva.
const cliente = useFieldBinding("cliente", "");
const rif = useFieldBinding("rif_cliente", "");
const sedeName = useFieldBinding("sed_label", "");
</script>
