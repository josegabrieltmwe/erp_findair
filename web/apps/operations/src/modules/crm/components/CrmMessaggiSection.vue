<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useCrmStore } from "../stores/crm.store";
import type { EsitoInvio, MetodoInvio } from "../types";

defineProps<{ idCrm: number }>();

const store = useCrmStore();
const { t } = useI18n();

const messages = computed(() => store.messages);

const metodoLabel: Record<MetodoInvio, string> = {
  M: "eMail",
  F: "FAX",
  S: "SMS",
  C: "POSTA",
};
const esitoColor: Record<EsitoInvio, string> = {
  OK: "success",
  WRK: "info",
  KO: "error",
};
</script>

<template>
  <v-card variant="flat" border rounded="lg">
    <v-card-title
      class="text-subtitle-2 font-weight-medium d-flex align-center py-3"
    >
      <v-icon icon="mdi-email-outline" size="18" class="me-2" />
      {{ t("crm.messaggi.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div
        v-if="!messages.length"
        class="text-medium-emphasis text-center py-4"
      >
        {{ t("crm.messaggi.empty") }}
      </div>

      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t("crm.messaggi.dest") }}</th>
            <th class="text-center">{{ t("crm.messaggi.file") }}</th>
            <th class="text-center">{{ t("crm.messaggi.way") }}</th>
            <th>{{ t("crm.messaggi.data") }}</th>
            <th class="text-center">{{ t("crm.messaggi.esito") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in messages" :key="m.id">
            <td>{{ m.dest_msg }}</td>
            <td class="text-center">
              <v-icon
                v-if="m.file1_nome"
                icon="mdi-paperclip"
                size="small"
                color="primary"
              />
              <span v-else class="text-medium-emphasis">—</span>
            </td>
            <td class="text-center">{{ metodoLabel[m.metodo] ?? m.metodo }}</td>
            <td>{{ m.insert_datetime }}</td>
            <td class="text-center">
              <v-chip :color="esitoColor[m.esito]" size="x-small" label>
                {{ m.esito }}
              </v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>
