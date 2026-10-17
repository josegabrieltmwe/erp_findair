<template>
  <div>
    <p class="text-body-2 mb-2">{{ t("consolidata.notes.help") }}</p>
    <ConsolidataApiError :error="store.error" @close="store.clearError()" />
    <v-textarea
      v-model="text"
      :label="t('consolidata.notes.new')"
      rows="2"
      auto-grow
    />
    <v-btn
      color="primary"
      size="small"
      :loading="store.saving"
      :disabled="!text.trim()"
      @click="add"
    >
      {{ t("consolidata.notes.add") }}
    </v-btn>
    <v-list class="mt-3" density="compact">
      <v-list-item v-for="n in store.notes" :key="n.id">
        <v-list-item-title class="text-wrap">{{ n.nota }}</v-list-item-title>
        <v-list-item-subtitle
          >#{{ n.user }} · {{ shortDate(n.datetime) }}</v-list-item-subtitle
        >
      </v-list-item>
      <p v-if="!store.notes.length" class="text-medium-emphasis">
        {{ t("consolidata.notes.empty") }}
      </p>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { shortDate } from "../logic";

const { t } = useI18n();
const store = useConsolidataStore();
const text = ref("");

async function add(): Promise<void> {
  if (await store.addNote(text.value.trim())) text.value = "";
}
</script>
