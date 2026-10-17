<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-receipt-text-edit-outline" size="18" class="me-2" />
      {{ t("cargo.post_invoice.title") }}
      <v-chip
        v-if="postFatturated"
        size="x-small"
        color="warning"
        variant="tonal"
        class="ms-2"
      >
        #{{ cargo?.id_fattura_a2 }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />
    <component :is="textWrapper">
      <!-- Legacy spedyc_form.php box `pfattz`: the extra charge + free-text note
           for a second (post-) invoice. Both lock once id_fattura_a2 > 0
           (useCargoState.readonly), mirroring the legacy giafatt guard. -->
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="caricoExtra.local"
            :label="t('cargo.post_invoice.extra_charge')"
            type="number"
            min="0"
            step="0.01"
            :readonly="readonly('carico_extra')"
            :hint="t('cargo.post_invoice.extra_charge_hint')"
            persistent-hint
            @blur="caricoExtra.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="cargo?.id_fattura_a2 || '—'"
            :label="t('cargo.post_invoice.post_invoice_id')"
            readonly
            hint="spedizioni_cargo.id_fattura_a2"
            persistent-hint
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="postfattTxt.local"
            :label="t('cargo.post_invoice.postfatt_desc')"
            rows="3"
            auto-grow
            :readonly="readonly('postfatt_txt')"
            :hint="t('cargo.post_invoice.postfatt_desc_hint')"
            persistent-hint
            @blur="postfattTxt.commit"
          />
        </v-col>
      </v-row>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";
import { VCard, VCardText } from "vuetify/components";

const { t } = useI18n();
const props = defineProps<{ embedded?: boolean }>();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly, postFatturated } = useCargoState(cargo);

const caricoExtra = useFieldBinding("carico_extra", "0", { numeric: true });
const postfattTxt = useFieldBinding("postfatt_txt", "");

const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>
