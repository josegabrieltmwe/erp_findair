<template>
  <Teleport to="body">
    <div
      class="shipment-v2 v-application"
      :class="`v-theme--${activeTheme}`"
      :data-theme="ui.v2Theme"
    >
      <button
        v-if="ui.docOpen"
        class="backdrop"
        type="button"
        title="Chiudi"
        @click="ui.closeAllDrawers()"
      />
      <aside class="docdrawer" :class="{ 'is-open': ui.docOpen }">
        <div class="dd-h">
          <v-icon icon="mdi-file-upload-outline" size="16" />
          <h3>{{ t("shipment.documents_drawer.title") }}</h3>
          <button
            type="button"
            class="mclose"
            title="Chiudi"
            @click="ui.closeAllDrawers()"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>
        <ShipmentFilesBox />
      </aside>

      <button
        v-if="!ui.docOpen"
        class="doc-handle"
        type="button"
        title="Documenti"
        @click="ui.openDoc()"
      >
        <v-icon icon="mdi-file-upload-outline" size="17" />
        <span class="doc-handle-lbl">{{
          t("shipment.documents_drawer.title")
        }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useTheme } from "vuetify";
import { useUiStore } from "@shipment/stores/ui.store";
import ShipmentFilesBox from "@shipment/components/shipment/ShipmentFilesBox.vue";

const { t } = useI18n();

const ui = useUiStore();
const theme = useTheme();
const activeTheme = computed(() => theme.global.name.value);
</script>
