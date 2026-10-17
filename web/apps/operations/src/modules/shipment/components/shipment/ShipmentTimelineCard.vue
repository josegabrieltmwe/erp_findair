<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-timeline-clock-outline" class="me-2" />
      {{ t("shipment.modals.timeline.title") }}
    </v-card-title>
    <v-card-text>
      <EmptyState
        v-if="events.length === 0"
        icon="mdi-timeline-text-outline"
        :title="t('shipment.modals.timeline.no_events')"
        :text="t('shipment.modals.timeline.no_events_text')"
      />
      <v-timeline
        v-else
        density="compact"
        side="end"
        align="start"
        truncate-line="both"
      >
        <v-timeline-item
          v-for="(ev, i) in events"
          :key="i"
          :dot-color="ev.color"
          :icon="ev.icon"
          size="small"
        >
          <template #opposite>
            <span class="text-caption text-medium-emphasis">{{ ev.when }}</span>
          </template>
          <div class="text-subtitle-2 font-weight-medium">{{ ev.title }}</div>
          <div v-if="ev.subtitle" class="text-caption text-medium-emphasis">
            {{ ev.subtitle }}
          </div>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";

const { t } = useI18n();

type TimelineEvent = {
  when: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
};

const store = useShipmentStore();
const { shipment } = storeToRefs(store);

function fmtDate(raw: string | undefined | null): string {
  if (!raw || raw === "0000-00-00 00:00:00" || raw === "0000-00-00") return "";
  return raw.length > 16 ? raw.slice(0, 16) : raw;
}

const events = computed<TimelineEvent[]>(() => {
  const s = shipment.value;
  if (!s) return [];
  const list: TimelineEvent[] = [];

  const created = fmtDate(s.data_sped0);
  if (created) {
    list.push({
      when: created,
      title: t("shipment.modals.timeline.created"),
      subtitle: s.user_sigla
        ? t("shipment.modals.timeline.created_by", { user: s.user_sigla })
        : undefined,
      icon: "mdi-plus-circle-outline",
      color: "info",
    });
  }

  const pickupSent = fmtDate(s.presa_invio_mitt);
  if (pickupSent) {
    list.push({
      when: pickupSent,
      title: t("shipment.modals.timeline.ldv_emailed"),
      subtitle: t("shipment.modals.timeline.ldv_emailed_sub"),
      icon: "mdi-email-outline",
      color: "info",
    });
  }

  const dataSped1 = fmtDate(s.data_sped1);
  if (dataSped1) {
    list.push({
      when: dataSped1,
      title: t("shipment.modals.timeline.dispatched"),
      subtitle: s.AWB_forn ? `AWB ${s.AWB_forn}` : undefined,
      icon: "mdi-truck-fast-outline",
      color: "primary",
    });
  }

  const dataCorriere = fmtDate(s.data_corriere);
  if (dataCorriere && dataCorriere !== dataSped1) {
    list.push({
      when: dataCorriere,
      title: t("shipment.modals.timeline.courier_handover"),
      icon: "mdi-handshake-outline",
      color: "primary",
    });
  }

  const expected = fmtDate(s.data_consegna_prevista);
  if (expected) {
    list.push({
      when: expected,
      title: t("shipment.modals.timeline.expected_delivery"),
      icon: "mdi-calendar-clock-outline",
      color: "secondary",
    });
  }

  const delivered = fmtDate(s.consegna_data);
  if (delivered) {
    list.push({
      when: delivered,
      title: t("shipment.modals.timeline.delivered"),
      subtitle: s.consegna_firma
        ? t("shipment.modals.timeline.signed_by", { name: s.consegna_firma })
        : t("shipment.modals.timeline.signature_on_file"),
      icon: "mdi-check-circle-outline",
      color: "success",
    });
  }

  if (s.id_fattura_a && Number(s.id_fattura_a) > 0) {
    list.push({
      when: "—",
      title: t("shipment.modals.timeline.invoiced", { id: s.id_fattura_a }),
      subtitle: t("shipment.modals.timeline.invoiced_sub"),
      icon: "mdi-receipt-text-check-outline",
      color: "success",
    });
  }
  if (s.id_fattura_p && Number(s.id_fattura_p) > 0) {
    list.push({
      when: "—",
      title: t("shipment.modals.timeline.supplier_invoice", {
        id: s.id_fattura_p,
      }),
      subtitle: t("shipment.modals.timeline.supplier_invoice_sub"),
      icon: "mdi-file-check-outline",
      color: "secondary",
    });
  }

  return list;
});
</script>
