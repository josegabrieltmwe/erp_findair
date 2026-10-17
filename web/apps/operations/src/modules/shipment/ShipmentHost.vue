<template>
  <!-- Host del módulo shipment (mismo patrón que CargoHost): reproduce el
       App.vue de shipment (AppShell + router-view). Ver módulo cargo. -->
  <AppShell>
    <!-- La identidad vive en el RouterView, no en una transición intermedia:
         cambiar de detalle a listado sustituye siempre el hijo. La key ignora
         la query para que `?view=ID` abra el drawer sin remontar la página. -->
    <router-view :key="$route.path" />
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from "@shipment/components/shell/AppShell.vue";
</script>
