<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-calendar-clock-outline" class="me-2" />
      {{ t("shipment.pickup.title") }}</v-card-title
    >
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="presaNumero.local"
            :label="t('shipment.pickup.numero')"
            @blur="presaNumero.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="presaStato.local"
            :items="statoItems"
            :label="t('shipment.pickup.stato')"
            @update:model-value="presaStato.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-checkbox
            v-model="presaFissa"
            :label="t('shipment.pickup.fissa')"
            @update:model-value="commitFissa"
          />
        </v-col>

        <!-- Sprint D1 — pickup type + supplier + presa ids. -->
        <v-col cols="12" md="4">
          <v-select
            v-model="presaTipo.local"
            :items="tipoItems"
            :label="t('shipment.pickup.tipo')"
            @update:model-value="presaTipo.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-checkbox
            v-model="presaFornitoreFlag"
            :label="t('shipment.pickup.carrier_handles')"
            @update:model-value="commitPresaFornitoreFlag"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="idPresaP.local"
            :label="t('shipment.pickup.id_presa_p')"
            type="number"
            min="0"
            :hint="presaP.message.value || t('shipment.pickup.id_presa_p_hint')"
            persistent-hint
            :error="presaP.error.value"
            :loading="presaP.checking.value"
            @blur="onPresaBlur('p', idPresaP)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="idPresaC.local"
            :label="t('shipment.pickup.id_presa_c')"
            type="number"
            min="0"
            :hint="presaC.message.value || t('shipment.pickup.id_presa_c_hint')"
            persistent-hint
            :error="presaC.error.value"
            :loading="presaC.checking.value"
            @blur="onPresaBlur('c', idPresaC)"
          />
        </v-col>

        <v-col cols="12" md="3">
          <v-text-field
            v-model="presaDalle.local"
            :label="t('shipment.pickup.dalle')"
            @blur="presaDalle.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="presaAlle.local"
            :label="t('shipment.pickup.alle')"
            @blur="presaAlle.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="presapDalle.local"
            :label="t('shipment.pickup.secondary_from')"
            @blur="presapDalle.commit"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="presapAlle.local"
            :label="t('shipment.pickup.secondary_to')"
            @blur="presapAlle.commit"
          />
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="presaNote.local"
            :label="t('shipment.pickup.note')"
            rows="2"
            auto-grow
            @blur="presaNote.commit"
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
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { pickupIdService } from "@shipment/services/pickup_id.service";
import type { FieldBinding } from "@shipment/composables/useFieldBinding";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);

// C3 — pickup-id existence check (legacy gest_presa_id_ajax.php). On blur we
// commit the field then verify the id exists and is active in `prese`,
// surfacing the result as an inline error/hint. id 0/empty clears the state.
interface PresaCheckState {
  error: ReturnType<typeof ref<boolean>>;
  checking: ReturnType<typeof ref<boolean>>;
  message: ReturnType<typeof ref<string>>;
}
function makePresaCheck(): PresaCheckState {
  return { error: ref(false), checking: ref(false), message: ref("") };
}
const presaP = makePresaCheck();
const presaC = makePresaCheck();

async function onPresaBlur(
  kind: "p" | "c",
  binding: FieldBinding<string>,
): Promise<void> {
  await binding.commit();
  const state = kind === "p" ? presaP : presaC;
  const id = Number(binding.local ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    state.error.value = false;
    state.message.value = "";
    return;
  }
  state.checking.value = true;
  try {
    const res = await pickupIdService.check(
      id,
      kind === "p" ? "id_presa_p" : "id_presa_c",
    );
    if (res && res.exists) {
      state.error.value = false;
      state.message.value = t("shipment.pickup.id_check_ok", { id });
    } else {
      state.error.value = true;
      state.message.value = t("shipment.pickup.id_check_fail", { id });
    }
  } catch {
    // Network/transient error: don't block editing, just clear the badge.
    state.error.value = false;
    state.message.value = "";
  } finally {
    state.checking.value = false;
  }
}

const presaNumero = useFieldBinding("presa_numero", "");
const presaStato = useFieldBinding("presa_stato", "");
const presaDalle = useFieldBinding("presa_dalle", "");
const presaAlle = useFieldBinding("presa_alle", "");
const presapDalle = useFieldBinding("presap_dalle", "");
const presapAlle = useFieldBinding("presap_alle", "");
const presaNote = useFieldBinding("presa_note", "");

// Sprint D1 — additional pickup fields.
//
// presa_tipo is declared as 'T'|'S'|'0' in the types but the legacy
// data also surfaces empty strings — cast through string to keep
// useFieldBinding happy with the union default.
const presaTipo = useFieldBinding("presa_tipo", "0" as "T" | "S" | "0");
const idPresaP = useFieldBinding("id_presa_p", "0");
const idPresaC = useFieldBinding("id_presa_c", "0");

// presa_fornitore is an 'S'/'N' flag on spedizioni even though its name
// could read as a supplier sigla. Surface it as a checkbox the same way
// ShipmentServiceFornitoreBox does on its own copy of the field.
const presaFornitoreFlag = ref<boolean>(false);
watch(
  shipment,
  (s) => {
    presaFornitoreFlag.value = s?.presa_fornitore === "S";
  },
  { immediate: true },
);
async function commitPresaFornitoreFlag(v: boolean | null): Promise<void> {
  await store.update({ presa_fornitore: v ? "S" : "N" });
}

// The 6 real pickup-status codes from the legacy spedy_form #pickuz <select>.
// The previous N/R/C/D/X set was invented and did not match the backend
// (CorrPickup / store_pick_up_* read/write these exact codes).
const statoItems = (["N", "W", "F", "C", "E", "T"] as const).map((value) => ({
  title: t(`shipment.pickup.stato_options.${value}`),
  value,
}));

const tipoItems = [
  { title: t("shipment.pickup.tipo_options.0"), value: "0" },
  { title: t("shipment.pickup.tipo_options.T"), value: "T" },
  { title: t("shipment.pickup.tipo_options.S"), value: "S" },
];

const presaFissa = ref<boolean>(false);
watch(
  shipment,
  (s) => {
    presaFissa.value = s?.presa_fissa === "S";
  },
  { immediate: true },
);
async function commitFissa(val: boolean | null): Promise<void> {
  await store.update({ presa_fissa: val ? "S" : "N" });
}
</script>
