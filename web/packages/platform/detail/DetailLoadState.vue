<template>
  <!--
    Carga y error del detalle (express / cargo) dentro del MISMO shell que el
    detalle cargado: barra de plataforma + menú lateral. Las rutas de detalle
    son `fullscreen` (router/index.ts), así que sin este envoltorio el
    skeleton o el aviso quedaban sueltos en una página en blanco, sin
    navegación para salir.

    Los textos los pasa la página: cada módulo trae sus traducciones.
  -->
  <DetailShell :storage-key="storageKey" hide-platform-nav>
    <template #topbar-title>
      <div class="dls-title">{{ heading }}</div>
    </template>

    <template #nav="{ collapsed }">
      <OperationsNav :collapsed="collapsed" />
    </template>

    <div class="dls-stage">
      <v-skeleton-loader
        v-if="loading"
        type="card-avatar, list-item-three-line, table-tbody"
      />
      <v-alert
        v-else
        :type="permanent ? 'warning' : 'error'"
        prominent
        :icon="permanent ? 'mdi-file-remove-outline' : 'mdi-alert-circle'"
      >
        <div class="text-subtitle-2 mb-1">{{ title }}</div>
        <div v-if="message" class="text-body-2">{{ message }}</div>
        <div v-if="detail" class="text-caption text-medium-emphasis mt-1">
          {{ detail }}
        </div>
        <template #append>
          <div class="d-flex ga-2">
            <v-btn
              v-if="!permanent && retryLabel"
              variant="text"
              color="error"
              @click="emit('retry')"
            >
              {{ retryLabel }}
            </v-btn>
            <v-btn v-if="backTo && backLabel" variant="text" :to="backTo">
              {{ backLabel }}
            </v-btn>
          </div>
        </template>
      </v-alert>
    </div>
  </DetailShell>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import DetailShell from './DetailShell.vue';
import OperationsNav from '../platform/OperationsNav.vue';

withDefaults(
  defineProps<{
    loading?: boolean;
    /** Título de la barra (p.ej. «#123»). */
    heading?: string;
    title?: string;
    message?: string;
    /** Detalle técnico opcional (solo errores transitorios). */
    detail?: string;
    /** Error permanente (sin acceso / no existe): sin «Reintentar». */
    permanent?: boolean;
    retryLabel?: string;
    backLabel?: string;
    backTo?: RouteLocationRaw;
    storageKey?: string;
  }>(),
  {
    loading: false,
    heading: '',
    title: '',
    message: '',
    detail: '',
    permanent: false,
    retryLabel: '',
    backLabel: '',
    backTo: undefined,
    storageKey: 'tmwe:sidebar:operations',
  },
);

const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<style scoped>
.dls-stage {
  padding: 16px;
}
.dls-title {
  font-weight: 600;
}
</style>
