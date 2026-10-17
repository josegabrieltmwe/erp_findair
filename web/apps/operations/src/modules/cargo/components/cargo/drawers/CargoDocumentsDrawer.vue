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
        :title="t('common.close')"
        @click="ui.closeAllDrawers()"
      />
      <aside class="docdrawer" :class="{ 'is-open': ui.docOpen }">
        <div class="dd-h">
          <v-icon icon="mdi-file-upload-outline" size="16" />
          <h3>{{ t("cargo.azioni.documents") }}</h3>
          <button
            type="button"
            class="mclose"
            :title="t('common.close')"
            @click="ui.closeAllDrawers()"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>
        <CargoFilesBox />
      </aside>

      <button
        v-if="!ui.docOpen"
        class="doc-handle"
        type="button"
        :title="t('cargo.azioni.documents')"
        @click="ui.openDoc()"
      >
        <v-icon icon="mdi-file-upload-outline" size="17" />
        <span class="doc-handle-lbl">{{ t("cargo.azioni.documents") }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { useTheme } from "vuetify";
import { useUiStore } from "@cargo/stores/ui.store";
import CargoFilesBox from "@cargo/components/cargo/CargoFilesBox.vue";

const { t } = useI18n();
const ui = useUiStore();
const theme = useTheme();
const activeTheme = computed(() => theme.global.name.value);
</script>
