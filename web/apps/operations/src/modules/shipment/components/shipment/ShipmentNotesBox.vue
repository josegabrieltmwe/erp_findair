<template>
  <!-- embedded: the host ModalWrapper already provides the dialog card + title. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-note-text-outline" class="me-2" />
      {{ t("shipment.modals.note.box_title") }}
    </v-card-title>
    <component :is="embedded ? 'div' : VCardText">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-textarea
            v-model="note.local"
            :label="t('shipment.modals.note.internal')"
            rows="3"
            auto-grow
            @blur="note.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-textarea
            v-model="noteOperative.local"
            :label="t('shipment.modals.note.operative')"
            rows="3"
            auto-grow
            @blur="noteOperative.commit"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="noteXdestin.local"
            :label="t('shipment.modals.note.destination')"
            rows="2"
            auto-grow
            @blur="noteXdestin.commit"
          />
        </v-col>
      </v-row>
    </component>
  </component>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { VCard, VCardText } from "vuetify/components";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();

const note = useFieldBinding("note", "");
const noteOperative = useFieldBinding("note_operative", "");
const noteXdestin = useFieldBinding("note_x_destin", "");
</script>
