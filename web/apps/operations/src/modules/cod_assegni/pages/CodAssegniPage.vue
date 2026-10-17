<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import QrGeneratorCard from "../components/QrGeneratorCard.vue";
import BatchReviewPanel from "../components/BatchReviewPanel.vue";
import DistintaExport from "../components/DistintaExport.vue";
import StatusChip from "@shared/ui/StatusChip.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import ConfirmDialog from "@shared/ui/ConfirmDialog.vue";
import {
  deleteSession,
  fetchCarriers,
  fetchPending,
  fetchSessionsByCarrier,
} from "../services/cod.service";
import type {
  Carrier,
  CaptureSession,
  CreatedSession,
  PendingSession,
} from "../types";

const { t } = useI18n();

/**
 * The batch open for review, if any.
 *
 * Two screens, one page: the list is where batches are opened and QRs minted;
 * the review is where a specialist rules on what the phone captured. Kept as a
 * ref rather than a route because this app has no router — same reason the
 * other single-purpose ERP SPAs do not.
 */
const reviewing = ref<number | null>(null);

/**
 * The default view is the work queue, not the QR generator.
 *
 * Opening a batch used to mean guessing its carrier and looking inside one by
 * one -- there was no way to ask "what needs me?". Generating a QR is something
 * you do once per remittance; resolving cheques is what the day is made of.
 */
const tab = ref<"pending" | "new" | "export">("pending");
const pending = ref<PendingSession[]>([]);
const loadingPending = ref(false);
const includeDone = ref(false);

/** The batch a delete confirm is about, plus its in-flight/ error state. */
const toDelete = ref<PendingSession | null>(null);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const carriers = ref<Carrier[]>([]);
const loadingCarriers = ref(true);
const filterCarrier = ref<number | null>(null);
const sessions = ref<CaptureSession[]>([]);
const loadingSessions = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  void loadPending();
  try {
    carriers.value = await fetchCarriers();
  } catch {
    error.value = t("errors.load_failed");
  } finally {
    loadingCarriers.value = false;
  }
});

async function loadPending(): Promise<void> {
  loadingPending.value = true;
  try {
    pending.value = await fetchPending(includeDone.value);
  } catch {
    error.value = t("errors.load_failed");
  } finally {
    loadingPending.value = false;
  }
}

watch(includeDone, loadPending);

function askDelete(s: PendingSession): void {
  deleteError.value = null;
  toDelete.value = s;
}

async function doDelete(): Promise<void> {
  const target = toDelete.value;
  if (!target) {
    return;
  }
  deleting.value = true;
  try {
    await deleteSession(target.id);
    const carrier = target.id_fornitore;
    toDelete.value = null;
    await loadPending();
    // El borrado se pide desde DOS tablas: la cola de pendientes y el listado
    // por corriere. Refrescar solo la primera dejaria la fila recien borrada
    // a la vista en la segunda, que es desde donde se borra un lote caducado
    // (esos ya no aparecen en la cola).
    if (carrier && carrier === filterCarrier.value) {
      await loadSessions(carrier);
    }
  } catch (e) {
    // The server enforces admin-only; a 403 surfaces here as plain text rather
    // than a mystery.
    deleteError.value =
      e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    deleting.value = false;
  }
}

/** Refresh the queue when coming back from a batch: it is why they left. */
watch(reviewing, (v) => {
  if (v === null) {
    void loadPending();
  }
});

const urgencyMap = computed<Record<string, { label: string; color: string }>>(
  () => ({
    errore: { label: t("cod_assegni.queue.errore"), color: "error" },
    decisione: { label: t("cod_assegni.queue.decisione"), color: "warning" },
    lettura: { label: t("cod_assegni.queue.lettura"), color: "info" },
    pronto: { label: t("cod_assegni.queue.pronto"), color: "success" },
  }),
);

const needingWork = computed(
  () => pending.value.filter((s) => s.urgenza !== "pronto").length,
);

watch(filterCarrier, async (id) => {
  if (id === null) {
    sessions.value = [];
    return;
  }
  await loadSessions(id);
});

async function loadSessions(id: number): Promise<void> {
  loadingSessions.value = true;
  try {
    sessions.value = await fetchSessionsByCarrier(id);
  } catch {
    error.value = t("errors.load_failed");
  } finally {
    loadingSessions.value = false;
  }
}

/** A new batch belongs to the carrier it was opened for: show it straight away. */
async function onCreated(session: CreatedSession): Promise<void> {
  if (session.id_fornitore) {
    filterCarrier.value = session.id_fornitore;
    await loadSessions(session.id_fornitore);
  }
}

// The batches of one carrier are a handful of rows already in memory, so the
// client-side adapter feeds the shared ListingDataView (sticky header, zebra,
// hover, paginated/infinite toggle) without a paginated endpoint behind it.
const viewMode = useListViewMode("tmwe:cod-assegni-view-mode", "paginated");
const listSource = useClientSideListSource<CaptureSession>(
  () => sessions.value,
  {
    mode: () => viewMode.value,
  },
);

const headers = computed(() => [
  { title: t("cod_assegni.session.id"), key: "id", width: 70 },
  { title: t("cod_assegni.session.bill_no"), key: "bill_no" },
  { title: t("cod_assegni.session.bill_date"), key: "bill_date" },
  { title: t("cod_assegni.session.files"), key: "files_count" },
  { title: t("cod_assegni.session.created"), key: "created" },
  { title: t("cod_assegni.session.state"), key: "state", sortable: false },
  { title: "", key: "actions", sortable: false, width: 110 },
]);

const sortKeyMap: Record<string, string> = {
  id: "id",
  bill_no: "bill_no",
  bill_date: "bill_date",
  files_count: "files_count",
  created: "created",
};

/**
 * Legacy zero dates are not dates.
 *
 * MariaDB hands back '0000-00-00' for an unset date (the schema is full of
 * them), and printing it raw shows the operator a date that never existed.
 * Same for '0000-00-00 00:00:00'.
 */
function formatDate(value: string | null): string {
  if (!value || value.startsWith("0000-00-00")) {
    return "—";
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string | null): string {
  if (!value || value.startsWith("0000-00-00")) {
    return "—";
  }
  // MySQL DATETIME is 'Y-m-d H:i:s'; Safari refuses it without the T.
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function stateOf(session: CaptureSession): { label: string; color: string } {
  if (session.stato === "C") {
    return { label: t("cod_assegni.session.closed"), color: "default" };
  }
  // Unlike every other OTP in the project, this one expires: a printed QR
  // circulates and cannot be un-sent.
  if (session.expired) {
    return { label: t("cod_assegni.session.expired"), color: "warning" };
  }
  return { label: t("cod_assegni.session.active"), color: "success" };
}
</script>

<template>
  <v-container fluid class="pa-6">
    <header class="mb-6">
      <h1 class="text-h5 mb-1">{{ t("cod_assegni.title") }}</h1>
      <p class="text-body-2 text-medium-emphasis">
        {{ t("cod_assegni.subtitle") }}
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <template v-if="reviewing !== null">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="reviewing = null"
      >
        {{ t("cod_assegni.review.back") }}
      </v-btn>

      <BatchReviewPanel :id-session="reviewing" />
    </template>

    <template v-else>
      <div class="d-flex justify-end mb-2">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-cash-check"
          :to="{ name: 'cod-reconciliation' }"
        >
          {{ t("cod_assegni.recon.link") }}
        </v-btn>
      </div>
      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="pending">
          {{ t("cod_assegni.queue.title") }}
          <v-chip
            v-if="needingWork"
            size="x-small"
            color="warning"
            variant="flat"
            class="ml-2"
          >
            {{ needingWork }}
          </v-chip>
        </v-tab>
        <v-tab value="new">{{ t("cod_assegni.qr.heading") }}</v-tab>
        <v-tab value="export">{{ t("cod_assegni.export.tab") }}</v-tab>
      </v-tabs>

      <!-- The work queue: what needs a person, across every carrier. -->
      <DistintaExport v-if="tab === 'export'" />

      <div v-if="tab === 'pending'">
        <div class="d-flex align-center mb-3">
          <p class="text-body-2 text-medium-emphasis mb-0">
            {{ t("cod_assegni.queue.subtitle") }}
          </p>
          <v-spacer />
          <v-switch
            v-model="includeDone"
            :label="t('cod_assegni.queue.include_done')"
            density="compact"
            hide-details
            color="primary"
            class="queue-switch flex-grow-0 mr-2"
          />
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-refresh"
            :loading="loadingPending"
            class="ml-2"
            @click="loadPending"
          >
            {{ t("cod_assegni.queue.refresh") }}
          </v-btn>
        </div>

        <v-skeleton-loader
          v-if="loadingPending && !pending.length"
          type="table"
        />

        <EmptyState
          v-else-if="!pending.length"
          icon="mdi-check-circle-outline"
          :title="t('cod_assegni.queue.empty')"
          :text="t('cod_assegni.queue.empty_hint')"
        />

        <v-card v-else variant="outlined">
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>{{ t("cod_assegni.session.id") }}</th>
                <th>{{ t("cod_assegni.session.carrier") }}</th>
                <th>{{ t("cod_assegni.session.bill_no") }}</th>
                <th>{{ t("cod_assegni.session.created") }}</th>
                <th class="text-center">
                  {{ t("cod_assegni.queue.to_decide") }}
                </th>
                <th class="text-center">
                  {{ t("cod_assegni.queue.to_approve") }}
                </th>
                <th class="text-center">
                  {{ t("cod_assegni.queue.reading") }}
                </th>
                <th class="text-right">{{ t("cod_assegni.queue.total") }}</th>
                <th>{{ t("cod_assegni.queue.state") }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in pending" :key="s.id">
                <td>{{ s.id }}</td>
                <td>{{ s.fornitore_nome || "—" }}</td>
                <td>{{ s.bill_no || "—" }}</td>
                <td>{{ formatDateTime(s.created) }}</td>
                <!-- The counts are the point: decide where to start without
                     opening anything. -->
                <td class="text-center">
                  <v-chip
                    v-if="s.da_decidere"
                    size="small"
                    color="warning"
                    variant="tonal"
                  >
                    {{ s.da_decidere }}
                  </v-chip>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="text-center">
                  <v-chip
                    v-if="s.da_approvare"
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ s.da_approvare }}
                  </v-chip>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="text-center">
                  <v-progress-circular
                    v-if="s.in_lettura"
                    indeterminate
                    size="16"
                    width="2"
                    color="info"
                  />
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="text-right">{{ s.totale }}</td>
                <td><StatusChip :status="s.urgenza" :map="urgencyMap" /></td>
                <td class="text-right text-no-wrap">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    @click="reviewing = s.id"
                  >
                    {{ t("cod_assegni.review.open") }}
                  </v-btn>
                  <!-- Delete is admin-only, enforced server-side (403). The
                       button shows for everyone; a non-admin who clicks it is
                       told plainly rather than left guessing why it is missing. -->
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    :title="t('cod_assegni.queue.delete')"
                    @click="askDelete(s)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </div>

      <!--
        Dialogo y aviso de error, FUERA de los bloques de pestaña a proposito.

        Vivian dentro de `tab === 'pending'`, que es un v-if: al pedir el borrado
        desde la tabla por corriere (pestana 'new') el dialogo no estaba montado
        y el boton no habria hecho nada — y un 403 de un no-admin se habria
        perdido sin que nadie lo viera. Aqui sirven a las dos tablas.
      -->
      <v-alert
        v-if="deleteError"
        type="error"
        variant="tonal"
        density="compact"
        closable
        class="mt-3"
        @click:close="deleteError = null"
      >
        {{ deleteError }}
      </v-alert>

      <ConfirmDialog
        :model-value="toDelete !== null"
        :title="t('cod_assegni.queue.delete_title')"
        :body="
          t('cod_assegni.queue.delete_body', {
            id: toDelete?.id ?? '',
            bill: toDelete?.bill_no || '—',
          })
        "
        :confirm-label="t('cod_assegni.queue.delete')"
        :cancel-label="t('common.cancel')"
        confirm-color="error"
        :loading="deleting"
        @confirm="doDelete"
        @cancel="toDelete = null"
        @update:model-value="
          (v: boolean) => {
            if (!v) toDelete = null;
          }
        "
      />

      <v-row v-if="tab === 'new'">
        <v-col cols="12" md="5" lg="4">
          <QrGeneratorCard
            :carriers="carriers"
            :loading="loadingCarriers"
            @created="onCreated"
          />
        </v-col>

        <v-col cols="12" md="7" lg="8">
          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">{{
              t("cod_assegni.session.title")
            }}</v-card-title>

            <v-card-text>
              <v-select
                v-model="filterCarrier"
                :items="carriers"
                item-title="label"
                item-value="id"
                :label="t('cod_assegni.session.carrier')"
                :loading="loadingCarriers"
                density="comfortable"
                variant="outlined"
                clearable
                hide-details
                class="mb-4"
              />

              <p
                v-if="filterCarrier === null"
                class="text-body-2 text-medium-emphasis"
              >
                {{ t("cod_assegni.session.select_carrier") }}
              </p>

              <ListingDataView
                v-else
                :source="listSource"
                :headers="headers"
                :selected="[]"
                :mode="viewMode"
                :sort-key-map="sortKeyMap"
                :selectable="false"
                @update:mode="viewMode = $event"
              >
                <!-- EVERY column needs its slot: ListingDataView forwards each
                   header to a `cell.<key>` slot and renders nothing when one is
                   missing — the column comes out blank, with no error. -->
                <template #cell.id="{ item }">
                  {{ (item as CaptureSession).id }}
                </template>

                <!-- ListingDataView types its slot rows as IdentifiedRow (just
                   `id`), so each cell casts back to the real row. Same pattern
                   as AnagraficaContattiSection and the other consumers. -->
                <template #cell.bill_no="{ item }">
                  {{ (item as CaptureSession).bill_no || "—" }}
                </template>

                <template #cell.bill_date="{ item }">
                  {{ formatDate((item as CaptureSession).bill_date) }}
                </template>

                <template #cell.created="{ item }">
                  {{ formatDateTime((item as CaptureSession).created) }}
                </template>

                <template #cell.files_count="{ item }">
                  {{ (item as CaptureSession).files_count }} /
                  {{ (item as CaptureSession).max_files }}
                </template>

                <template #cell.actions="{ item }">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    @click="reviewing = (item as CaptureSession).id"
                  >
                    {{ t("cod_assegni.review.open") }}
                  </v-btn>
                  <!-- También aquí, no solo en la cola de pendientes: un lote
                     caducado o cerrado ya NO aparece en aquella, así que esta
                     era la única tabla donde se ve y no había forma de borrarlo
                     desde la interfaz.
                     Admin-only igual que allí: lo impone el servidor (403) y el
                     botón se muestra a todos, para que quien no pueda reciba una
                     explicación en vez de un hueco. -->
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    :title="t('cod_assegni.queue.delete')"
                    @click="toDelete = item as PendingSession"
                  />
                </template>

                <template #cell.state="{ item }">
                  <v-chip
                    :color="stateOf(item as CaptureSession).color"
                    size="small"
                    variant="tonal"
                  >
                    {{ stateOf(item as CaptureSession).label }}
                  </v-chip>
                </template>
              </ListingDataView>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
/*
 * The shared switch.scss slides the ON thumb translateX(15px) inside a 37px
 * track. At density=compact the thumb starts near the right edge, so +15px
 * pushes it PAST the track and onto the label ("Mostra anche le risolte").
 *
 * Give the thumb room to land in: a wider track and a matching slide, plus real
 * spacing before the label so a stray pixel never touches the text. Scoped, so
 * only this queue switch changes.
 */
/*
 * Measured, not guessed. The 37px track ends 12px before the ON thumb does, so
 * at density=compact the thumb overshoots onto the label ("Mostra anche le
 * risolte"). The ON thumb (18px wide) must land inside the track's right edge:
 * a 14px slide leaves it flush, where the shared 20px slid it 13px past.
 */
.queue-switch :deep(.v-selection-control--dirty .v-switch__thumb) {
  transform: translateX(14px) !important;
}

/* Real breathing room after the track, so no sub-pixel ever touches the text. */
.queue-switch :deep(.v-label) {
  white-space: nowrap;
  padding-inline-start: 14px;
}
</style>
