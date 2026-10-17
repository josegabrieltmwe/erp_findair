<template>
  <ModalWrapper
    name="colli"
    :title="t('shipment.modals.colli.title')"
    icon="mdi-package-variant"
    :max-width="1200"
  >
    <ShipmentPackagesBox embedded />
    <v-divider class="my-3" />
    <ShipmentColliList ref="colliRef" embedded />

    <!-- Pesos extra del proveedor (peso_fornit / peso_fornit_reale / peso_reale
         / volume_cliente). Paridad legacy spedy_form.php: "Weight x carrier",
         "Final carrier Weight", "Real weight", "Customer Volume". El box ya
         persiste por su cuenta (useFieldBinding, blur) — independiente del
         botón Save de arriba. -->
    <v-divider class="my-3" />
    <ShipmentExtraWeightsBox />

    <!-- Single "Save" button: it persists BOTH the package rows
         (savePackages) and the buffered shipment fields (commitDraft). The
         separate "Save packages" button was removed so the modal has one
         obvious save action. -->
    <template #actions>
      <v-btn variant="text" :disabled="store.saving" @click="onCancel">
        {{ t("common.cancel") }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-content-save-outline"
        :loading="store.saving"
        :disabled="store.saving"
        @click="onSave"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
// Colli flags (colli/peso/peso_tassato/acc_*) go through store.update →
// buffered in the draft, persisted by commitDraft. The package rows live in
// store.colliRows (shared by ShipmentPackagesBox + ShipmentColliList so
// Pieces↔rows stay in sync) and are persisted by ShipmentColliList.save()
// (savePackages). This modal's Save button runs BOTH so the user needs only
// one action. The metric/imperial toggle is display-only and NOT persisted.
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentPackagesBox from "@shipment/components/shipment/ShipmentPackagesBox.vue";
import ShipmentColliList from "@shipment/components/shipment/ShipmentColliList.vue";
import ShipmentExtraWeightsBox from "@shipment/components/shipment/ShipmentExtraWeightsBox.vue";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const toasts = useToastStore();
const colliRef = ref<{
  save: () => Promise<boolean>;
  dirty: boolean;
} | null>(null);

/**
 * Non-blocking weight-consistency check. Legacy parity: the declared weight
 * (`peso`, client-entered) and the sum of package weights (`peso_reale`) are
 * independent — the legacy form neither blocks nor adjusts on mismatch. We
 * only WARN (toast) so the operator notices, then let the save proceed.
 * Both values are metric (kg); colliRows.peso is stored metric.
 */
function warnOnWeightMismatch(): void {
  const declared = Number(store.shipment?.peso ?? 0) || 0;
  // No declared weight yet → nothing to reconcile (the "weight pending" flow).
  if (declared <= 0) return;
  const sum = store.colliRows.reduce(
    (acc, r) => acc + (Number(r.peso) || 0),
    0,
  );
  if (Math.abs(declared - sum) > 0.01) {
    toasts.push(
      "warning",
      t("shipment.modals.colli.weight_mismatch_toast", {
        total: declared.toFixed(2),
        sum: sum.toFixed(2),
      }),
    );
  }
}

async function onSave(): Promise<void> {
  // 1) Persist package rows first (only when they changed). savePackages()
  //    reloads the shipment, which re-bases the draft snapshot, so the still
  //    buffered field edits survive (see store.load's draftActive branch).
  if (colliRef.value?.dirty) {
    const ok = await colliRef.value.save();
    if (!ok) return; // save failed: keep the modal open (toast already shown)
  }
  // 2) Persist the buffered shipment fields.
  const res = await store.commitDraft();
  if (!res.ok) return;
  // 3) Warn (do NOT block) if the declared weight ≠ sum of package weights.
  warnOnWeightMismatch();
  ui.closeModal();
}

function onCancel(): void {
  ui.closeModal();
}
</script>
