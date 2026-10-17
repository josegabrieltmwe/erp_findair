<template>
  <v-alert
    v-if="error"
    type="error"
    variant="tonal"
    closable
    class="mb-3"
    @click:close="emit('close')"
  >
    <div class="font-weight-medium">{{ t(errorI18nKey(error.code)) }}</div>
    <div v-if="error.message" class="text-body-2">{{ error.message }}</div>
    <ul v-if="fieldList.length" class="mt-2 pl-4">
      <li v-for="[field, msg] in fieldList" :key="field">
        <code>{{ field }}</code
        >: {{ msg }}
      </li>
    </ul>
    <ul v-if="error.avisos.length" class="mt-2 pl-4">
      <li v-for="(a, i) in error.avisos" :key="i">
        <strong>{{ a.codice }}</strong> — {{ a.messaggio }}
      </li>
    </ul>
    <div v-if="error.allowedStates.length" class="mt-2 text-body-2">
      {{
        t("consolidata.errors.allowedStates", {
          states: error.allowedStates.join(", "),
        })
      }}
    </div>
  </v-alert>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { errorI18nKey } from "../logic";
import type { ConsolidataError } from "../types";

const props = defineProps<{ error: ConsolidataError | null }>();
const emit = defineEmits<{ (e: "close"): void }>();
const { t } = useI18n();

const fieldList = computed(() => Object.entries(props.error?.fields ?? {}));
</script>
