<template>
  <div class="address-icon-row d-inline-flex align-center" style="gap: 6px">
    <template v-for="item in items" :key="item.kind">
      <v-icon
        v-if="item.value"
        :icon="item.icon"
        :size="size"
        class="address-icon"
        :color="item.color"
      >
        <v-tooltip activator="parent" location="top">
          <div class="text-caption text-uppercase text-medium-emphasis">
            {{ item.label }}
          </div>
          <div class="text-body-2">{{ item.value }}</div>
        </v-tooltip>
      </v-icon>
    </template>
    <span v-if="!hasAny" class="text-caption text-medium-emphasis">{{
      t("shipment.address_row.no_details")
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ShipmentAddress } from "@shipment/services/shipment.types";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    address?: ShipmentAddress | null;
    size?: number;
  }>(),
  { size: 18 },
);

const items = computed(() => {
  const a = props.address ?? ({} as ShipmentAddress);
  return [
    {
      kind: "phone",
      icon: "mdi-phone",
      label: t("shipment.address_row.phone"),
      value: (a.tel || a.cell || "") as string,
      color: undefined,
    },
    {
      kind: "email",
      icon: "mdi-email-outline",
      label: t("shipment.address_row.email"),
      value: (a.email || a.mail || "") as string,
      color: undefined,
    },
    {
      kind: "airport",
      icon: "mdi-airplane",
      label: t("shipment.address_row.airport"),
      value: (a.airport || a.dhl_airport || "") as string,
      color: undefined,
    },
    {
      kind: "attention",
      icon: "mdi-note-text-outline",
      label: t("shipment.address_row.attention"),
      value: (a.attention || a.attenzione || "") as string,
      color: undefined,
    },
  ];
});

const hasAny = computed(() => items.value.some((i) => !!i.value));
</script>

<style scoped>
.address-icon {
  cursor: help;
  opacity: 0.78;
  transition: opacity 0.15s ease;
}
.address-icon:hover {
  opacity: 1;
}
</style>
