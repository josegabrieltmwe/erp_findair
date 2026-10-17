<template>
  <v-card border rounded="lg" elevation="0" class="h-100">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
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
        {{ t("cargo.overview.edit") }}
      </v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text class="pa-4">
      <template v-if="address">
        <div class="text-body-1 font-weight-medium">
          {{ address.name || "—" }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ addressLine || "—" }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{
            [address.cap, address.city, address.country]
              .filter(Boolean)
              .join(" · ")
          }}
        </div>
        <v-divider class="my-3" />
        <div class="d-flex flex-wrap" style="row-gap: 8px; column-gap: 24px">
          <div v-if="address.tel || address.cell">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.addr.phone") }}
            </div>
            <div class="text-body-2">{{ address.tel || address.cell }}</div>
          </div>
          <div v-if="address.email">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.addr.email") }}
            </div>
            <div class="text-body-2">{{ address.email }}</div>
          </div>
          <div v-if="address.airport">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.addrsummary.airport") }}
            </div>
            <div class="text-body-2">{{ address.airport }}</div>
          </div>
          <div v-if="address.attention">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.addrsummary.attn") }}
            </div>
            <div class="text-body-2">{{ address.attention }}</div>
          </div>
        </div>
      </template>
      <EmptyState
        v-else
        icon="mdi-map-marker-off"
        :text="t('cargo.addrsummary.none')"
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

const { t } = useI18n();

/**
 * API-friendly address shape this presentational card renders. Defined
 * locally because cargo has no `shipment.types` module — the component was
 * copied from the shipment app, which imported its own ShipmentAddress.
 */
export interface SummaryAddress {
  name?: string | null;
  address?: string | string[] | null;
  cap?: string | null;
  city?: string | null;
  country?: string | null;
  tel?: string | null;
  cell?: string | null;
  email?: string | null;
  airport?: string | null;
  attention?: string | null;
}

const props = defineProps<{
  icon: string;
  title: string;
  address: SummaryAddress | null;
}>();

defineEmits<{ (e: "edit"): void }>();

const addressLine = computed(() => {
  const a = props.address?.address;
  if (Array.isArray(a)) return a.join(", ");
  return a ?? "";
});
</script>
