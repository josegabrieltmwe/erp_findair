<template>
  <!--
    Host del módulo cargo integrado "tal cual" en operations. Reproduce el
    App.vue original de cargo (AppShell = <v-main> + AppToaster), y monta la
    sub-ruta de cargo vía <router-view>. Las pages de cargo traen su propio
    DashboardShell donde aplica, así que este host NO añade chrome extra.
  -->
  <AppShell>
    <!-- Remonta solo cuando cambia la ruta real (detalle/listado), no cuando
         cambia `?view=ID`, que pertenece al drawer de previsualización. -->
    <router-view :key="$route.path" />
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from "@cargo/components/shell/AppShell.vue";
</script>
