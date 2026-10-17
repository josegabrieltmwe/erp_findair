<template>
  <v-card border class="pa-6">
    <v-card-title>{{ t("shipment.title_new") }}</v-card-title>
    <v-card-text>
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        class="me-3"
      />
      <span v-if="loading">{{ t("shipment.loading") }}</span>
      <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{
        error
      }}</v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { http } from "@shipment/services/http";

const { t } = useI18n();
const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  const boot = window.__TMWE_SHIPMENT__;
  const cargoId = boot?.fromCargo ?? 0;
  const tpc = boot?.tpc ?? "";
  if (!cargoId || !tpc) {
    error.value = "Missing from_cargo/tpc params";
    loading.value = false;
    return;
  }
  try {
    const res = await http<{
      success: boolean;
      shipment_id?: number;
      error?: string;
    }>("/ajax_shipment_from_cargo", {
      method: "POST",
      body: { cargo_id: cargoId, tpc },
    });
    if (res.success && res.shipment_id) {
      router.replace({
        name: "shipment-detail",
        params: { id: String(res.shipment_id) },
      });
    } else {
      error.value = res.error || "Failed to create shipment from cargo";
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
