<template>
  <div>
    <v-alert
      v-if="readiness"
      :type="readiness.listo ? 'success' : 'warning'"
      variant="tonal"
      class="mb-3"
    >
      {{
        readiness.listo
          ? t("consolidata.readiness.ready")
          : t("consolidata.readiness.notReady", { n: readiness.bloqueantes })
      }}
    </v-alert>
    <ConsolidataApiError :error="store.error" @close="store.clearError()" />
    <v-list v-if="readiness?.avisos.length" density="compact">
      <v-list-item
        v-for="(a, i) in readiness.avisos"
        :key="i"
        :class="{ 'text-medium-emphasis': a.ignorato }"
      >
        <template #prepend>
          <v-icon
            :color="a.severita === 'error' ? 'error' : 'warning'"
            :icon="a.severita === 'error' ? 'mdi-alert-circle' : 'mdi-alert'"
          />
        </template>
        <v-list-item-title>
          <strong>{{ a.codice }}</strong> — {{ a.messaggio }}
        </v-list-item-title>
        <v-list-item-subtitle v-if="a.ignorato">
          {{
            t("consolidata.readiness.waived", {
              reason: a.motivo_ignorato ?? "",
            })
          }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            v-if="!a.ignorato && canWaive"
            size="small"
            variant="tonal"
            @click="askWaive(a)"
          >
            {{ t("consolidata.readiness.waive") }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
    <p v-else-if="readiness" class="text-medium-emphasis">
      {{ t("consolidata.readiness.none") }}
    </p>

    <v-dialog v-model="dialog" max-width="440" persistent>
      <v-card>
        <v-card-title>{{
          t("consolidata.readiness.waiveTitle", { code: target?.codice ?? "" })
        }}</v-card-title>
        <v-card-text>
          <ConsolidataApiError :error="store.error" />
          <v-text-field
            v-model="reason"
            :label="t('consolidata.readiness.reason')"
            :error-messages="store.error?.fields.motivo"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{
            t("consolidata.common.cancel")
          }}</v-btn>
          <v-btn
            color="primary"
            :loading="store.saving"
            :disabled="reason.trim().length < 3"
            @click="confirmWaive"
          >
            {{ t("consolidata.readiness.waive") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import type { Warning } from "../types";

defineProps<{ canWaive: boolean }>();
const { t } = useI18n();
const store = useConsolidataStore();
const readiness = computed(() => store.readiness);
const dialog = ref(false);
const reason = ref("");
const target = ref<Warning | null>(null);

function askWaive(a: Warning): void {
  store.clearError();
  target.value = a;
  reason.value = "";
  dialog.value = true;
}

async function confirmWaive(): Promise<void> {
  if (
    target.value &&
    (await store.waive(
      target.value.codice,
      target.value.id_prog_sped ?? 0,
      reason.value.trim(),
    ))
  ) {
    dialog.value = false;
  }
}
</script>
