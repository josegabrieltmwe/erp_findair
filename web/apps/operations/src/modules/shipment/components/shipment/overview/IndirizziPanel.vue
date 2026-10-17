<template>
  <div class="col">
    <section class="card-tmwe">
      <CardHeader
        icon="mdi-account-outline"
        :title="t('shipment.indirizzi.cliente_office')"
        editable
        @edit="ui.openModal('cliente')"
      />
      <v-row dense>
        <v-col cols="12" md="5">
          <v-text-field
            v-model="cliente.local"
            :label="t('shipment.indirizzi.client')"
            readonly
            :hint="t('shipment.indirizzi.edit_hint')"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="sedeLabel.local"
            :label="t('shipment.indirizzi.office')"
            readonly
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="rifCliente.local"
            :label="t('shipment.indirizzi.customer_rif')"
            placeholder="—"
            @blur="rifCliente.commit"
          />
        </v-col>
      </v-row>
    </section>

    <div class="indirizzi-cols">
      <section class="card-tmwe">
        <CardHeader
          icon="mdi-routes"
          :title="t('shipment.indirizzi.pickup_header')"
        />
        <ShipmentAddressBlock
          tipo="P"
          :title="t('shipment.indirizzi.pickup')"
        />
      </section>
      <section class="card-tmwe card-tmwe--alt">
        <CardHeader
          icon="mdi-map-marker-outline"
          :title="t('shipment.indirizzi.dest_header')"
          alt
        />
        <ShipmentAddressBlock
          tipo="D"
          :title="t('shipment.indirizzi.delivery')"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import ShipmentAddressBlock from "@shipment/components/shipment/ShipmentAddressBlock.vue";

const { t } = useI18n();
const ui = useUiStore();

const cliente = useFieldBinding("cliente", "");
const sedeLabel = useFieldBinding("sed_label", "");
const rifCliente = useFieldBinding("rif_cliente", "");
</script>

<style scoped lang="scss">
.indirizzi-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 840px) {
  .indirizzi-cols {
    grid-template-columns: 1fr;
  }
}
</style>
