<template>
  <div>
    <v-tabs v-model="subTab" class="wc-sub-tabs" color="primary" density="comfortable">
      <v-tab value="published">
        <v-icon :icon="mdiKeyVariant" class="mr-2" size="18" />
        {{ t('webcargo_credentials.tab_published') }}
      </v-tab>
      <v-tab value="realtime">
        <v-icon :icon="mdiSwapHorizontal" class="mr-2" size="18" />
        {{ t('webcargo_credentials.tab_realtime') }}
      </v-tab>
    </v-tabs>

    <v-window v-model="subTab" class="wc-sub-window">
      <v-window-item value="published">
        <WebcargoKeyPartnerTab :id-anagrafica="idAnagrafica" @refresh="$emit('refresh')" />
      </v-window-item>
      <v-window-item value="realtime">
        <WebcargoDelegationPartnerTab :id-anagrafica="idAnagrafica" @refresh="$emit('refresh')" />
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
/**
 * Contenedor de credenciales WebCargo dentro de la ficha de anagrafica: UNA
 * sola entrada en el rail vertical de `AnagraficaDetailPage.vue` ("extra
 * tab"), con sub-tabs horizontales internos para Published y Realtime.
 *
 * Existe porque esos dos sistemas viven en tablas y flujos sin relación
 * (ver WebcargoKeyPartnerTab.vue / WebcargoDelegationPartnerTab.vue), pero
 * registrarlos como dos entradas SEPARADAS del rail resultó confuso en la
 * práctica: un operador que busca "las credenciales de WebCargo de este
 * partner" no sabe de antemano si están en Published o en Realtime, y
 * mirar solo uno de los dos tabs puede parecer "sin credenciales" cuando
 * en realidad están en el otro (caso real: partner 7794 SIN filas en
 * courier genérico/KLM pero CON filas en ambos sistemas WebCargo).
 *
 * `AnagraficaDetailPage.vue` no soporta sub-tabs dentro de una entrada del
 * rail — por eso esto vive como un componente contenedor con su propio
 * `v-tabs` horizontal interno (mismo patrón que `SettingsPage.vue`), en
 * vez de tocar el componente compartido central.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiKeyVariant, mdiSwapHorizontal } from '@mdi/js';
import WebcargoKeyPartnerTab from './WebcargoKeyPartnerTab.vue';
import WebcargoDelegationPartnerTab from '../../webcargo_delegation/feature/WebcargoDelegationPartnerTab.vue';

defineProps<{
  idAnagrafica: number;
}>();
defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const subTab = ref<'published' | 'realtime'>('published');
</script>

<style scoped>
.wc-sub-tabs {
  margin-bottom: 4px;
}
.wc-sub-window {
  padding-top: 16px;
}
</style>
