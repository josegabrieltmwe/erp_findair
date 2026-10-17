<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-flag-outline" size="18" class="me-2" />
      {{ t("cargo.flags.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="noivaArt9"
            :label="t('cargo.flags.no_vat_art9')"
            :disabled="readonly('noiva_art9')"
            @update:model-value="(v: any) => commit('noiva_art9', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="archiviata"
            :label="t('cargo.flags.archived')"
            @update:model-value="(v: any) => commit('archiviata', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-checkbox
            v-model="ricalcola"
            :label="t('cargo.flags.recalc_on_flight')"
            @update:model-value="(v: any) => commit('ricalcola_volo', v)"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="controllata"
            :items="controllataItems"
            :label="t('cargo.flags.verified')"
            :disabled="readonly('controllata')"
            @update:model-value="(v: any) => commitControllata(v)"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

const noivaArt9 = ref(false);
const archiviata = ref(false);
const ricalcola = ref(false);
const controllata = ref<"S" | "N" | "O">("S");

const controllataItems = computed(() => [
  { title: t("cargo.verifiche.checked"), value: "S" },
  { title: t("cargo.verifiche.not_checked"), value: "N" },
  { title: t("cargo.verifiche.offer"), value: "O" },
]);

watch(
  cargo,
  (s) => {
    noivaArt9.value = s?.noiva_art9 === "S";
    archiviata.value = s?.archiviata === "S";
    ricalcola.value = s?.ricalcola_volo === "S";
    controllata.value = (s?.controllata as "S" | "N" | "O") || "S";
  },
  { immediate: true },
);

async function commit(
  field: "noiva_art9" | "archiviata" | "ricalcola_volo",
  v: boolean | null,
): Promise<void> {
  await store.update({ [field]: v ? "S" : "N" });
}
async function commitControllata(v: "S" | "N" | "O"): Promise<void> {
  await store.update({ controllata: v });
}
</script>
