<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-scale-balance" size="18" class="me-2" />
      {{ t("cargo.extra_weights.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="pesor.local"
            :label="t('cargo.extra_weights.real_weight')"
            type="number"
            min="0"
            step="0.1"
            :readonly="readonly('pesor') || pesorLocked"
            @blur="pesor.commit"
          >
            <template #append-inner>
              <v-tooltip
                :text="t('cargo.extra_weights.chargeable_lock')"
                location="top"
              >
                <template #activator="{ props: tip }">
                  <v-icon
                    v-bind="tip"
                    :icon="
                      pesorLocked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'
                    "
                    :color="pesorLocked ? 'warning' : undefined"
                    size="18"
                    style="cursor: pointer"
                    @click="togglePesorLock"
                  />
                </template>
              </v-tooltip>
            </template>
          </v-text-field>
        </v-col>
        <v-col cols="6" md="3">
          <!--
            Derivado, no editable: paridad con el legacy, donde `peso_reale`
            sale de SUM(spedizioni_colli) y el campo es readonly
            (spedyc_form.php:318). Tenerlo editable creaba DOS fuentes de
            verdad para el mismo dato — el origen de que cabecera y detalle
            lleven tiempo desincronizados. Se corrige editando los bultos.
          -->
          <v-text-field
            v-model="pesoReale.local"
            :label="t('cargo.extra_weights.measured_weight')"
            type="number"
            readonly
            :hint="t('cargo.extra_weights.derived_hint')"
            persistent-hint
          />
        </v-col>
        <v-col cols="6" md="3">
          <!--
            `readonly('peso_fornit_reale')` ya se calculaba (id_fattura_p > 0)
            pero no se aplicaba: era editable despues de facturar al proveedor.
          -->
          <v-text-field
            v-model="pesoFornitReale.local"
            :label="t('cargo.extra_weights.supplier_real')"
            type="number"
            min="0"
            step="0.1"
            :readonly="readonly('peso_fornit_reale')"
            @blur="pesoFornitReale.commit"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="coeff.local"
            :label="t('cargo.extra_weights.vol_coefficient')"
            type="number"
            min="0"
            @blur="coeff.commit"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="giacenzaGg.local"
            :label="t('cargo.extra_weights.storage_days')"
            type="number"
            min="0"
            step="1"
            @blur="giacenzaGg.commit"
          />
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
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

const pesor = useFieldBinding("pesor", "0", { numeric: true });
const pesoReale = useFieldBinding("peso_reale", "0", { numeric: true });
const pesoFornitReale = useFieldBinding("peso_fornit_reale", "0", {
  numeric: true,
});
const coeff = useFieldBinding("coeff_volm", "166.66", { numeric: true });
const giacenzaGg = useFieldBinding("giacenza_gg", "0");

// pesor_lk ('S'/'N'): when 'S', the volo recalc leaves the chargeable weight
// untouched (legacy lock). Mirror the boolean to the enum on toggle.
const pesorLk = useFieldBinding("pesor_lk", "N");
const pesorLocked = computed(() => pesorLk.local === "S");
function togglePesorLock(): void {
  pesorLk.local = pesorLocked.value ? "N" : "S";
  void pesorLk.commit();
}
</script>
