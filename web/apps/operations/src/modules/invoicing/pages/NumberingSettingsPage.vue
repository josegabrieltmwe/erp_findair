<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-counter" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.numbering.title") }}</span>
      </div>
    </template>

    <template #topbar-actions>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :loading="store.loading"
        @click="reload"
      />
      <v-btn
        v-if="canAdmin"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        {{ t("invoicing.numbering.new") }}
      </v-btn>
    </template>

    <template #sidebar="{ collapsed }">
      <!-- Menú universal (sustituye a PlatformSidebar vía `hide-platform-nav`). -->
      <OperationsNav :collapsed="collapsed" />

      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.invoice.list')"
        @click="goToList"
      >
        <v-icon icon="mdi-receipt-text" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.invoice.list")
        }}</span>
      </button>
    </template>

    <div class="pa-4">
      <!-- Sin permiso de administración la página es de solo lectura. El
           bloqueo real lo hace Authz_Service en el servidor; esto solo oculta. -->
      <v-alert
        v-if="!canAdmin"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ t("invoicing.numbering.readonly_notice") }}
      </v-alert>

      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        {{ t("invoicing.numbering.intro") }}
      </v-alert>

      <!-- Un hueco en la serie es sancionable en IT: se muestra arriba. -->
      <v-alert
        v-if="store.seriesConHuecos.length > 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        <div class="font-weight-medium mb-1">
          {{ t("invoicing.numbering.gaps.title") }}
        </div>
        <ul class="numbering-gap-list">
          <li v-for="(g, i) in store.seriesConHuecos" :key="i">
            {{ g.engine.label }} — {{ g.row.periodo }}:
            {{
              t("invoicing.numbering.gaps.detail", {
                emitidos: g.row.emitidos,
                esperados: g.row.esperados,
              })
            }}
          </li>
        </ul>
      </v-alert>

      <v-progress-linear
        v-if="store.loading"
        indeterminate
        color="primary"
        class="mb-3"
      />

      <v-alert
        v-if="store.error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ store.error }}
      </v-alert>

      <div
        v-if="!store.loading && store.engines.length === 0"
        class="text-center py-8"
      >
        <v-icon
          icon="mdi-counter"
          size="48"
          class="text-medium-emphasis mb-2"
        />
        <div class="text-body-2 text-medium-emphasis">
          {{ t("invoicing.numbering.empty") }}
        </div>
      </div>

      <!-- Motores agrupados por tipo de documento: son series independientes. -->
      <template v-for="group in groups" :key="group.tipo">
        <div v-if="group.rows.length > 0" class="mb-6">
          <div class="text-subtitle-2 mb-2 d-flex align-center ga-2">
            <v-icon :icon="group.icon" size="18" />
            {{ t(group.labelKey) }}
            <v-chip size="x-small" variant="tonal">{{
              group.rows.length
            }}</v-chip>
          </div>

          <v-card variant="outlined">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th style="width: 40px" />
                  <th>{{ t("invoicing.numbering.field.label") }}</th>
                  <th>{{ t("invoicing.numbering.field.formato") }}</th>
                  <th>{{ t("invoicing.numbering.dialog.preview") }}</th>
                  <th>{{ t("invoicing.numbering.field.reinicio") }}</th>
                  <th style="width: 90px">
                    {{ t("invoicing.numbering.field.is_default") }}
                  </th>
                  <th v-if="canAdmin" style="width: 100px" />
                </tr>
              </thead>
              <tbody>
                <template v-for="e in group.rows" :key="e.id">
                  <tr>
                    <td>
                      <v-btn
                        :icon="
                          expanded[e.id]
                            ? 'mdi-chevron-down'
                            : 'mdi-chevron-right'
                        "
                        size="x-small"
                        variant="text"
                        @click="toggle(e.id)"
                      />
                    </td>
                    <td>
                      <div class="font-weight-medium">{{ e.label }}</div>
                      <div class="text-caption text-medium-emphasis">
                        {{ e.codice }}
                      </div>
                    </td>
                    <td>
                      <code class="numbering-code">{{ e.formato }}</code>
                    </td>
                    <td>
                      <code class="numbering-code">{{ previewOf(e) }}</code>
                    </td>
                    <td>
                      {{ t(`invoicing.numbering.reinicio.${e.reinicio}`) }}
                    </td>
                    <td>
                      <v-chip
                        v-if="e.is_default === 'S'"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        {{ t("invoicing.numbering.default_chip") }}
                      </v-chip>
                    </td>
                    <td v-if="canAdmin">
                      <v-btn
                        icon="mdi-pencil"
                        size="x-small"
                        variant="text"
                        @click="openEdit(e)"
                      />
                      <v-btn
                        icon="mdi-delete"
                        size="x-small"
                        variant="text"
                        color="error"
                        @click="askDelete(e)"
                      />
                    </td>
                  </tr>

                  <!-- Detalle: contadores por periodo + auditoría de huecos. -->
                  <tr v-if="expanded[e.id]">
                    <td :colspan="canAdmin ? 7 : 6" class="pa-0">
                      <div class="pa-4 numbering-detail">
                        <v-progress-circular
                          v-if="store.loadingDetail[e.id]"
                          indeterminate
                          size="20"
                          width="2"
                        />
                        <template v-else>
                          <div class="text-caption font-weight-medium mb-2">
                            {{ t("invoicing.numbering.counters.title") }}
                          </div>
                          <div
                            v-if="(store.counters[e.id] ?? []).length === 0"
                            class="text-caption text-medium-emphasis"
                          >
                            {{ t("invoicing.numbering.counters.empty") }}
                          </div>
                          <v-table
                            v-else
                            density="compact"
                            class="numbering-subtable"
                          >
                            <thead>
                              <tr>
                                <th>
                                  {{
                                    t("invoicing.numbering.counters.periodo")
                                  }}
                                </th>
                                <th>
                                  {{ t("invoicing.numbering.counters.last") }}
                                </th>
                                <th>
                                  {{ t("invoicing.numbering.counters.next") }}
                                </th>
                                <th>
                                  {{
                                    t("invoicing.numbering.counters.emitted")
                                  }}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="c in store.counters[e.id]" :key="c.id">
                                <td>
                                  {{
                                    c.periodo === "-"
                                      ? t("invoicing.numbering.reinicio.nunca")
                                      : c.periodo
                                  }}
                                </td>
                                <td>{{ c.ultimo_valore }}</td>
                                <td>
                                  <code class="numbering-code">{{
                                    nextOf(e, c.ultimo_valore)
                                  }}</code>
                                </td>
                                <td>{{ emittedIn(e.id, c.periodo) }}</td>
                              </tr>
                            </tbody>
                          </v-table>
                        </template>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </v-table>
          </v-card>
        </div>
      </template>

      <NumberingRangesPanel :can-admin="canAdmin" />
    </div>

    <NumberingEngineDialog
      v-model="dialogOpen"
      :engine="editing"
      @saved="onSaved"
    />

    <v-dialog v-model="deleteOpen" max-width="460">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          t("invoicing.numbering.delete.title")
        }}</v-card-title>
        <v-card-text>
          <p>
            {{
              t("invoicing.numbering.delete.confirm", {
                label: deleting?.label ?? "",
              })
            }}
          </p>
          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            {{ t("invoicing.numbering.delete.note") }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="store.saving"
            @click="confirmDelete"
          >
            {{ t("common.delete") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </DashboardShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import NumberingEngineDialog from "../components/numbering/NumberingEngineDialog.vue";
import NumberingRangesPanel from "../components/numbering/NumberingRangesPanel.vue";
import { useNumberingStore } from "../stores/numbering.store";
import { can } from "../services/http";
import {
  formatSample,
  type NumberingEngine,
  type NumberingEngineInput,
} from "../services/numbering.service";

const { t } = useI18n();
const router = useRouter();
const store = useNumberingStore();

// La numeración es configuración propia del partner: no exige ser TMWE.
// La capability la inyecta el wrapper PHP y el backend la vuelve a comprobar
// en cada escritura — esto solo decide qué se muestra.
const canAdmin = computed(() => can.adminNumbering());

const expanded = ref<Record<number, boolean>>({});
const dialogOpen = ref(false);
const editing = ref<NumberingEngine | null>(null);
const deleteOpen = ref(false);
const deleting = ref<NumberingEngine | null>(null);

const groups = computed(() => [
  {
    tipo: "A",
    rows: store.activas,
    labelKey: "numbering.tipo.active",
    icon: "mdi-receipt-text-arrow-right",
  },
  {
    tipo: "P",
    rows: store.pasivas,
    labelKey: "numbering.tipo.passive",
    icon: "mdi-receipt-text-arrow-left",
  },
]);

function previewOf(e: NumberingEngine): string {
  return formatSample(
    e.formato,
    e.padding,
    e.valore_inicial || 1,
    e.tipo_fattura,
  );
}

function nextOf(e: NumberingEngine, last: number): string {
  return formatSample(e.formato, e.padding, Number(last) + 1, e.tipo_fattura);
}

function emittedIn(engineId: number, periodo: string): number {
  const row = (store.audits[engineId] ?? []).find((a) => a.periodo === periodo);
  return row?.emitidos ?? 0;
}

function toggle(id: number): void {
  const open = !expanded.value[id];
  expanded.value = { ...expanded.value, [id]: open };
  if (open) void store.loadDetail(id);
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(e: NumberingEngine): void {
  editing.value = e;
  dialogOpen.value = true;
}

async function onSaved(
  payload: NumberingEngineInput & { id?: number },
): Promise<void> {
  const ok = payload.id
    ? await store.update(payload.id, payload)
    : (await store.create(payload)) !== null;
  if (ok) dialogOpen.value = false;
}

function askDelete(e: NumberingEngine): void {
  deleting.value = e;
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return;
  const ok = await store.remove(deleting.value.id);
  if (ok) {
    deleteOpen.value = false;
    deleting.value = null;
  }
}

function reload(): void {
  void store.load();
}

function goToList(): void {
  void router.push({ name: "invoicing-list" });
}

onMounted(() => {
  void store.load();
});

onBeforeUnmount(() => {
  store.reset();
});
</script>

<style scoped>
.numbering-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.numbering-detail {
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.numbering-subtable {
  max-width: 620px;
}

.numbering-gap-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
}

.sidebar-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.85rem;
  text-align: left;
}

.sidebar-action:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.sidebar-action--rail {
  justify-content: center;
  padding: 8px;
}

.sidebar-action-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
