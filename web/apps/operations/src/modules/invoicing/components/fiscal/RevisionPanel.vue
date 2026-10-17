<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-3">
      <v-text-field
        v-model="fecha"
        type="date"
        :label="t('invoicing.fiscal.revision.fecha')"
        density="compact"
        hide-details
        class="fisc-date"
      />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-magnify-scan"
        :loading="loading"
        @click="load(false)"
      >
        {{ t("invoicing.fiscal.revision.run") }}
      </v-btn>
      <v-btn
        v-if="store.canWrite"
        variant="tonal"
        color="warning"
        prepend-icon="mdi-bell-ring-outline"
        :loading="loading"
        @click="load(true)"
      >
        {{ t("invoicing.fiscal.revision.run_alerts") }}
      </v-btn>
    </div>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3 text-body-2"
    >
      {{ t("invoicing.fiscal.revision.intro") }}
    </v-alert>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <template v-if="report">
      <div class="fisc-kpis mb-3">
        <v-card
          variant="tonal"
          :color="report.totales.solapes ? 'error' : 'success'"
          class="pa-3"
        >
          <div class="text-h5">{{ report.totales.solapes }}</div>
          <div class="text-caption">
            {{ t("invoicing.fiscal.revision.overlaps") }}
          </div>
        </v-card>
        <v-card
          variant="tonal"
          :color="report.totales.huecos ? 'error' : 'success'"
          class="pa-3"
        >
          <div class="text-h5">{{ report.totales.huecos }}</div>
          <div class="text-caption">
            {{ t("invoicing.fiscal.revision.gaps") }}
          </div>
        </v-card>
        <v-card
          variant="tonal"
          :color="report.totales.vencen ? 'warning' : 'success'"
          class="pa-3"
        >
          <div class="text-h5">{{ report.totales.vencen }}</div>
          <div class="text-caption">
            {{
              t("invoicing.fiscal.revision.expiring", {
                dias: report.aviso_dias,
              })
            }}
          </div>
        </v-card>
      </div>
      <div v-if="ranWithAlerts" class="text-caption mb-2">
        {{
          t("invoicing.fiscal.revision.alerts_result", {
            abiertas: report.alertas_abiertas,
            cerradas: report.alertas_cerradas,
          })
        }}
      </div>

      <v-expansion-panels multiple variant="accordion">
        <v-expansion-panel
          v-for="(sec, tabla) in report.secciones"
          :key="tabla"
        >
          <v-expansion-panel-title>
            <span class="font-weight-medium">{{
              t(`invoicing.fiscal.tabla.${tabla}`)
            }}</span>
            <v-chip
              size="x-small"
              class="ml-2"
              :color="count(sec) ? 'warning' : 'success'"
              variant="tonal"
            >
              {{ count(sec) }}
            </v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div v-if="count(sec) === 0" class="text-medium-emphasis">
              {{ t("invoicing.fiscal.revision.clean") }}
            </div>
            <v-table v-else density="compact">
              <thead>
                <tr>
                  <th>{{ t("invoicing.fiscal.revision.kind") }}</th>
                  <th>{{ t("invoicing.fiscal.revision.scope") }}</th>
                  <th>{{ t("invoicing.fiscal.revision.detail") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(o, i) in sec.overlaps" :key="`o${i}`">
                  <td>
                    <v-chip size="x-small" color="error">{{
                      t("invoicing.fiscal.revision.overlap")
                    }}</v-chip>
                  </td>
                  <td>{{ o.ambito }}</td>
                  <td>#{{ o.id_a }} · #{{ o.id_b }}</td>
                </tr>
                <tr v-for="(g, i) in sec.gaps" :key="`g${i}`">
                  <td>
                    <v-chip size="x-small" color="error">{{
                      t("invoicing.fiscal.revision.gap")
                    }}</v-chip>
                  </td>
                  <td>{{ g.ambito }}</td>
                  <td>
                    {{ g.desde }} → {{ g.hasta }} (#{{ g.id_antes }} · #{{
                      g.id_despues
                    }})
                  </td>
                </tr>
                <tr v-for="(x, i) in sec.expiring" :key="`x${i}`">
                  <td>
                    <v-chip size="x-small" color="warning">{{
                      t("invoicing.fiscal.revision.expires")
                    }}</v-chip>
                  </td>
                  <td>{{ x.ambito }}</td>
                  <td>#{{ x.id }} · {{ x.data_fine }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type ReviewReport,
  type ReviewSection,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";

const { t } = useI18n();
const store = useFiscConfigStore();

const fecha = ref(store.hoy);
const report = ref<ReviewReport | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const ranWithAlerts = ref(false);

async function load(withAlerts: boolean): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    report.value = withAlerts
      ? await fiscConfigService.runRevision(fecha.value)
      : await fiscConfigService.revision(fecha.value);
    ranWithAlerts.value = withAlerts;
  } catch (e) {
    error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

function count(sec: ReviewSection): number {
  return sec.overlaps.length + sec.gaps.length + sec.expiring.length;
}

onMounted(() => {
  void load(false);
});
</script>

<style scoped>
.fisc-date {
  max-width: 200px;
}

.fisc-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
</style>
