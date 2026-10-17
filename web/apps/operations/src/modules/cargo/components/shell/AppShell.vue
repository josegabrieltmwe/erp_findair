<template>
  <!--
    AppShell — minimal Vuetify wrapper. Page chrome (topbar, sidebar,
    tabs, action bar) is owned by each page via DashboardShell (home,
    list) or DetailShell (detail). This avoids the double-header issue
    that came from stacking a global `v-app-bar` on top of those shells.

    The shell now contributes ONLY:
      - a sticky top progress bar that reflects the cargo store's
        load/save state across every route (replaces the legacy
        in-app-bar `v-progress-linear`),
      - the `<v-main>` outlet that the page slots into.

    NOT_FOUND pages still mount under this wrapper, so they get a clean
    background without inheriting any half-broken chrome.
  -->
  <v-main class="shell-main">
    <v-progress-linear
      v-if="store.loading || store.saving"
      indeterminate
      color="primary"
      absolute
      location="top"
      height="2"
    />
    <slot />
  </v-main>
</template>

<script setup lang="ts">
import { useCargoStore } from "@cargo/stores/cargo.store";

const store = useCargoStore();
</script>

<style scoped>
.shell-main {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}
</style>
