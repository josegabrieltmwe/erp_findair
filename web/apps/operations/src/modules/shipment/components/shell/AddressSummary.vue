<template>
  <v-card border rounded="lg" elevation="0" class="h-100">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-2"
    >
      <v-icon :icon="icon" class="me-2" size="18" />
      {{ title }}
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-pencil-outline"
        @click="$emit('edit')"
      >
        {{ t("common.edit") }}
      </v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text class="pa-3">
      <template v-if="address">
        <div class="d-flex align-center" style="gap: 8px">
          <CountryFlag :iso="address.country" :size="16" />
          <div class="text-body-1 font-weight-medium text-truncate">
            {{ address.name || "—" }}
          </div>
        </div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ addressLine || "—" }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{
            [address.cap, address.city, address.country]
              .filter(Boolean)
              .join(" · ")
          }}
        </div>
        <div class="mt-2">
          <AddressIconRow :address="address" :size="18" />
        </div>
      </template>
      <EmptyState
        v-else
        icon="mdi-map-marker-off"
        :text="t('shell.no_address')"
        size="small"
        class="py-2"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ShipmentAddress } from "@shipment/services/shipment.types";
import CountryFlag from "@shipment/components/common/CountryFlag.vue";
import AddressIconRow from "@shipment/components/common/AddressIconRow.vue";

const { t } = useI18n();

const props = defineProps<{
  icon: string;
  title: string;
  address: ShipmentAddress | null;
}>();

defineEmits<{ (e: "edit"): void }>();

const addressLine = computed(() => {
  const a = props.address?.address;
  if (Array.isArray(a)) return a.join(", ");
  return a ?? "";
});
</script>
