<template>
  <AppDialog
    :open="modelValue"
    :title="t('cargo.quoteblocked.title')"
    icon="mdi-airplane-alert"
    icon-color="warning"
    size="confirm"
    @close="close"
  >
    <div v-if="loading" class="d-flex align-center py-4">
      <v-progress-circular indeterminate color="primary" size="20" width="2" />
      <span class="text-caption text-medium-emphasis ms-3">
        {{ t("cargo.quoteblocked.checking") }}
      </span>
    </div>

    <template v-else>
      <p class="mb-3">{{ t("cargo.quoteblocked.intro") }}</p>

      <!-- Un bloque por problema, con el sitio donde se arregla. El mensaje lo
           escribe el backend (Cargo_Quote_Data_Validator): es el MISMO que
           decide el 422, asi que no puede desincronizarse de lo que realmente
           bloquea. Lo que se anade aqui es el «donde», que el backend no
           sabe. -->
      <div
        v-for="(iss, idx) in errors"
        :key="`e${idx}`"
        class="qb-issue qb-issue--error"
      >
        <v-icon icon="mdi-alert-circle" size="18" class="qb-issue__icon" />
        <div class="qb-issue__body">
          <div class="qb-issue__msg">{{ issueMessage(iss) }}</div>
          <v-btn
            v-if="fixTarget(iss.code)"
            size="x-small"
            variant="text"
            color="primary"
            class="qb-issue__fix"
            :prepend-icon="fixTarget(iss.code)!.icon"
            @click="goFix(iss.code)"
          >
            {{ t(fixTarget(iss.code)!.label) }}
          </v-btn>
        </div>
      </div>

      <!-- Los `warning` NO bloquean: se listan aparte y en tono menor para que
           no compitan con lo que hay que arreglar de verdad. Se muestran
           porque afectan al precio (peso de cabecera que no cuadra con el
           detalle, bultos estimados...) y es mejor verlos ahora que descubrir
           la tarifa mal luego. -->
      <template v-if="warnings.length">
        <div class="qb-warn-head">
          {{ t("cargo.quoteblocked.warnings_head") }}
        </div>
        <div v-for="(iss, idx) in warnings" :key="`w${idx}`" class="qb-issue">
          <v-icon icon="mdi-alert-outline" size="18" class="qb-issue__icon" />
          <div class="qb-issue__body">
            <div class="qb-issue__msg">{{ issueMessage(iss) }}</div>
          </div>
        </div>
      </template>

      <!-- Sin issues y sin embargo bloqueado: pasa si el endpoint de
           validacion falla (red, 500) o si el envio no es accesible. Decirlo
           es mejor que un dialogo vacio que parece un fallo del modal. -->
      <v-alert
        v-if="!errors.length && !warnings.length"
        type="info"
        variant="tonal"
        density="compact"
      >
        {{ t("cargo.quoteblocked.unknown") }}
      </v-alert>
    </template>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">{{ t("common.close") }}</v-btn>
      <!-- Reintentar: el operador arregla los datos en otra pestana/modal y
           vuelve. Sin esto tendria que cerrar y volver a pulsar Buscar para
           saber si ya vale. -->
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="emit('recheck')"
      >
        {{ t("cargo.quoteblocked.recheck") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import type { QuoteDataIssue } from "@cargo/services/rate_sources.service";
import { translateQuoteIssue } from "@cargo/utils/quoteValidation";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    issues: QuoteDataIssue[];
    loading?: boolean;
  }>(),
  { loading: false },
);

const { t } = useI18n();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "recheck"): void;
  (e: "fix", modal: "colli" | "servizio"): void;
}>();

const errors = computed(() =>
  props.issues.filter((i) => i.severity === "error"),
);
const warnings = computed(() =>
  props.issues.filter((i) => i.severity === "warning"),
);

function issueMessage(issue: QuoteDataIssue): string {
  return translateQuoteIssue(issue, (key, params) => t(key, params));
}

/**
 * Donde se arregla cada problema.
 *
 * Los codigos son los de `Cargo_Quote_Data_Validator`. Un codigo sin entrada
 * simplemente no pinta boton — preferible a mandar al operador a un sitio
 * equivocado si el backend anade un codigo nuevo.
 */
const FIX_TARGETS: Record<
  string,
  { modal: "colli" | "servizio"; label: string; icon: string }
> = {
  NO_WEIGHT: {
    modal: "colli",
    label: "cargo.quoteblocked.fix_colli",
    icon: "mdi-package-variant",
  },
  NO_PACKAGES_COUNT: {
    modal: "colli",
    label: "cargo.quoteblocked.fix_colli",
    icon: "mdi-package-variant",
  },
  MISSING_DIMENSIONS: {
    modal: "colli",
    label: "cargo.quoteblocked.fix_colli",
    icon: "mdi-package-variant",
  },
  NO_ORIGIN: {
    modal: "servizio",
    label: "cargo.quoteblocked.fix_route",
    icon: "mdi-map-marker-path",
  },
  NO_DESTINATION: {
    modal: "servizio",
    label: "cargo.quoteblocked.fix_route",
    icon: "mdi-map-marker-path",
  },
};

function fixTarget(code: string) {
  return FIX_TARGETS[code] ?? null;
}

function goFix(code: string): void {
  const target = fixTarget(code);
  if (target) emit("fix", target.modal);
}

function close(): void {
  emit("update:modelValue", false);
}
</script>

<style scoped lang="scss">
.qb-issue {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
}
.qb-issue + .qb-issue {
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
}
.qb-issue__icon {
  margin-top: 2px;
  flex: 0 0 auto;
  color: rgb(var(--v-theme-warning));
}
.qb-issue--error .qb-issue__icon {
  color: rgb(var(--v-theme-error));
}
.qb-issue__body {
  min-width: 0;
}
.qb-issue__msg {
  font-size: 13px;
  line-height: 1.45;
}
/* Pegado al mensaje, no alineado a la derecha: el boton pertenece a ESE
   problema, y con varios en lista la columna derecha los desvinculaba. */
.qb-issue__fix {
  margin-top: 2px;
  margin-inline-start: -6px;
}
.qb-warn-head {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
