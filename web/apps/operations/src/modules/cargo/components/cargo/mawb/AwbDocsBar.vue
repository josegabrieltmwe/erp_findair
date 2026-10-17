<template>
  <!--
    Barra de documentos AWB estilo legacy (box PDF de spedyc_form.php): 6 iconos
    PDF (MAWB/POUCH/M COLLI/MNFST/HAWB/H COLLI) + INVIA + SHARE. Reutiliza los
    mismos servicios que CargoAzioniCard (cargoActionsService + los modales de
    email), sin backend nuevo — solo acerca los documentos al formulario MAWB,
    donde el operador los espera por costumbre del legacy.
  -->
  <div class="awb-docs-bar d-flex flex-wrap align-center ga-2">
    <button
      v-for="doc in documents"
      :key="doc.kind"
      type="button"
      class="awb-doc-pdf"
      :disabled="!cargoId || busy"
      :title="t('cargo.azioni.print_doc', { doc: doc.label })"
      @click="doc.print()"
    >
      <v-icon icon="mdi-file-pdf-box" size="28" color="error" />
      <span class="awb-doc-pdf__label">{{ doc.label }}</span>
    </button>

    <v-divider vertical class="mx-1" />

    <!--
      INVIA: envío del documento por email (legacy AwbDocsMail + AwbDocsMailShare).
      Eran dos botones contra el MISMO endpoint (`emailMawb()` no era más que
      `emailDocument(id,'mawb',…)`) y con dos modales casi idénticos, así que
      el operador no podía distinguirlos. Ahora hay uno solo: abre el modal
      genérico, que ya trae selector de contactos, CC, modo links/adjunto y
      elección del tipo de documento.
    -->
    <button
      type="button"
      class="awb-doc-action awb-doc-action--invia"
      :disabled="!cargoId"
      :title="t('cargo.azioni.email_doc_hint')"
      @click="ui.openEmailDocumentModal('mawb')"
    >
      <v-icon icon="mdi-email-fast-outline" size="22" />
      <span class="awb-doc-pdf__label">{{ t("common.send") }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoDocuments } from "@cargo/composables/useCargoDocuments";

const { t } = useI18n();
const ui = useUiStore();
const { cargo } = storeToRefs(useCargoStore());

const cargoId = computed<number | null>(() =>
  cargo.value ? Number(cargo.value.id) : null,
);

// Lista de documentos y estado de carga desde la fuente única compartida con
// CargoAzioniCard (sin duplicar la grid ni runPdf).
const { documents, busy } = useCargoDocuments();
</script>

<style scoped lang="scss">
.awb-docs-bar {
  padding: 4px 0;
}
.awb-doc-pdf,
.awb-doc-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 56px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(var(--v-theme-primary), 0.08);
    border-color: rgba(var(--v-theme-primary), 0.25);
  }
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}
.awb-doc-pdf__label {
  font-size: 11px;
  line-height: 1.1;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}
</style>
