<template>
  <div class="srvflow">
    <button class="srvcell cli" type="button" @click="$emit('edit-client')">
      <span class="srvtag cli">{{ t("shell.service_flow.client") }}</span>
      <div class="sval" style="margin-top: 3px">{{ clientLabel }}</div>
      <div class="scap">{{ t("shell.service_flow.client_caption") }}</div>
    </button>
    <div class="srvarrow">
      <v-icon icon="mdi-chevron-down" size="17" />
    </div>
    <button class="srvcell vet" type="button" @click="$emit('edit-supplier')">
      <span class="srvtag vet">{{ t("shell.service_flow.carrier") }}</span>
      <div class="svrow">
        <span class="courier-logo" :class="courierLogoClass">{{
          courierLogoLabel
        }}</span>
        <span class="sval">{{ supplierLabel }}</span>
      </div>
      <div class="scap">{{ t("shell.service_flow.carrier_caption") }}</div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

/**
 * Two-cell service flow: Cliente (servizio venduto) → Vettore
 * (servizio + courier logo). All styling owned by mockup2.scss
 * (.srvflow / .srvcell / .srvtag / .svrow / .sval / .scap /
 * .srvarrow / .courier-logo).
 */
const props = defineProps<{
  clientService?: string | null;
  supplierService?: string | null;
  courierSlug?: string | null;
  courierLabel?: string | null;
}>();

defineEmits<{
  (e: "edit-client"): void;
  (e: "edit-supplier"): void;
}>();

const clientLabel = computed<string>(() => props.clientService || "—");
const supplierLabel = computed<string>(() => props.supplierService || "—");

const courierLogoClass = computed<string>(() => {
  const slug = (props.courierSlug || "").toLowerCase();
  if (slug.includes("ups")) return "ups";
  if (slug.includes("fedex")) return "fedex";
  if (slug.includes("dhl")) return "dhl";
  if (slug.includes("tnt")) return "tnt";
  return "default";
});

const courierLogoLabel = computed<string>(() => {
  if (props.courierLabel) return props.courierLabel;
  if (props.courierSlug) return props.courierSlug.toUpperCase();
  return "—";
});
</script>
