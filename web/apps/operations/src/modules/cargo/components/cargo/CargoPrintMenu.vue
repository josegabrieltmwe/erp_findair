<template>
  <!--
    Dropdown de impresión de la barra superior del detalle de cargo. Agrupa
    TODO lo que genera PDF/imagen en un único punto:
      · Documentos AWB (MAWB/HAWB/Manifest/Pouch/M.colli/H.colli) → PDF.
      · LDV .Ex (etiqueta de la expedición) → imprimir / PDF / imagen.
  -->
  <v-menu location="bottom end" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <button
        type="button"
        class="topbar-iconbtn"
        :title="t('cargo.print.title')"
        v-bind="menuProps"
      >
        <v-icon
          :icon="anyBusy ? 'mdi-loading mdi-spin' : 'mdi-printer'"
          size="18"
        />
      </button>
    </template>

    <v-list density="compact" min-width="260" class="print-menu">
      <!-- ── LDV de la expedición ─────────────────────────────────── -->
      <v-list-subheader>{{ t("cargo.print.ldv_section") }}</v-list-subheader>
      <v-list-item
        :disabled="ldv.printBusy.value"
        prepend-icon="mdi-printer"
        :title="t('cargo.print.ldv_print')"
        @click="ldv.print()"
      />
      <v-list-item
        :disabled="ldv.pdfBusy.value"
        prepend-icon="mdi-file-pdf-box"
        :title="t('cargo.print.ldv_pdf')"
        @click="ldv.openPdf()"
      >
        <template #append>
          <v-btn
            icon="mdi-download"
            size="x-small"
            variant="text"
            :loading="ldv.pdfBusy.value"
            :title="t('cargo.print.download')"
            @click.stop="ldv.download('pdf')"
          />
        </template>
      </v-list-item>
      <v-list-item
        :disabled="ldv.imgBusy.value"
        prepend-icon="mdi-image-outline"
        :title="t('cargo.print.ldv_image')"
        @click="ldv.download('image')"
      />

      <v-divider class="my-1" />

      <!-- ── Documentos AWB (PDF) ─────────────────────────────────── -->
      <v-list-subheader>{{ t("cargo.print.awb_section") }}</v-list-subheader>
      <v-list-item
        v-for="doc in documents"
        :key="doc.kind"
        :disabled="busy"
        :prepend-icon="doc.icon"
        :title="doc.label"
        @click="doc.print()"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoDocuments } from "@cargo/composables/useCargoDocuments";
import { useCargoLabels } from "@cargo/composables/useCargoLabels";

const { t } = useI18n();
const { cargo } = storeToRefs(useCargoStore());

// Documentos AWB (PDF) — misma fuente única que el AwbDocsBar. Se excluye la
// entrada "ldv" (si existiera): la LDV se gestiona con su propio bloque, que
// ofrece los dos formatos.
const { documents: allDocs, busy } = useCargoDocuments();
const documents = computed(() => allDocs.value.filter((d) => d.kind !== "ldv"));

const ldv = useCargoLabels(() => Number(cargo.value?.id ?? 0));

const anyBusy = computed(
  () =>
    busy.value || ldv.pdfBusy.value || ldv.imgBusy.value || ldv.printBusy.value,
);
</script>

<style scoped>
.print-menu :deep(.v-list-subheader) {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  min-height: 28px;
}
</style>
