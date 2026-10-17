<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-timeline-clock-outline" size="18" class="me-2" />
      {{ t("cargo.timeline.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <EmptyState
        v-if="events.length === 0"
        icon="mdi-timeline-text-outline"
        :title="t('cargo.timeline.empty_title')"
        :text="t('cargo.timeline.empty_text')"
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
          <div class="text-subtitle-2 font-weight-semibold">{{ ev.title }}</div>
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
import { useCargoStore } from "@cargo/stores/cargo.store";

type Ev = {
  when: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
};

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);

function fmtDate(raw: string | undefined | null): string {
  if (!raw || raw === "0000-00-00 00:00:00" || raw === "0000-00-00") return "";
  return raw.length > 16 ? raw.slice(0, 16) : raw;
}

const events = computed<Ev[]>(() => {
  const s = cargo.value;
  if (!s) return [];
  const list: Ev[] = [];

  const created = fmtDate(s.data_sped0);
  if (created) {
    list.push({
      when: created,
      title: t("cargo.timeline.created"),
      subtitle: s.user_sigla
        ? t("cargo.timeline.created_by", { user: s.user_sigla })
        : undefined,
      icon: "mdi-plus-circle-outline",
      color: "info",
    });
  }

  const offerSent = s.offerta === "S";
  if (offerSent) {
    list.push({
      when: "—",
      title: t("cargo.timeline.offer_sent"),
      subtitle: t("cargo.timeline.offer_sent_sub"),
      icon: "mdi-email-arrow-right-outline",
      color: "info",
    });
  }

  const dispatched = fmtDate(s.data_sped1);
  if (dispatched) {
    list.push({
      when: dispatched,
      title: t("cargo.timeline.dispatched"),
      subtitle: s.AWB_forn
        ? t("cargo.timeline.dispatched_sub", { awb: s.AWB_forn })
        : undefined,
      icon: "mdi-airplane",
      color: "primary",
    });
  }

  const voloPart = fmtDate(s.data_volo_partenza);
  if (voloPart) {
    list.push({
      when: voloPart,
      title: t("cargo.timeline.flight_departure"),
      subtitle: s.terminal_part
        ? t("cargo.timeline.flight_departure_sub", {
            terminal: s.terminal_part,
          })
        : undefined,
      icon: "mdi-airplane-takeoff",
      color: "primary",
    });
  }

  const voloArr = fmtDate(s.data_volo_arrivo);
  if (voloArr) {
    list.push({
      when: voloArr,
      title: t("cargo.timeline.flight_arrival"),
      subtitle: s.terminal_dest
        ? t("cargo.timeline.flight_arrival_sub", { terminal: s.terminal_dest })
        : undefined,
      icon: "mdi-airplane-landing",
      color: "primary",
    });
  }

  const expected = fmtDate(s.data_consegna_prevista);
  if (expected) {
    list.push({
      when: expected,
      title: t("cargo.timeline.expected_delivery"),
      icon: "mdi-calendar-clock-outline",
      color: "secondary",
    });
  }

  const delivered = fmtDate(s.consegna_data);
  if (delivered) {
    list.push({
      when: delivered,
      title: t("cargo.timeline.delivered"),
      subtitle: s.consegna_firma
        ? t("cargo.timeline.delivered_signed", { name: s.consegna_firma })
        : t("cargo.timeline.delivered_signature"),
      icon: "mdi-check-circle-outline",
      color: "success",
    });
  }

  if (s.id_fattura_a && Number(s.id_fattura_a) > 0) {
    list.push({
      when: "—",
      title: t("cargo.timeline.invoiced", { id: s.id_fattura_a }),
      subtitle: t("cargo.timeline.invoiced_sub"),
      icon: "mdi-receipt-text-check-outline",
      color: "success",
    });
  }
  if (s.id_fattura_p && Number(s.id_fattura_p) > 0) {
    list.push({
      when: "—",
      title: t("cargo.timeline.supplier_invoice", { id: s.id_fattura_p }),
      subtitle: t("cargo.timeline.supplier_invoice_sub"),
      icon: "mdi-file-check-outline",
      color: "secondary",
    });
  }
  return list;
});
</script>
