<template>
  <FormSection
    :title="t('cargo.mawbv2.awb_identity')"
    icon="mdi-barcode"
    last
    flat
  >
    <v-row dense>
      <v-col cols="12" md="4">
        <!-- Se conserva la entrada manual: hay AWBs de aerolínea que no están
             en el stock propio. Pero deja de ser el único camino — el botón
             abre la reserva real, que además descuenta el número.

             Con una reserva VIVA en el carrier el campo pasa a solo lectura:
             ese número ya lo tiene la aerolínea y cambiarlo aquí solo
             desincroniza. Cancelar la reserva lo devuelve a editable. -->
        <v-text-field
          :model-value="draft.displayValue('awb_number', mawb.awb_number)"
          :label="t('cargo.mawbv2.awb_number')"
          density="compact"
          :hide-details="!awbLocked"
          :hint="awbLocked ? t('cargo.mawbv2.awb_from_booking') : undefined"
          :persistent-hint="awbLocked"
          :readonly="awbLocked"
          :disabled="locked"
          :append-inner-icon="awbLocked ? 'mdi-lock-outline' : undefined"
          @update:model-value="(v: string) => draft.setDraft('awb_number', v)"
          @blur="commit('awb_number')"
        >
          <template #append-inner>
            <!-- Oculto, no deshabilitado: con reserva viva el picker ofrecía
                 cambiar un AWB que el carrier ya tiene. -->
            <v-btn
              v-if="!awbLocked"
              icon="mdi-format-list-numbered"
              variant="text"
              size="x-small"
              density="comfortable"
              :disabled="locked"
              :title="t('cargo.awb_stock.pick_from_stock')"
              @mousedown.prevent
              @click="stockOpen = true"
            />
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          :model-value="
            draft.displayValue('agent_iata_code', mawb.agent_iata_code)
          "
          :label="t('cargo.mawbv2.agent_iata_code')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('agent_iata_code', v)
          "
          @blur="commit('agent_iata_code')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          :model-value="draft.displayValue('at_place', mawb.at_place)"
          :label="t('cargo.mawbv2.executed_at')"
          density="compact"
          hide-details
          :disabled="locked"
          @update:model-value="(v: string) => draft.setDraft('at_place', v)"
          @blur="commit('at_place')"
        />
      </v-col>
      <v-col cols="12">
        <v-textarea
          :model-value="
            draft.displayValue('issuing_carrier', mawb.issuing_carrier)
          "
          :label="t('cargo.mawbv2.issuing_carrier')"
          density="compact"
          rows="2"
          auto-grow
          hide-details
          :disabled="locked"
          @update:model-value="
            (v: string) => draft.setDraft('issuing_carrier', v)
          "
          @blur="commit('issuing_carrier')"
        />
      </v-col>
      <v-col cols="12">
        <v-btn
          variant="tonal"
          size="small"
          color="primary"
          prepend-icon="mdi-account-tie"
          :loading="applyingAgent"
          :disabled="locked"
          @click="emit('set-terminal-partner')"
        >
          {{ t("cargo.mawbv2.set_terminal_partner") }}
        </v-btn>
      </v-col>
    </v-row>

    <CargoAwbStockPicker
      v-model="stockOpen"
      :cargo-id="cargoId"
      :current-awb="String(mawb.awb_number ?? '')"
      @reserved="onReserved"
    />
  </FormSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import FormSection from "@shared/ui/FormSection.vue";
import CargoAwbStockPicker from "@cargo/components/cargo/awb/CargoAwbStockPicker.vue";
import { useCargoStore } from "@cargo/stores/cargo.store";
import type { CargoMawb } from "@cargo/services/cargo_mawb.types";
import type { MawbFieldDraft } from "@cargo/composables/useMawbFieldDraft";

const props = defineProps<{
  mawb: CargoMawb;
  draft: MawbFieldDraft;
  locked: boolean;
  applyingAgent: boolean;
}>();

const emit = defineEmits<{
  (e: "commit", field: string): void;
  (e: "set-terminal-partner"): void;
}>();

const { t } = useI18n();

const { id: cargoIdRef } = storeToRefs(useCargoStore());
const cargoId = computed(() => Number(cargoIdRef.value ?? 0));

const stockOpen = ref(false);

/**
 * El AWB lo fija una reserva viva en el carrier → solo lectura.
 *
 * Distinto de `locked`, que bloquea TODO el formulario cuando el vuelo ya
 * salió. Aquí el resto de campos siguen editables; lo que no se toca es el
 * número, porque la aerolínea ya lo tiene. Cancelar la reserva lo libera.
 */
const awbLocked = computed<boolean>(() => Boolean(props.mawb.awb_locked));

/**
 * Reserva hecha desde el picker de stock.
 *
 * El backend ya escribió `AWB_forn` (Awb_Range_Service::reserve_for_cargo, que
 * además descuenta el número del pool). Se refleja en el draft para que el
 * formulario quede coherente sin recargar la ficha entera.
 *
 * NO se hace `commit`: antes se emitía uno, y el PATCH de `awb_number` moría
 * con 400 porque ese campo no existe en `awb_cargo` — el valor solo sobrevivía
 * en el draft local hasta la siguiente recarga. Ahora el número ya está
 * persistido por la propia reserva, así que reenviarlo sería redundante.
 */
function onReserved(awb: string): void {
  props.draft.setDraft("awb_number", awb);
}

/** Blur = commit. The draft keeps the typed value visible until it lands. */
function commit(field: string): void {
  emit("commit", field);
}
</script>
