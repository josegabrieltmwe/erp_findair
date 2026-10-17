<template>
  <div class="shipment-v2" :data-theme="ui.v2Theme">
    <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <!-- Menú universal: esta página no tenía sidebar propio, así que el slot
           lleva solo la navegación (sustituye a PlatformSidebar). -->
      <template #sidebar="{ collapsed }">
        <OperationsNav :collapsed="collapsed" />
      </template>

      <template #topbar-title>
        <div class="hblock">
          <div class="topbar-shipnum">
            {{ t("cargo.fromexpress.topbar_title") }}
          </div>
          <div class="topbar-hmeta">
            {{ t("cargo.fromexpress.source_shipment", { id: fromExpressId }) }}
          </div>
        </div>
      </template>

      <template #topbar-actions>
        <ThemeToggle />
      </template>

      <v-card border class="pa-6 ma-4">
        <v-card-title>{{ t("cargo.fromexpress.card_title") }}</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" border="start">
            {{ t("cargo.fromexpress.not_implemented") }}
            <a :href="legacyHref">{{ legacyHref }}</a>
          </v-alert>
        </v-card-text>
      </v-card>
    </DashboardShell>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { useUiStore } from "@cargo/stores/ui.store";
import ThemeToggle from "@shared/platform/ThemeToggle.vue";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";

const { t } = useI18n();
const ui = useUiStore();

const fromExpressId = computed(() => window.__TMWE_CARGO__?.fromExpress ?? 0);
const legacyHref = computed(
  () => `/erp/winbody.php?pp=spedyc&ti=new&from_express=${fromExpressId.value}`,
);
</script>

<style scoped>
.hblock {
  display: flex;
  flex-direction: column;
}
</style>
