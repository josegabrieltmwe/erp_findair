<template>
  <!-- embedded: the host ModalWrapper already provides the dialog card + title. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title v-if="!embedded" class="d-flex align-center"
      ><v-icon icon="mdi-receipt-text-edit-outline" class="me-2" />
      {{ t("shipment.modals.post_invoice.box_title") }}</v-card-title
    >
    <component
      :is="embedded ? 'div' : VCardText"
      :class="embedded ? '' : 'pa-3'"
    >
      <!-- 1. Recargo post-factura (importe extra facturado tras la emisión). -->
      <FormSection
        :title="t('shipment.modals.post_invoice.sec_recharge')"
        icon="mdi-cash-plus"
        flat
      >
        <template #actions>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-cash-refund"
            :disabled="!id"
            @click="ui.openModal('riaddebito')"
          >
            {{ t("shipment.modals.post_invoice.apply_recharge") }}
          </v-btn>
        </template>
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="postfatt.local"
              :label="t('shipment.modals.post_invoice.postfatt')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              :readonly="readonly('postfatt')"
              @blur="postfatt.commit"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="postFuelSurc.local"
              :label="t('shipment.modals.post_invoice.post_fuel')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              :readonly="readonly('post_fuel_surc')"
              @blur="postFuelSurc.commit"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="postfattTxt.local"
              :label="t('shipment.modals.post_invoice.postfatt_desc')"
              rows="2"
              auto-grow
              density="compact"
              :hint="t('shipment.modals.post_invoice.postfatt_desc_hint')"
              persistent-hint
              :readonly="readonly('postfatt_txt')"
              @blur="postfattTxt.commit"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- 2. Datos reales del proveedor (reconciliación post-booking). -->
      <FormSection
        :title="t('shipment.modals.post_invoice.sec_supplier_real')"
        icon="mdi-truck-check-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="costoReale.local"
              :label="t('shipment.modals.post_invoice.real_cost')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              @blur="costoReale.commit"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="fuelSurcCst.local"
              :label="t('shipment.modals.post_invoice.fuel_cost')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              @blur="fuelSurcCst.commit"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="pesoFornitReale.local"
              :label="t('shipment.modals.post_invoice.real_supplier_weight')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              @blur="pesoFornitReale.commit"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="controlloFatt.local"
              :items="controlloFattItems"
              :label="t('shipment.modals.post_invoice.invoice_control')"
              density="compact"
              :readonly="readonly('controllo_fatt')"
              @update:model-value="controlloFatt.commit"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- 3. Referencias de factura (solo lectura). -->
      <FormSection
        :title="t('shipment.modals.post_invoice.sec_invoice_refs')"
        icon="mdi-file-document-outline"
        flat
        last
      >
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field
              :model-value="shipment?.id_fattura_a || '—'"
              :label="t('shipment.modals.post_invoice.client_invoice_id')"
              readonly
              density="compact"
              hint="spedizioni.id_fattura_a"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              :model-value="shipment?.id_fattura_a2 || '—'"
              :label="t('shipment.modals.post_invoice.post_invoice_id')"
              readonly
              density="compact"
              hint="spedizioni.id_fattura_a2"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              :model-value="shipment?.id_fattura_p || '—'"
              :label="t('shipment.modals.post_invoice.supplier_invoice_id')"
              readonly
              density="compact"
              hint="spedizioni.id_fattura_p"
              persistent-hint
            />
          </v-col>
        </v-row>
      </FormSection>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard, VCardText } from "vuetify/components";
import FormSection from "@shared/ui/FormSection.vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { useUiStore } from "@shipment/stores/ui.store";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, id } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);
const ui = useUiStore();

// post_fuel_surc and postfatt_txt are not in the typed Shipment payload (legacy
// columns surface only when present). We bind by string key and accept the
// runtime types.
const postfatt = useFieldBinding("postfatt" as never, "0" as never);
const postFuelSurc = useFieldBinding("post_fuel_surc" as never, "0" as never);
const postfattTxt = useFieldBinding("postfatt_txt" as never, "" as never);

const costoReale = useFieldBinding("costo_reale" as never, "0" as never);
const fuelSurcCst = useFieldBinding("fuel_surc_cst" as never, "0" as never);
const pesoFornitReale = useFieldBinding(
  "peso_fornit_reale" as never,
  "0" as never,
);

// Sprint D7 — invoice control state.
const controlloFatt = useFieldBinding("controllo_fatt", "");

// Dominio real de controllo_fatt: enum('0','OK','NO','CA'). '0'=no definido.
// Se elimina 'KO' (no es miembro del enum → MariaDB lo truncaba a '') y se
// usa '0' en vez de '' para "no definido".
const controlloFattItems = computed(() => [
  { title: t("shipment.modals.post_invoice.ctrl_not_set"), value: "0" },
  { title: t("shipment.modals.post_invoice.ctrl_no"), value: "NO" },
  { title: t("shipment.modals.post_invoice.ctrl_ca"), value: "CA" },
  { title: t("shipment.modals.post_invoice.ctrl_ok"), value: "OK" },
]);

// Recharge application is delegated to RiaddebitoDialog (wizard with
// preview + override). The button above opens the dialog via ui store.
</script>
