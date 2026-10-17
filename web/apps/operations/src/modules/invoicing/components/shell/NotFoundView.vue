<template>
  <v-card class="pa-6" border>
    <v-card-title>{{ t("shipment.not_found") }}</v-card-title>
    <v-card-text>
      <v-btn variant="flat" color="primary" @click="goBack">{{
        t("common.back")
      }}</v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();

function goBack(): void {
  window.location.href = "/erp/";
}
</script>
