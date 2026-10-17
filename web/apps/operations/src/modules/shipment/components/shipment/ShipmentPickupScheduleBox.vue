<template>
  <!-- No outer v-card/title here: the host ModalWrapper already provides the
       dialog card, the title (icon + "Pickup scheduling") and the close button.
       Wrapping again duplicated the title and nested a card inside a card. -->
  <div class="pickup-box">
    <p class="text-caption text-medium-emphasis mb-3">
      {{ t("shipment.pickup.subtitle") }}
    </p>
    <!-- Stato della presa: numero, stato, fissa -->
    <FormSection
      :title="t('shipment.pickup.section_status')"
      icon="mdi-information-outline"
      flat
    >
      <v-row dense>
        <v-col cols="12" md="4">
          <FieldHelpTooltip :text="help('presa_numero')">
            <v-text-field
              v-model="presaNumero.local"
              :label="t('shipment.pickup.numero')"
              density="compact"
              :readonly="readonly('presa_numero')"
              @blur="presaNumero.commit"
            />
          </FieldHelpTooltip>
        </v-col>

        <!-- Stato — select con i 6 stati reali del legacy (spedy_form #pickuz). -->
        <v-col cols="12" md="4">
          <FieldHelpTooltip :text="help('presa_stato')">
            <v-select
              v-model="presaStato.local"
              :items="presaStatoItems"
              :label="t('shipment.pickup.stato')"
              density="compact"
              :readonly="readonly('presa_stato')"
              @update:model-value="presaStato.commit"
            />
          </FieldHelpTooltip>
        </v-col>

        <!-- Fissa switch. align-start + pt matches the switch baseline to the
             sibling text-field's input row (those fields carry a persistent
             hint, so plain align-center would float the switch too high). -->
        <v-col cols="12" md="4" class="d-flex align-start switch-col">
          <v-switch
            v-model="presaFissaSwitch"
            :label="t('shipment.pickup.fissa')"
            color="primary"
            hide-details
            density="compact"
            :disabled="readonly('presa_fissa')"
            @update:model-value="(v: any) => commitFissa(!!v)"
          />
        </v-col>
      </v-row>
    </FormSection>

    <!-- Finestre orarie: principale + alternativa -->
    <FormSection
      :title="t('shipment.pickup.section_windows')"
      icon="mdi-clock-outline"
      flat
    >
      <v-row dense>
        <v-col cols="12" md="6">
          <FieldHelpTooltip :text="help('presa_dalle')">
            <v-text-field
              v-model="presaDalle.local"
              :label="t('shipment.pickup.dalle')"
              placeholder="08:00"
              density="compact"
              :readonly="readonly('presa_dalle')"
              @blur="presaDalle.commit"
            />
          </FieldHelpTooltip>
        </v-col>
        <v-col cols="12" md="6">
          <FieldHelpTooltip :text="help('presa_alle')">
            <v-text-field
              v-model="presaAlle.local"
              :label="t('shipment.pickup.alle')"
              placeholder="12:00"
              density="compact"
              :readonly="readonly('presa_alle')"
              @blur="presaAlle.commit"
            />
          </FieldHelpTooltip>
        </v-col>

        <v-col cols="12" md="6">
          <FieldHelpTooltip :text="help('presap_dalle')">
            <v-text-field
              v-model="presapDalle.local"
              :label="t('shipment.pickup.dalle_alt')"
              placeholder="14:00"
              density="compact"
              :readonly="readonly('presap_dalle')"
              @blur="presapDalle.commit"
            />
          </FieldHelpTooltip>
        </v-col>
        <v-col cols="12" md="6">
          <FieldHelpTooltip :text="help('presap_alle')">
            <v-text-field
              v-model="presapAlle.local"
              :label="t('shipment.pickup.alle_alt')"
              placeholder="18:00"
              density="compact"
              :readonly="readonly('presap_alle')"
              @blur="presapAlle.commit"
            />
          </FieldHelpTooltip>
        </v-col>
      </v-row>
    </FormSection>

    <!-- Fornitore / invio + azioni di prenotazione -->
    <FormSection
      :title="t('shipment.pickup.section_supplier')"
      icon="mdi-truck-outline"
      flat
    >
      <v-row dense>
        <v-col cols="12" md="6">
          <FieldHelpTooltip :text="help('presa_invio_mitt')">
            <v-text-field
              v-model="presaInvioMitt.local"
              :label="t('shipment.pickup.invio_mitt')"
              type="date"
              density="compact"
              :readonly="readonly('presa_invio_mitt')"
              @blur="presaInvioMitt.commit"
            />
          </FieldHelpTooltip>
        </v-col>

        <v-col cols="12" md="6" class="d-flex align-start switch-col">
          <v-switch
            v-model="presaFornitoreSwitch"
            :label="t('shipment.pickup.fornitore')"
            color="primary"
            hide-details
            density="compact"
            :disabled="readonly('presa_fornitore')"
            @update:model-value="(v: any) => commitFornitore(!!v)"
          />
        </v-col>

        <!-- Pickup actions — only for courier pickup (presa_fornitore='S').
               Reserving is shown only when there is no pickup yet; cancelling
               only when a pickup is booked. The booking goes through the
               RabbitMQ worker and is gated by RBAC on the backend. -->
        <v-col
          v-if="isCourierPickup && !readonly('presa_fornitore')"
          cols="12"
          class="d-flex ga-2"
        >
          <v-btn
            v-if="!hasBookedPickup"
            size="small"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-truck-check-outline"
            :loading="busy"
            @click="onReservePickup"
          >
            {{ t("shipment.pickup.reserve") }}
          </v-btn>
          <v-btn
            v-if="hasBookedPickup"
            size="small"
            color="error"
            variant="tonal"
            prepend-icon="mdi-truck-remove-outline"
            :loading="busy"
            @click="onCancelPickup"
          >
            {{ t("shipment.pickup.cancel") }}
          </v-btn>
        </v-col>
      </v-row>
    </FormSection>

    <!-- Note -->
    <FormSection
      :title="t('shipment.pickup.section_notes')"
      icon="mdi-note-text-outline"
      flat
      last
    >
      <FieldHelpTooltip :text="help('presa_note')">
        <v-textarea
          v-model="presaNote.local"
          :label="t('shipment.pickup.note')"
          rows="2"
          auto-grow
          density="compact"
          :readonly="readonly('presa_note')"
          @blur="presaNote.commit"
        />
      </FieldHelpTooltip>
    </FormSection>

    <!-- Flow rule: booking a pickup on an already-labelled shipment is never
         implicit. Alert the steps and require explicit confirmation. -->
    <v-dialog v-model="reserveAlertOpen" max-width="520">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-alert-outline" color="warning" class="me-2" />
          {{ t("shipment.pickup.reserve_alert_title") }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-alert
            v-if="hasAwb"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ t("shipment.pickup.reserve_alert_awb") }}
            <ol class="mt-2 ms-3">
              <li>{{ t("shipment.pickup.reserve_alert_step1") }}</li>
              <li>{{ t("shipment.pickup.reserve_alert_step2") }}</li>
            </ol>
          </v-alert>
          <p class="text-body-2">
            {{ t("shipment.pickup.reserve_alert_body") }}
          </p>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-btn
            variant="text"
            :disabled="busy"
            @click="reserveAlertOpen = false"
            >{{ t("common.cancel") }}</v-btn
          >
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-truck-check-outline"
            :loading="busy"
            @click="confirmReservePickup"
          >
            {{ t("shipment.pickup.reserve_confirm") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { useToastStore } from "@shipment/stores/toast.store";
import { pickupService } from "@shipment/services/pickup.service";
import FormSection from "@shared/ui/FormSection.vue";
import FieldHelpTooltip from "@shared/ui/FieldHelpTooltip.vue";

const { t, te } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);
const toasts = useToastStore();

// Per-field help text shown as a hover tooltip (FieldHelpTooltip). Sourced
// from i18n under `shipment.pickup.help.<campo>` (translated in all 5 locales,
// text taken from the legacy forms_campi "i" bubble). `te()` guards missing
// keys so a field without help simply renders no tooltip.
function help(field: string): string {
  const key = `shipment.pickup.help.${field}`;
  return te(key) ? t(key) : "";
}

// Pickup status — the 6 real options from the legacy spedy_form #pickuz
// <select> (parity bit-by-bit). Do NOT invent values: these are the exact
// codes the backend (CorrPickup / store_pick_up_*) reads and writes.
const presaStatoItems = computed(() => [
  { title: t("shipment.pickup.stato_options.N"), value: "N" },
  { title: t("shipment.pickup.stato_options.W"), value: "W" },
  { title: t("shipment.pickup.stato_options.F"), value: "F" },
  { title: t("shipment.pickup.stato_options.C"), value: "C" },
  { title: t("shipment.pickup.stato_options.E"), value: "E" },
  { title: t("shipment.pickup.stato_options.T"), value: "T" },
]);

// Free-text bindings (1 field → 1 commit on blur).
const presaNumero = useFieldBinding("presa_numero", "");
const presaStato = useFieldBinding("presa_stato", "");
const presaDalle = useFieldBinding("presa_dalle", "");
const presaAlle = useFieldBinding("presa_alle", "");
const presapDalle = useFieldBinding("presap_dalle", "");
const presapAlle = useFieldBinding("presap_alle", "");
const presaInvioMitt = useFieldBinding("presa_invio_mitt", "");
const presaNote = useFieldBinding("presa_note", "");

// Switches mapped to S/N strings — keep state local then commit through store.
const presaFissaSwitch = ref(false);
const presaFornitoreSwitch = ref(false);

watch(
  shipment,
  (s) => {
    presaFissaSwitch.value = s?.presa_fissa === "S";
    presaFornitoreSwitch.value = s?.presa_fornitore === "S";
  },
  { immediate: true },
);

async function commitFissa(v: boolean): Promise<void> {
  await store.update({ presa_fissa: v ? "S" : "N" });
}
async function commitFornitore(v: boolean): Promise<void> {
  await store.update({ presa_fornitore: v ? "S" : "N" });
}

// ─── Pickup actions (reserve / cancel) ────────────────────────────
const busy = ref(false);
const reserveAlertOpen = ref(false);

const sid = computed<number>(() => Number(shipment.value?.id ?? 0));
const isCourierPickup = computed<boolean>(
  () => shipment.value?.presa_fornitore === "S",
);
const hasBookedPickup = computed<boolean>(() => {
  const n = String(
    (shipment.value as Record<string, unknown> | null)?.presa_numero ?? "",
  ).trim();
  return n !== "" && n !== "0";
});
const hasAwb = computed<boolean>(() => {
  const a = String(
    (shipment.value as Record<string, unknown> | null)?.AWB_forn ?? "",
  ).trim();
  return a !== "";
});

/**
 * Reserve the courier pickup. Flow rule: if the shipment already has an AWB,
 * show the alert with the steps to follow and require explicit confirmation.
 * (When there is no AWB yet the pickup is reserved together with the AWB from
 * the LDV/AWB hub, so this button targets the already-labelled case.)
 */
function onReservePickup(): void {
  reserveAlertOpen.value = true;
}

async function confirmReservePickup(): Promise<void> {
  if (!sid.value) return;
  busy.value = true;
  try {
    const r = await pickupService.reserve(sid.value, true);
    if (r.success) {
      toasts.push(
        "success",
        r.data?.pickup_code
          ? t("shipment.pickup.toast_reserved_code", {
              code: r.data.pickup_code,
            })
          : t("shipment.pickup.toast_reserved"),
      );
      reserveAlertOpen.value = false;
      await store.load(sid.value);
    } else {
      toasts.push(
        "error",
        r.error ?? t("shipment.pickup.toast_reserve_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function onCancelPickup(): Promise<void> {
  if (!sid.value) return;
  busy.value = true;
  try {
    const r = await pickupService.cancel(sid.value);
    if (r.success) {
      toasts.push("success", t("shipment.pickup.toast_cancelled"));
      await store.load(sid.value);
    } else {
      toasts.push("error", r.error ?? t("shipment.pickup.toast_cancel_failed"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
/* Line the inset switches up with the input row of their sibling text-fields.
   Those fields carry a persistent hint, so the column is taller than the
   input; align-start + this top padding drop the switch onto the input's
   vertical centre instead of the column's. */
.switch-col {
  /* Measured: the input's vertical centre sits 6px above the switch track's
     centre with 10px padding, so 4px lands them on the same line. */
  padding-top: 4px;
}
</style>
