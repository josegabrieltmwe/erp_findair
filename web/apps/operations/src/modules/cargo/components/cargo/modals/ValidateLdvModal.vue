<template>
  <ModalWrapper
    name="validate_ldv"
    :title="t('cargo.modal.validate_ldv')"
    icon="mdi-check-decagram-outline"
    :max-width="720"
  >
    <div v-if="loading" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" />
      <div class="text-caption text-medium-emphasis mt-2">
        {{ t("cargo.ldv.checking") }}
      </div>
    </div>

    <template v-else-if="result">
      <v-alert
        v-if="result.ready"
        type="success"
        variant="tonal"
        density="compact"
        class="mb-3"
        icon="mdi-check-decagram"
      >
        {{ t("cargo.ldv.ready") }}
      </v-alert>
      <v-alert
        v-else
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        <i18n-t keypath="cargo.ldv.issues_found" tag="span" scope="global">
          <template #n>
            <strong>{{ issueCount }}</strong>
          </template>
        </i18n-t>
      </v-alert>

      <v-list v-if="issues.length" density="compact" class="rounded border">
        <v-list-item v-for="(issue, idx) in issues" :key="idx">
          <template #prepend>
            <v-icon
              :icon="
                issue.severity === 'error'
                  ? 'mdi-alert-circle'
                  : 'mdi-alert-outline'
              "
              :color="issue.severity === 'error' ? 'error' : 'warning'"
              size="18"
            />
          </template>
          <v-list-item-title>{{ issue.message }}</v-list-item-title>
          <v-list-item-subtitle v-if="issue.field" class="text-caption">
            {{ issue.field }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </template>

    <v-alert
      v-else-if="lastError"
      type="error"
      variant="tonal"
      density="compact"
    >
      {{ lastError }}
    </v-alert>

    <template #actions>
      <v-btn variant="text" :disabled="loading" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-refresh"
        :loading="loading"
        :disabled="!cargoId"
        @click="run"
      >
        {{ t("cargo.ldv.run_again") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  cargoActionsService,
  type ValidationResult,
  type ValidationIssue,
} from "@cargo/services/cargo_actions.service";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const { id } = storeToRefs(cargoStore);

const cargoId = computed<number | null>(() => {
  if (!id.value) return null;
  const n = Number(id.value);
  return Number.isFinite(n) ? n : null;
});

const loading = ref(false);
const result = ref<ValidationResult | null>(null);
const lastError = ref<string | null>(null);

const issues = computed<ValidationIssue[]>(() => result.value?.issues ?? []);
const issueCount = computed(() => issues.value.length);

// Auto-run when the modal opens.
watch(
  () => ui.activeModal,
  (next) => {
    if (next === "validate_ldv") void run();
  },
);

async function run(): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  lastError.value = null;
  try {
    const r = await cargoActionsService.validateLdv(cargoId.value);
    result.value = r;
    if (!r.success && r.error) lastError.value = r.error;
  } catch (e) {
    lastError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>
