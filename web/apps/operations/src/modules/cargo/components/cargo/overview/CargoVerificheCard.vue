<template>
  <div class="card-collap">
    <details>
      <summary>
        <v-icon icon="mdi-note-text-outline" size="14" />
        <span class="cardh-title-collap">{{ t("cargo.verifiche.title") }}</span>
        <span class="vmini">
          <span class="vdot" :class="verifiedClass" :title="verifiedTitle">
            <v-icon icon="mdi-check-circle-outline" size="12" />
          </span>
          <span class="vdot" :class="archiviClass" :title="archiviTitle">
            <v-icon icon="mdi-archive-outline" size="12" />
          </span>
          <span class="vdot" :class="noteClass" :title="noteTitle">
            <v-icon icon="mdi-note-outline" size="12" />
          </span>
        </span>
        <v-icon icon="mdi-chevron-right" size="14" class="chev" />
      </summary>
      <div class="vbody">
        <InfoRow
          icon="mdi-check-circle-outline"
          :title="t('cargo.verifiche.verified_offer')"
          :value="controllataLabel"
        />
        <InfoRow
          icon="mdi-archive-outline"
          :title="t('cargo.verifiche.archived')"
          :value="archiviLabel"
        />
        <InfoRow
          v-if="noteOperative"
          icon="mdi-note-outline"
          :title="t('cargo.verifiche.operational_notes')"
          :subtitle="noteOperative"
        />
        <InfoRow
          v-if="noteXdest"
          icon="mdi-note-outline"
          :title="t('cargo.verifiche.recipient_notes')"
          :subtitle="noteXdest"
        />
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);

function get(field: string): string {
  return String(
    (cargo.value as unknown as Record<string, unknown> | null)?.[field] ?? "",
  );
}

const controllata = computed(() => get("controllata"));
const controllataLabel = computed(() => {
  switch (controllata.value) {
    case "S":
      return t("cargo.verifiche.checked");
    case "O":
      return t("cargo.verifiche.offer");
    case "N":
    default:
      return t("cargo.verifiche.not_checked");
  }
});
const verifiedClass = computed(() => (controllata.value === "S" ? "on" : ""));
const verifiedTitle = computed(() =>
  controllata.value === "S"
    ? t("cargo.verifiche.verified_ok")
    : t("cargo.verifiche.verified_state", { state: controllataLabel.value }),
);

const archiviata = computed(() => get("archiviata"));
const archiviClass = computed(() => (archiviata.value === "S" ? "on" : ""));
const archiviTitle = computed(() =>
  archiviata.value === "S"
    ? t("cargo.verifiche.archived")
    : t("cargo.verifiche.active"),
);
const archiviLabel = computed(() =>
  archiviata.value === "S" ? t("common.yes") : t("common.no"),
);

const noteXdest = computed(() => get("note_x_destin"));
const noteOperative = computed(() => get("note_operative"));
const noteClass = computed(() =>
  noteXdest.value || noteOperative.value ? "on" : "",
);
const noteTitle = computed(() =>
  noteXdest.value || noteOperative.value
    ? t("cargo.verifiche.notes_present")
    : t("cargo.verifiche.no_notes"),
);
</script>
