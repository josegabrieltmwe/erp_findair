<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-flag-outline" class="me-2" />
      {{ t("shipment.flags.title") }}</v-card-title
    >
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="noivaArt9"
            :label="t('shipment.flags.noiva_art9')"
            :disabled="readonly('noiva_art9')"
            @update:model-value="(v: any) => commit('noiva_art9', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="archiviata"
            :label="t('shipment.flags.archived')"
            @update:model-value="(v: any) => commitFlag('A', !!v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="costoDaverif"
            :label="t('shipment.flags.cost_to_check')"
            @update:model-value="(v: any) => commit('costo_daverif', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="controllata"
            :items="controllataItems"
            :label="t('shipment.flags.verified')"
            :disabled="readonly('controllata')"
            @update:model-value="(v: any) => commitControllata(v)"
          />
        </v-col>

        <!-- Operational flags surfaced by the legacy spedy_form.
             Checkbox 'prioritario' eliminado: NO es columna de spedizioni —
             es propiedad del catálogo servizi_fornitori (heredada vía
             id_servizio), no editable por expedición. Se descartaba. -->
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accAreeRemote"
            :label="t('shipment.flags.accept_remote')"
            @update:model-value="(v: any) => commit('acc_aree_remote', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accAutoFuoriMisura"
            :label="t('shipment.flags.accept_oversize')"
            @update:model-value="(v: any) => commit('acc_auto_fuori_misura', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="caricoLk"
            :label="t('shipment.flags.pricing_locked')"
            @update:model-value="(v: any) => commit('carico_lk', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="costoPrevistoLk"
            :label="t('shipment.flags.cost_locked')"
            @update:model-value="(v: any) => commit('costo_previsto_lk', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="consegnaDanoi"
            :label="t('shipment.flags.delivered_by_us')"
            @update:model-value="(v: any) => commit('consegna_danoi', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="deliveredMail"
            :label="t('shipment.flags.delivery_email_sent')"
            disabled
            @update:model-value="(v: any) => commit('delivered_mail', v)"
          />
        </v-col>

        <!-- Accessori dry ice / dangerous goods / bancale: en courier NO son
             columnas de spedizioni sino supplementi (spedizioni_suppl). El
             enrutado como supplemento está pendiente; se deshabilitan (solo
             lectura del estado) para no dar falsa sensación de guardado —
             antes su commit provocaba un 500 que abortaba todo el PATCH. -->
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accDryice"
            :label="t('shipment.flags.dry_ice')"
            disabled
            :messages="t('shipment.flags.accessory_supplement_hint')"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accDanggoods"
            :label="t('shipment.flags.dangerous_goods')"
            disabled
            :messages="t('shipment.flags.accessory_supplement_hint')"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accBancale"
            :label="t('shipment.flags.pallet')"
            disabled
            :messages="t('shipment.flags.accessory_supplement_hint')"
          />
        </v-col>

        <!-- WS-S-D plan v2 — flags reales adicionales auditados desde
             Shipment_Constants::ALLOWED_SHIPMENT_FIELDS (DESCRIBE confirmed). -->
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accFermoDeposito"
            :label="t('shipment.flags.fermo_deposito')"
            @update:model-value="(v: any) => commit('acc_fermo_deposito', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="accFissaCorriere"
            :label="t('shipment.flags.fissa_corriere')"
            @update:model-value="(v: any) => commit('acc_fissa_corriere', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="badAddress"
            :label="t('shipment.flags.bad_address')"
            @update:model-value="(v: any) => commit('badaddress', v)"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, id } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const noivaArt9 = ref(false);
const archiviata = ref(false);
const costoDaverif = ref(false);
const controllata = ref<"S" | "N" | "O">("S");

// Sprint D2 — operational flags from the legacy form.
const accAreeRemote = ref(false);
const accAutoFuoriMisura = ref(false);
const caricoLk = ref(false);
const costoPrevistoLk = ref(false);
const consegnaDanoi = ref(false);
const deliveredMail = ref(false);

// Sprint D3 — accessori spedy_form.
const accDryice = ref(false);
const accDanggoods = ref(false);
const accBancale = ref(false);

// WS-S-D plan v2 — flags adicionales auditados.
const accFermoDeposito = ref(false);
const accFissaCorriere = ref(false);

// Form-parity gap K4 — problematic-address flag (spedizioni.badaddress S/N).
const badAddress = ref(false);

type SnFlag =
  | "noiva_art9"
  | "costo_daverif"
  | "acc_aree_remote"
  | "acc_auto_fuori_misura"
  | "carico_lk"
  | "costo_previsto_lk"
  | "consegna_danoi"
  | "delivered_mail"
  | "acc_fermo_deposito"
  | "acc_fissa_corriere"
  | "badaddress";

const controllataItems = [
  { title: t("shipment.flags.controllata_options.S"), value: "S" },
  { title: t("shipment.flags.controllata_options.N"), value: "N" },
  { title: t("shipment.flags.controllata_options.O"), value: "O" },
];

watch(
  shipment,
  (s) => {
    noivaArt9.value = s?.noiva_art9 === "S";
    archiviata.value = s?.archiviata === "S";
    costoDaverif.value = s?.costo_daverif === "S";
    controllata.value = (s?.controllata as "S" | "N" | "O") || "S";
    accAreeRemote.value = s?.acc_aree_remote === "S";
    accAutoFuoriMisura.value = s?.acc_auto_fuori_misura === "S";
    caricoLk.value = s?.carico_lk === "S";
    costoPrevistoLk.value = s?.costo_previsto_lk === "S";
    consegnaDanoi.value = s?.consegna_danoi === "S";
    deliveredMail.value = s?.delivered_mail === "S";
    accDryice.value = s?.acc_dryice === "S";
    accDanggoods.value = s?.acc_danggoods === "S";
    accBancale.value = s?.acc_bancale === "S";
    accFermoDeposito.value = s?.acc_fermo_deposito === "S";
    accFissaCorriere.value = s?.acc_fissa_corriere === "S";
    badAddress.value = s?.badaddress === "S";
  },
  { immediate: true },
);

async function commit(field: SnFlag, v: boolean | null): Promise<void> {
  // Cast to the shipment partial: the store accepts free 'S'/'N' for SnFlag
  // fields. The keyof Shipment check happens at the store level.
  await store.update({ [field]: v ? "S" : "N" } as Record<SnFlag, "S" | "N">);
}
async function commitFlag(_kind: "A", enable: boolean): Promise<void> {
  if (!id.value) return;
  await store.update({ archiviata: enable ? "S" : "N" });
}
async function commitControllata(v: "S" | "N" | "O"): Promise<void> {
  await store.update({ controllata: v });
}
</script>
