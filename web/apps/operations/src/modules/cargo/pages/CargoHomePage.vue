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
 * La home de cargo se promovió a la home global del ERP. Dentro de
 * `operations` se navega por el router SPA a `home` (sin hard-redirect al
 * servidor, que disparaba un 302 bajo el cutover). Ruta conservada solo para
 * bookmarks antiguos (/cargo/home).
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
