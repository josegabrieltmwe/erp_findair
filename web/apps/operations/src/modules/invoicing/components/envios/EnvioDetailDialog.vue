<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
        <v-icon icon="mdi-bank-transfer-out" />
        <span>{{ title }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-tabs v-model="section" density="compact" color="primary">
        <v-tab value="resumen">{{
          t("invoicing.envios.detail.summary")
        }}</v-tab>
        <v-tab value="verificacion">{{
          t("invoicing.envios.detail.verification")
        }}</v-tab>
        <v-tab value="acuses">
          {{ t("invoicing.envios.detail.receipts") }}
          <v-chip v-if="detail" size="x-small" class="ml-1" variant="tonal">{{
            detail.acuses.length
          }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-card-text style="min-height: 280px">
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <template v-if="detail && !loading">
          <!-- Resumen -->
          <div v-if="section === 'resumen'">
            <v-alert
              v-if="
                detail.envio.retenida &&
                detail.envio.estado === 'PENDIENTE' &&
                !detail.envio.enviado
              "
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              <div class="font-weight-medium mb-1">
                {{ t("invoicing.envios.detail.retained_reasons") }}
              </div>
              <ul class="envio-list">
                <li v-for="(m, i) in detail.envio.motivos" :key="i">{{ m }}</li>
              </ul>
            </v-alert>
            <v-alert
              v-if="detail.envio.error"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              {{ detail.envio.error }}
            </v-alert>
            <v-alert
              v-for="a in detail.alertas"
              :key="a.id"
              :type="a.severidad === 'CRITICA' ? 'error' : 'warning'"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              {{ `${a.tipo} — ${a.mensaje}` }}
            </v-alert>

            <v-table density="compact">
              <tbody>
                <tr v-for="f in summaryFields" :key="f.label">
                  <th class="envio-th">{{ f.label }}</th>
                  <td>{{ f.value }}</td>
                </tr>
              </tbody>
            </v-table>

            <div
              v-if="detail.intentos.length > 1"
              class="text-overline mt-4 mb-1"
            >
              {{ t("invoicing.envios.detail.attempts") }}
            </div>
            <v-table v-if="detail.intentos.length > 1" density="compact">
              <thead>
                <tr>
                  <th>{{ t("invoicing.envios.detail.attempt") }}</th>
                  <th>{{ t("invoicing.envios.col.estado") }}</th>
                  <th>{{ t("invoicing.envios.detail.sent_at") }}</th>
                  <th>{{ t("invoicing.envios.detail.receipt") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in detail.intentos" :key="it.id">
                  <td>{{ it.id }}</td>
                  <td>{{ t(`invoicing.envios.estado.${it.estado}`) }}</td>
                  <td>{{ it.enviado ?? "—" }}</td>
                  <td>{{ it.acuse_codigo || "—" }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <!-- Verificación (DISENO §9.1-§9.2) -->
          <div v-else-if="section === 'verificacion'">
            <v-alert
              :type="certType"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              {{ certText }}
            </v-alert>
            <v-table v-if="detail.verificacion.pasos.length" density="compact">
              <thead>
                <tr>
                  <th>{{ t("invoicing.envios.detail.step") }}</th>
                  <th>{{ t("invoicing.envios.detail.rule") }}</th>
                  <th>{{ t("invoicing.envios.detail.expected") }}</th>
                  <th>{{ t("invoicing.envios.detail.obtained") }}</th>
                  <th>{{ t("invoicing.envios.detail.result") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in detail.verificacion.pasos" :key="p.id">
                  <td>{{ p.paso }}</td>
                  <td class="text-caption">{{ p.regla }}</td>
                  <td>{{ p.esperado }}</td>
                  <td>{{ p.obtenido }}</td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="p.resultado === 'OK' ? 'success' : 'error'"
                      variant="tonal"
                      >{{ p.resultado }}</v-chip
                    >
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-medium-emphasis text-body-2">
              {{ t("invoicing.envios.detail.no_steps") }}
            </div>
          </div>

          <!-- Acuses -->
          <div v-else>
            <v-table v-if="detail.acuses.length" density="compact">
              <thead>
                <tr>
                  <th>{{ t("invoicing.envios.detail.received_at") }}</th>
                  <th>{{ t("invoicing.envios.detail.receipt") }}</th>
                  <th>{{ t("invoicing.envios.col.estado") }}</th>
                  <th>{{ t("invoicing.envios.detail.message") }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in detail.acuses" :key="a.id">
                  <td class="text-no-wrap">
                    {{ a.fecha_acuse ?? a.recibido }}
                  </td>
                  <td>{{ a.tipo }} {{ a.codigo }}</td>
                  <td>{{ t(`invoicing.envios.estado.${a.estado}`) }}</td>
                  <td class="text-caption">{{ a.mensaje }}</td>
                  <td>
                    <v-btn
                      icon="mdi-download"
                      size="x-small"
                      variant="text"
                      :title="t('invoicing.envios.actions.download_receipt')"
                      @click="emit('download-receipt', a.id)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-medium-emphasis text-body-2">
              {{ t("invoicing.envios.detail.no_receipts") }}
            </div>
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { EnvioDetail } from "../../services/envios.service";

const props = defineProps<{
  modelValue: boolean;
  detail: EnvioDetail | null;
  loading?: boolean;
  initialSection?: "resumen" | "verificacion" | "acuses";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "download-receipt", idAcuse: number): void;
}>();

const { t } = useI18n();
const section = ref<"resumen" | "verificacion" | "acuses">("resumen");

watch(
  () => props.modelValue,
  (open) => {
    if (open) section.value = props.initialSection ?? "resumen";
  },
);

const title = computed(() => {
  const e = props.detail?.envio;
  if (!e) return t("invoicing.envios.detail.title");
  return t("invoicing.envios.detail.title_n", {
    numero: String(e.numero_alfanum || e.numero),
  });
});

const summaryFields = computed(() => {
  const e = props.detail?.envio;
  if (!e) return [];
  return [
    {
      label: t("invoicing.envios.col.partner"),
      value: e.partner_rag_soc ?? e.id_anagrafica_partn,
    },
    {
      label: t("invoicing.envios.col.channel"),
      value: [
        e.canal_pais,
        e.canal_tipo,
        e.canal_formato,
        e.intermediario_codice,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: t("invoicing.envios.col.estado"),
      value: t(`invoicing.envios.estado.${e.estado}`),
    },
    { label: t("invoicing.envios.col.deadline"), value: e.plazo_limite ?? "—" },
    {
      label: t("invoicing.envios.detail.deadline_case"),
      value: e.plazo_caso || "—",
    },
    {
      label: t("invoicing.envios.detail.file"),
      value: e.nombre_fichero || "—",
    },
    { label: t("invoicing.envios.detail.hash"), value: e.payload_hash || "—" },
    {
      label: t("invoicing.envios.detail.external_id"),
      value: e.id_envio_externo || "—",
    },
    { label: t("invoicing.envios.detail.sent_at"), value: e.enviado ?? "—" },
    {
      label: t("invoicing.envios.detail.answered_at"),
      value: e.respuesta ?? "—",
    },
    { label: t("invoicing.envios.detail.attempts_n"), value: e.intentos },
  ];
});

const certType = computed<"success" | "warning" | "error">(() => {
  const a = props.detail?.verificacion.autofactura;
  if (a) return a.ok ? "success" : "error";
  const c = props.detail?.verificacion.certificado;
  if (!c) return "warning";
  return c.resultado === "CERTIFICADA" ? "success" : "error";
});

const certText = computed(() => {
  const a = props.detail?.verificacion.autofactura;
  if (a) {
    return a.ok
      ? t("invoicing.envios.autofactura.verification_ok", { td: a.tipo })
      : t("invoicing.envios.autofactura.verification_ko");
  }
  const c = props.detail?.verificacion.certificado;
  if (!c) return t("invoicing.envios.verification.none");
  return c.resultado === "CERTIFICADA"
    ? t("invoicing.envios.verification.certified", { fecha: c.creado })
    : t("invoicing.envios.verification.ko");
});
</script>

<style scoped>
.envio-th {
  width: 220px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.envio-list {
  margin: 0;
  padding-left: 1.2rem;
}
</style>
