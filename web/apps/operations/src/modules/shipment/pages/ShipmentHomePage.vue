<template>
  <div class="redirecting">
    <v-progress-circular indeterminate color="primary" size="22" />
    <span class="ms-3 text-body-2 text-medium-emphasis">
      Redirecting to global home…
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * La home de shipment se promovió a la home global del ERP. Dentro de
 * `operations` NO se hace hard-redirect al servidor (eso disparaba un 302 bajo
 * el cutover): se navega por el router SPA a la ruta `home`, sin recarga.
 * Se conserva la ruta solo para bookmarks antiguos (/shipment/home).
 */
import { onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

onMounted(() => {
  void router.replace({ name: "home" });
});
</script>

<style scoped>
.redirecting {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}
</style>
