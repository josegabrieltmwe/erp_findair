<template>
  <!--
    Resumen READ-ONLY de aduanas en el overview. La EDICIÓN (agencias, emails,
    Clearance/Declaration OK, dazi, instrucciones) vive ahora unificada en el
    modal `customs` (CargoCustomsBox, bloques EXPORT/IMPORT) para no duplicarla.
    Clic → abre ese modal.
  -->
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-clipboard-text-outline"
      :title="t('cargo.customsistr.title')"
      editable
      @edit="ui.openModal('customs')"
    />

    <InfoRow
      icon="mdi-airplane-takeoff"
      :title="t('cargo.customs.export')"
      :subtitle="exportSubtitle"
      :value="isOn('sdoganam_E') ? t('cargo.customs.clearance_ok') : '—'"
      clickable
      @click="ui.openModal('customs')"
    />
    <InfoRow
      icon="mdi-airplane-landing"
      :title="t('cargo.customs.import')"
      :subtitle="importSubtitle"
      :value="isOn('sdoganam_I') ? t('cargo.customs.declaration_ok') : '—'"
      clickable
      @click="ui.openModal('customs')"
    />
    <InfoRow
      v-if="dazi"
      icon="mdi-scale-balance"
      :title="t('cargo.customsistr.cargo_duties')"
      :value="dazi"
      clickable
      @click="ui.openModal('customs')"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

const { t } = useI18n();
const cargo = useCargoStore();
const ui = useUiStore();
const row = computed(() => cargo.cargo as Record<string, unknown> | null);

function isOn(key: string): boolean {
  const v = row.value?.[key];
  return v === "S" || v === true || v === 1 || v === "1";
}

const dazi = computed<string>(() => String(row.value?.cargo_dazi ?? ""));

const exportSubtitle = computed<string>(() => {
  const parts: string[] = [];
  if (isOn("acc_export")) parts.push(t("cargo.customs.required"));
  if (row.value?.export_ag_mail) parts.push(String(row.value.export_ag_mail));
  return parts.join(" · ");
});
const importSubtitle = computed<string>(() => {
  const parts: string[] = [];
  if (isOn("acc_import")) parts.push(t("cargo.customs.required"));
  if (row.value?.import_ag_mail) parts.push(String(row.value.import_ag_mail));
  return parts.join(" · ");
});
</script>

<style scoped lang="scss">
/* Sin línea separadora entre filas (anula el separador global de mockup2). */
:deep(.inforow + .inforow) {
  border-top: 0;
}
</style>
