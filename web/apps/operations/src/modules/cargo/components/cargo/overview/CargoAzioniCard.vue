<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-lightning-bolt-outline"
      :title="t('cargo.azioni.title')"
    >
      <!--
        Acciones avanzadas/peligrosas tras un menú de overflow (⋮): no existen
        en el legacy y no deben estar a un clic. Hoy: cancelar (soft-delete) el
        cargo.
      -->
      <template #actions>
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <button
              type="button"
              class="cardh-edit"
              :title="t('cargo.azioni.more_actions')"
              v-bind="menuProps"
            >
              <v-icon icon="mdi-dots-vertical" size="16" />
            </button>
          </template>
          <v-list density="compact" min-width="220">
            <v-list-item
              :title="t('cargo.azioni.cancel_cargo')"
              :subtitle="t('cargo.azioni.soft_delete')"
              @click="ui.openModal('cancel_cargo')"
            >
              <template #prepend>
                <v-icon icon="mdi-cancel" size="18" color="error" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </CardHeader>

    <!-- ── Section: operational workflow shortcuts ─────────────────── -->
    <div class="cardh-sub">
      <v-icon icon="mdi-progress-check" size="14" />
      <span>{{ t("cargo.azioni.sec_operational") }}</span>
    </div>
    <InfoRow
      icon="mdi-package-down"
      :title="t('cargo.azioni.delivery')"
      :subtitle="deliverySubtitle"
      :value="deliveryValue"
      clickable
      @click="ui.openModal('delivery')"
    />
    <InfoRow
      icon="mdi-tag-multiple"
      :title="t('cargo.azioni.offers_quote')"
      :subtitle="offerteSubtitle"
      :value="offerteValue"
      clickable
      @click="ui.openCotizacionModal('client')"
    />
    <InfoRow
      icon="mdi-account-multiple"
      :title="t('cargo.azioni.partner_visibility')"
      :subtitle="partnersSubtitle"
      clickable
      @click="ui.openModal('partners')"
    />
    <!-- "Envíos express vinculados" se promovió a card propia del overview
         (CargoLinkedExpressBox), con creación in-SPA — ya no es una fila aquí. -->

    <!-- Documents (AWB PDFs + INVIA/SHARE) were consolidated into the single
         AwbDocsBar inside the MAWB modal ("Docs y HAWB" tab) to remove the
         duplicated list that also lived here. -->

    <!-- ── Section: e-AWB transmission + agency notifications ──────────
      FWB sends the Cargo-XML to the aggregator via the RabbitMQ worker and
      shows the latest FMA state (sandbox by default). The customs-agency
      notify is a non-AWB email workflow grouped here as "transmissions". -->
    <div class="cardh-sub cardh-sub--spaced">
      <v-icon icon="mdi-transit-connection-variant" size="14" />
      <span>{{ t("cargo.azioni.sec_eawb") }}</span>
    </div>
    <InfoRow
      icon="mdi-send-lock-outline"
      :title="t('cargo.azioni.ewb_send')"
      :subtitle="ewbSubtitle"
      clickable
      @click="sendEwb"
    >
      <template #append>
        <v-chip size="x-small" variant="flat" :color="ewbChipColor">
          {{ ewbStateLabel }}
        </v-chip>
      </template>
    </InfoRow>
    <!-- "Notificar agencias de aduanas" retirado: duplicaba el tab "Notificar
         agencias" del modal de Aduanas, accesible desde la card Accesorios. -->

    <!-- ── Section: verification + close-out (destructive) ─────────── -->
    <div class="cardh-sub cardh-sub--spaced">
      <v-icon icon="mdi-flag-checkered" size="14" />
      <span>{{ t("cargo.azioni.sec_closeout") }}</span>
    </div>
    <InfoRow
      icon="mdi-check-decagram-outline"
      :title="t('cargo.azioni.validate_before_ldv')"
      :subtitle="t('cargo.azioni.preprint_check')"
      clickable
      @click="ui.openModal('validate_ldv')"
    />
    <!-- "Cancelar cargo" se movió al menú de overflow (⋮) de la cabecera:
         no está en el legacy y es destructiva, así que no debe estar a un clic. -->
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import {
  cargoActionsService,
  type EwbStatus,
} from "@cargo/services/cargo_actions.service";
import { useToastStore } from "@cargo/stores/toast.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const ui = useUiStore();
const toasts = useToastStore();

const cargoId = computed<number | null>(() => {
  if (!store.id) return null;
  const n = Number(store.id);
  return Number.isFinite(n) ? n : null;
});

// ── e-AWB (FWB) transmission state ─────────────────────────────────────────
const ewbStatus = ref<EwbStatus | null>(null);
const ewbSending = ref(false);

async function loadEwbStatus(): Promise<void> {
  if (!cargoId.value) {
    ewbStatus.value = null;
    return;
  }
  ewbStatus.value = await cargoActionsService.getEwbStatus(
    cargoId.value,
    "FWB",
  );
}

// Load (and refresh when the cargo changes) without blocking the card render.
watch(
  cargoId,
  () => {
    void loadEwbStatus();
  },
  { immediate: true },
);

const ewbStateLabel = computed<string>(() => {
  const s = ewbStatus.value?.state;
  if (ewbSending.value) return t("cargo.azioni.ewb_sending");
  switch (s) {
    case "ack":
      return t("cargo.azioni.ewb_ack");
    case "rejected":
      return t("cargo.azioni.ewb_rejected");
    case "sent":
      return t("cargo.azioni.ewb_sent");
    case "pending":
      return t("cargo.azioni.ewb_pending");
    case "error":
      return t("cargo.azioni.ewb_error");
    case "cancelled":
      return t("cargo.azioni.ewb_cancelled");
    default:
      return t("cargo.azioni.ewb_not_sent");
  }
});

const ewbChipColor = computed<string | undefined>(() => {
  switch (ewbStatus.value?.state) {
    case "ack":
      return "success";
    case "sent":
      return "info";
    case "pending":
      return "warning";
    case "rejected":
    case "error":
      return "error";
    default:
      return undefined;
  }
});

const ewbSubtitle = computed<string>(() => {
  const r = ewbStatus.value;
  if (r?.state === "rejected" && r.fma_code) {
    return t("cargo.azioni.ewb_rejected_code", { code: r.fma_code });
  }
  if (r?.awb) return r.awb;
  return t("cargo.azioni.ewb_subtitle");
});

async function sendEwb(): Promise<void> {
  if (!cargoId.value || ewbSending.value) return;
  // Confirm — transmitting an e-AWB is a real, billable action with the carrier.
  if (!window.confirm(t("cargo.azioni.ewb_confirm"))) return;
  ewbSending.value = true;
  try {
    // use_testing defaults to true (sandbox) in the service.
    const r = await cargoActionsService.sendEwb(cargoId.value, "FWB");
    if (r.success) {
      toasts.push("success", r.message ?? t("cargo.azioni.ewb_sent"));
    } else {
      toasts.push("error", r.error ?? t("cargo.azioni.ewb_error"));
    }
  } finally {
    ewbSending.value = false;
    await loadEwbStatus();
  }
}

const deliveryValue = computed<string>(() =>
  cargo.value?.consegna_data ? "✓" : "—",
);
const deliverySubtitle = computed<string>(() => {
  const s = cargo.value?.consegna_data as string | undefined;
  if (!s) return t("cargo.azioni.not_delivered");
  return String(s).slice(0, 16);
});

const offerteValue = computed<string>(() => {
  const o = cargo.value?.offerta as string | undefined;
  switch (o) {
    case "N":
      return t("enums.offerta_state.new");
    case "V":
      return t("enums.offerta_state.visited");
    case "A":
      return t("enums.offerta_state.accepted");
    case "R":
      return t("enums.offerta_state.rejected");
    default:
      return "—";
  }
});
const offerteSubtitle = computed<string>(() => {
  const g = cargo.value?.gestione as string | undefined;
  if (g === "F") return t("cargo.azioni.mgmt_confirmed");
  if (g === "O") return t("cargo.azioni.mgmt_offline");
  return t("cargo.azioni.mgmt_new");
});

const partnersSubtitle = computed<string>(() => {
  const ids = [
    cargo.value?.id_partner_show1,
    cargo.value?.id_partner_show2,
  ].filter((x) => x && String(x) !== "0");
  return ids.length
    ? t("cargo.azioni.shared_partners", { count: ids.length })
    : t("cargo.azioni.no_shared_partners");
});
</script>

<style scoped lang="scss">
/* Sub-header used to label the "Documenti" section inside the card.
   Tighter and lower-emphasis than the main CardHeader so the section
   reads as a grouping inside Azioni, not a separate card. */
.cardh-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

/* Section labels after the first one get a hairline + extra top gap so the
   groups read as distinct blocks without the noisy full-width dividers that
   previously separated every single row. */
.cardh-sub--spaced {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid
    rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}

/* Sin línea separadora entre filas individuales (anula el separador global
   .inforow + .inforow de mockup2). Los separadores de SECCIÓN (.cardh-sub--spaced)
   se conservan a propósito: agrupan bloques, no filas. */
:deep(.inforow + .inforow) {
  border-top: 0;
}
</style>
