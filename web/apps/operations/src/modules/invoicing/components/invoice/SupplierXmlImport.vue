<template>
  <div>
    <!-- Paso 1: elegir el fichero -->
    <template v-if="!preview">
      <p class="text-body-2 mb-3">{{ t("invoicing.xml.intro") }}</p>
      <v-file-input
        v-model="file"
        accept=".xml,.p7m"
        :label="t('invoicing.xml.file')"
        prepend-icon=""
        prepend-inner-icon="mdi-file-xml-box"
        density="comfortable"
        variant="outlined"
        show-size
        :hint="t('invoicing.xml.hint')"
        persistent-hint
        :error-messages="fileError"
        @update:model-value="fileError = ''"
      />
      <v-alert
        v-if="failure"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ failure }}
      </v-alert>
      <div class="d-flex mt-4">
        <v-spacer />
        <v-btn
          color="primary"
          :loading="busy"
          :disabled="!pickedFile"
          @click="readFile"
        >
          {{ t("invoicing.xml.read") }}
        </v-btn>
      </div>
    </template>

    <!-- Paso 2: revisión -->
    <template v-else>
      <v-alert
        v-for="(b, i) in preview.blocking ?? []"
        :key="`b${i}`"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        {{ b }}
      </v-alert>
      <v-alert
        v-if="preview.duplicate_id"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        {{ t("invoicing.xml.duplicate") }}
        <a class="ms-1" @click.prevent="openInvoice(preview.duplicate_id)">
          {{ t("invoicing.xml.open_existing") }}
        </a>
      </v-alert>
      <v-alert
        v-for="(w, i) in preview.warnings ?? []"
        :key="`w${i}`"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        {{ w }}
      </v-alert>

      <v-row dense class="mb-2">
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.xml.supplier") }}
          </div>
          <div class="font-weight-medium">
            {{ preview.supplier?.denominazione || "—" }}
          </div>
          <div class="text-caption">
            {{
              preview.supplier?.pi_cf_full ||
              preview.supplier?.pi_cf ||
              preview.supplier?.cf ||
              ""
            }}
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.xml.number") }}
          </div>
          <div class="font-weight-medium">{{ preview.numero || "—" }}</div>
          <v-chip
            v-if="preview.is_credit_note"
            size="x-small"
            color="warning"
            variant="tonal"
          >
            {{ t("invoicing.xml.credit_note") }}
          </v-chip>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.xml.date") }}
          </div>
          <div class="font-weight-medium">{{ preview.data || "—" }}</div>
        </v-col>
      </v-row>

      <!-- Proveedor de la ficha -->
      <v-alert
        v-if="candidates.length === 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ t("invoicing.xml.no_supplier") }}
        <router-link :to="{ name: 'anagrafiche' }" class="ms-1">
          {{ t("invoicing.xml.go_customers") }}
        </router-link>
      </v-alert>
      <v-select
        v-else-if="candidates.length > 1"
        v-model="supplierId"
        :items="candidates"
        item-title="rag_soc"
        item-value="id"
        :label="t('invoicing.xml.choose_supplier')"
        density="comfortable"
        variant="outlined"
        hide-details
        class="mb-3"
      />
      <div v-else class="text-body-2 mb-3">
        <v-icon icon="mdi-check-circle" color="success" size="18" />
        {{ t("invoicing.xml.supplier_found", { name: candidates[0].rag_soc }) }}
      </div>

      <!-- Importes -->
      <div class="d-flex ga-6 mb-3 flex-wrap">
        <div>
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.invoice.net") }}
          </div>
          {{ money(preview.imponibile) }}
        </div>
        <div>
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.invoice.vat") }}
          </div>
          {{ money(preview.imposta) }}
        </div>
        <div>
          <div class="text-caption text-medium-emphasis">
            {{ t("invoicing.invoice.total") }}
          </div>
          <strong>{{ money(preview.importo_totale) }}</strong>
        </div>
      </div>

      <div v-if="(preview.righe ?? []).length" class="mb-3">
        <div class="text-subtitle-2 mb-1">
          {{ t("invoicing.xml.lines") }} ({{ preview.righe?.length }})
        </div>
        <v-table density="compact" class="xml-table">
          <thead>
            <tr>
              <th>{{ t("invoicing.xml.description") }}</th>
              <th class="text-end">{{ t("invoicing.xml.amount") }}</th>
              <th class="text-end">{{ t("invoicing.invoice.vat_rate") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in preview.righe" :key="i">
              <td>{{ l.descrizione ?? "" }}</td>
              <td class="text-end">{{ money(l.prezzo_totale) }}</td>
              <td class="text-end">{{ l.aliquota_iva ?? "" }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div v-if="plan.length" class="mb-3">
        <div class="text-subtitle-2 mb-1">
          {{ t("invoicing.xml.due_dates") }}
        </div>
        <div class="text-caption text-medium-emphasis mb-1">
          {{
            preview.payments_plan?.source === "xml"
              ? t("invoicing.xml.plan_xml")
              : t("invoicing.xml.plan_default")
          }}
        </div>
        <v-table density="compact" class="xml-table">
          <tbody>
            <tr v-for="(p, i) in plan" :key="i">
              <td>{{ p.scadenza }}</td>
              <td class="text-end">{{ money(p.importo) }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div v-if="(preview.allegati ?? []).length" class="mb-3">
        <div class="text-subtitle-2 mb-1">
          {{ t("invoicing.xml.attachments") }}
        </div>
        <v-chip
          v-for="(a, i) in preview.allegati"
          :key="i"
          size="small"
          class="me-1"
          prepend-icon="mdi-paperclip"
        >
          {{ a.nome ?? a.name ?? `#${i + 1}` }}
        </v-chip>
      </div>

      <v-alert
        v-if="failure"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        {{ failure }}
      </v-alert>

      <div class="d-flex mt-2">
        <v-btn variant="text" :disabled="busy" @click="reset">
          {{ t("common.back") }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="busy"
          :disabled="!canConfirm"
          @click="confirmImport"
        >
          {{ t("invoicing.xml.confirm") }}
        </v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  canConfirmImport,
  classifyImportError,
  defaultSupplier,
  supplierInvoiceApi,
  validateXmlFile,
  type ImportPreview,
} from "../../services/supplierInvoice.service";
import { useToastStore } from "../../stores/toast.store";

const emit = defineEmits<{ imported: [number] }>();
const { t } = useI18n();
const router = useRouter();
const toasts = useToastStore();

const file = ref<File | File[] | null>(null);
const fileError = ref("");
const failure = ref("");
const busy = ref(false);
const preview = ref<ImportPreview | null>(null);
const supplierId = ref<number | null>(null);

const pickedFile = computed<File | null>(() =>
  Array.isArray(file.value) ? (file.value[0] ?? null) : file.value,
);
const candidates = computed(() => preview.value?.supplier_candidates ?? []);
const plan = computed(() => preview.value?.payments_plan?.items ?? []);
const canConfirm = computed(() =>
  canConfirmImport(preview.value, supplierId.value),
);

function money(v: unknown): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${preview.value?.divisa || "EUR"}`;
}

function reset(): void {
  preview.value = null;
  supplierId.value = null;
  failure.value = "";
}

async function readFile(): Promise<void> {
  const f = pickedFile.value;
  const check = validateXmlFile(f);
  if (check !== "ok") {
    fileError.value = t(`invoicing.xml.err_${check}`);
    return;
  }
  busy.value = true;
  failure.value = "";
  try {
    preview.value = await supplierInvoiceApi.importPreview(f as File);
    supplierId.value = defaultSupplier(preview.value);
  } catch (e) {
    const c = classifyImportError(e);
    failure.value =
      c.kind === "invalid" && c.message
        ? c.message
        : t("invoicing.xml.read_failed");
  } finally {
    busy.value = false;
  }
}

async function confirmImport(): Promise<void> {
  if (!canConfirm.value || busy.value || !supplierId.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const res = await supplierInvoiceApi.importXml(
      pickedFile.value as File,
      supplierId.value,
    );
    toasts.push(
      "success",
      t("invoicing.xml.imported", { n: res.import?.payments_created ?? 0 }),
    );
    emit("imported", Number(res.id));
  } catch (e) {
    const c = classifyImportError(e);
    failure.value =
      c.kind === "duplicate"
        ? t("invoicing.xml.duplicate")
        : c.kind === "invalid" && c.message
          ? c.message
          : t("invoicing.xml.import_failed");
  } finally {
    busy.value = false;
  }
}

function openInvoice(id: number): void {
  void router.push({ name: "invoicing-detail", params: { id: String(id) } });
}

defineExpose({ reset });
</script>
