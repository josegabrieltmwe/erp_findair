<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-icon
          icon="mdi-card-account-details-outline"
          size="24"
          color="primary"
        />
        <span class="text-h6">{{
          t("invoicing.fiscal.datos.page_title", {
            tipo: t(`invoicing.fiscal.datos.tipos.${tipo}`),
            id,
          })
        }}</span>
      </div>
    </template>

    <template #sidebar="{ collapsed }">
      <OperationsNav :collapsed="collapsed" />
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.fiscal.title')"
        @click="router.push({ name: 'invoicing-fiscal-config' })"
      >
        <v-icon icon="mdi-scale-balance" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.fiscal.title")
        }}</span>
      </button>
    </template>

    <div class="pa-4">
      <v-alert v-if="!valid" type="error" variant="tonal" density="compact">
        {{ t("invoicing.fiscal.datos.bad_route") }}
      </v-alert>
      <DatosFiscalesPanel v-else :id="id" :tipo="tipo" />
    </div>
  </DashboardShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import DatosFiscalesPanel from "../components/fiscal/DatosFiscalesPanel.vue";
import type { EntidadTipo } from "../services/fiscConfig.service";

/**
 * #/invoicing/datos-fiscales/:tipo/:id — sección «Datos fiscales» fuera de la
 * ficha (usuarios, enlaces directos desde alertas o desde `settings:check`).
 * La ficha de anagrafica la muestra como pestaña.
 */
const props = defineProps<{ tipo: string; id: string }>();

const { t } = useI18n();
const router = useRouter();

const TIPOS: EntidadTipo[] = ["cliente", "partner", "usuario"];

const tipo = computed<EntidadTipo>(() =>
  TIPOS.includes(props.tipo as EntidadTipo)
    ? (props.tipo as EntidadTipo)
    : "cliente",
);
const id = computed(() => Number(props.id) || 0);
const valid = computed(
  () => TIPOS.includes(props.tipo as EntidadTipo) && id.value > 0,
);
</script>

<style scoped>
.sidebar-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.85rem;
  text-align: left;
}

.sidebar-action:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.sidebar-action--rail {
  justify-content: center;
  padding: 8px;
}

.sidebar-action-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
