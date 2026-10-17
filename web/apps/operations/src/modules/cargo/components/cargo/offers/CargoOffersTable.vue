<template>
  <v-card :border="!embedded" :flat="embedded" rounded="lg">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-airplane" size="18" class="me-2" />
      {{ t("cargo.offers.title") }}
      <v-chip size="x-small" color="primary" variant="tonal" class="ms-2">
        {{ store.total }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-email-fast-outline"
        :disabled="!cargo.id"
        @click="rfqOpen = true"
      >
        {{ t("cargo.offers.distribute_rfq") }}
      </v-btn>
    </v-card-title>
    <v-divider v-if="!embedded" />

    <!-- When embedded in the carrier-offers modal the header lives in the
         modal frame, so we surface the RFQ action as a toolbar row here. -->
    <div v-if="embedded" class="d-flex align-center px-1 pb-2">
      <v-chip size="small" color="primary" variant="tonal">
        {{ store.total }} {{ t("cargo.offers.title") }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-email-fast-outline"
        :disabled="!cargo.id"
        @click="rfqOpen = true"
      >
        {{ t("cargo.offers.distribute_rfq") }}
      </v-btn>
    </div>

    <v-card-text :class="embedded ? 'pa-0' : 'pa-3'">
      <v-skeleton-loader v-if="store.loading" type="table-tbody" />

      <EmptyState
        v-else-if="!store.rows.length"
        icon="mdi-truck-outline"
        :title="t('cargo.offers.empty_title')"
        :text="t('cargo.offers.empty_text')"
        density="compact"
      />

      <!-- Shared listing component (same as anagrafica sub-lists): inherits
           the project sticky header / zebra / hover. Editable cells + the
           per-row actions menu live in #cell.* slots. Row-click is disabled
           (the inputs own the row); selection off. -->
      <div v-else class="offers-listing">
        <ListingDataView
          :source="listSource"
          :headers="headers"
          :selected="[]"
          :mode="viewMode"
          :sort-key-map="sortKeyMap"
          :selectable="false"
        >
          <template #cell.carrier="{ item }">
            <div class="font-weight-medium">
              {{ carrierLabel(item as CargoOffer) }}
            </div>
            <div
              v-if="(item as CargoOffer).rif_vettore"
              class="text-caption text-medium-emphasis"
            >
              {{ (item as CargoOffer).rif_vettore }}
            </div>
          </template>

          <template #cell.costo="{ item }">
            <v-text-field
              :model-value="String((item as CargoOffer).costo ?? '')"
              type="number"
              step="0.01"
              density="compact"
              variant="plain"
              hide-details
              class="text-right"
              :disabled="store.saving.has(Number((item as CargoOffer).id))"
              @change="
                (v: string) =>
                  onPatch(Number((item as CargoOffer).id), { costo: Number(v) })
              "
            />
          </template>

          <template #cell.change_valuta="{ item }">
            <v-text-field
              :model-value="(item as CargoOffer).change_valuta ?? ''"
              density="compact"
              variant="plain"
              hide-details
              :disabled="store.saving.has(Number((item as CargoOffer).id))"
              @change="
                (v: string) =>
                  onPatch(Number((item as CargoOffer).id), { change_valuta: v })
              "
            />
          </template>

          <template #cell.valutazione="{ item }">
            <v-select
              :model-value="(item as CargoOffer).valutazione ?? 'X'"
              :items="valutazioneOptions"
              item-title="title"
              item-value="value"
              density="compact"
              variant="plain"
              hide-details
              :disabled="store.saving.has(Number((item as CargoOffer).id))"
              @update:model-value="
                (v) =>
                  onPatch(Number((item as CargoOffer).id), {
                    valutazione: v as OfferPatch['valutazione'],
                  })
              "
            />
          </template>

          <template #cell.status="{ item }">
            <v-chip
              size="x-small"
              :color="statusColor(item as CargoOffer)"
              variant="tonal"
            >
              {{ statusLabel(item as CargoOffer) }}
            </v-chip>
          </template>

          <template #cell.data_risp="{ item }">
            <span class="text-no-wrap">{{
              repliedLabel(item as CargoOffer)
            }}</span>
          </template>

          <template #cell.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props: menu }">
                <v-btn
                  icon="mdi-dots-vertical"
                  size="small"
                  variant="text"
                  density="comfortable"
                  :title="t('common.actions')"
                  :disabled="store.saving.has(Number((item as CargoOffer).id))"
                  v-bind="menu"
                />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item
                  prepend-icon="mdi-reply-outline"
                  :title="t('cargo.offers.record_reply')"
                  @click="openReply(item as CargoOffer)"
                />
                <v-list-item
                  v-if="(item as CargoOffer).accettata !== 'S'"
                  prepend-icon="mdi-check-circle-outline"
                  :title="t('cargo.offers.accept_as_winner')"
                  base-color="success"
                  @click="confirmAccept(item as CargoOffer)"
                />
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-trash-can-outline"
                  :title="t('cargo.offers.remove_offer')"
                  base-color="error"
                  @click="confirmRemove(item as CargoOffer)"
                />
              </v-list>
            </v-menu>
          </template>
        </ListingDataView>
      </div>
    </v-card-text>

    <!-- Distribute RFQ dialog -->
    <v-dialog v-model="rfqOpen" max-width="640">
      <v-card>
        <v-card-title>{{ t("cargo.offers.rfq_dialog_title") }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-2">
            {{ t("cargo.offers.rfq_dialog_intro") }}
          </p>
          <!-- Las ya cotizadas se deshabilitan en vez de ocultarse: que la
               aerolínea siga en la lista, marcada, explica por qué no se
               puede elegir; quitarla parecería que no existe. -->
          <v-autocomplete
            v-model="rfqCarriers"
            :items="carrierItems"
            :loading="carriersLoading"
            :label="t('cargo.offers.carriers')"
            :item-props="carrierItemProps"
            multiple
            chips
            closable-chips
            density="compact"
            variant="outlined"
            item-title="label"
            item-value="sigla"
            prepend-inner-icon="mdi-airplane"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps">
                <template #append>
                  <v-chip
                    v-if="alreadyRequested.has(item.raw.sigla)"
                    size="x-small"
                    variant="tonal"
                    color="grey"
                  >
                    {{ t("cargo.offers.already_requested") }}
                  </v-chip>
                  <v-chip
                    v-else-if="item.raw.awbs_available > 0"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                  >
                    {{
                      t("cargo.offers.awb_stock_chip", {
                        n: item.raw.awbs_available,
                      })
                    }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
          <v-textarea
            v-model="rfqText"
            :label="t('cargo.offers.note_for_carrier')"
            density="compact"
            variant="outlined"
            rows="3"
            auto-grow
            class="mt-2"
          />
          <v-autocomplete
            v-if="fileItems.length"
            v-model="rfqFileIds"
            :items="fileItems"
            :label="t('cargo.offers.attach_files')"
            multiple
            chips
            closable-chips
            density="compact"
            variant="outlined"
            item-title="nome"
            item-value="id"
            prepend-inner-icon="mdi-paperclip"
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="rfqOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            :loading="distributing"
            :disabled="!rfqCarriers.length"
            @click="submitDistribute"
          >
            {{ t("cargo.offers.send_rfq", { count: rfqCarriers.length }) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Accept-winner confirm -->
    <v-dialog v-model="acceptOpen" max-width="460">
      <v-card>
        <v-card-title>{{ t("cargo.offers.accept_dialog_title") }}</v-card-title>
        <v-card-text>
          <p class="mb-2">
            <strong>{{
              acceptTarget ? carrierLabel(acceptTarget) : ""
            }}</strong>
            {{ " " }}{{ t("cargo.offers.accept_dialog_body") }}
          </p>
          <p class="text-caption text-medium-emphasis">
            {{ t("cargo.offers.accept_dialog_hint_pre") }}
            {{ t("cargo.offers.accept_dialog_hint_post") }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="acceptOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="success"
            rounded="lg"
            :loading="accepting"
            @click="submitAccept"
          >
            {{ t("cargo.offers.accept_winner") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Record carrier reply -->
    <v-dialog v-model="replyOpen" max-width="560">
      <v-card>
        <v-card-title>{{ t("cargo.offers.reply_dialog_title") }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            <strong>{{ replyTarget ? carrierLabel(replyTarget) : "" }}</strong>
          </p>
          <div class="d-flex ga-2">
            <v-text-field
              v-model.number="replyForm.costo"
              :label="t('cargo.col.cost')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
            <v-text-field
              v-model="replyForm.change_valuta"
              :label="t('cargo.col.currency')"
              density="compact"
              variant="outlined"
              style="max-width: 110px"
            />
            <v-text-field
              v-model="replyForm.data_risp"
              :label="t('cargo.col.replied')"
              type="datetime-local"
              density="compact"
              variant="outlined"
            />
          </div>
          <v-textarea
            v-model="replyForm.txt_risposta"
            :label="t('cargo.offers.reply_text')"
            density="compact"
            variant="outlined"
            rows="3"
            auto-grow
          />
          <v-textarea
            v-model="replyForm.txt_schedule"
            :label="t('cargo.offers.reply_schedule')"
            density="compact"
            variant="outlined"
            rows="2"
            auto-grow
          />
          <v-checkbox
            v-model="replyForm.controllata"
            :label="t('cargo.offers.mark_checked')"
            true-value="S"
            false-value="N"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="replyOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            :loading="savingReply"
            @click="submitReply"
          >
            {{ t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import { useClientSideListSource } from "@shared/listing/useClientSideListSource";
import { useListViewMode } from "@shared/listing/useListViewMode";
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoOffersStore } from "@cargo/stores/cargo_offers.store";
import {
  vettoriService,
  type VettoreOption,
} from "@cargo/services/vettori.service";
import { filesService, type CargoFile } from "@cargo/services/files.service";
import type {
  CargoOffer,
  OfferPatch,
} from "@cargo/services/cargo_offers.service";

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const { t } = useI18n();
const cargo = useCargoStore();
const { id } = storeToRefs(cargo);
const store = useCargoOffersStore();

// Shared listing wiring (client-side: rows already in the store). Columns are
// non-sortable — the rows carry inline editors, so header-sort would fight the
// operator's in-place edits — and the view is always infinite (all rows fit).
const headers = computed(() => [
  { title: t("cargo.col.carrier"), key: "carrier", sortable: false },
  {
    title: t("cargo.col.cost"),
    key: "costo",
    sortable: false,
    width: 120,
    align: "end" as const,
  },
  {
    title: t("cargo.col.currency"),
    key: "change_valuta",
    sortable: false,
    width: 80,
  },
  {
    title: t("cargo.col.rating"),
    key: "valutazione",
    sortable: false,
    width: 130,
  },
  { title: t("cargo.col.status"), key: "status", sortable: false, width: 110 },
  {
    title: t("cargo.col.replied"),
    key: "data_risp",
    sortable: false,
    width: 150,
  },
  {
    title: "",
    key: "actions",
    sortable: false,
    width: 56,
    align: "end" as const,
  },
]);
const sortKeyMap: Record<string, string> = {};
const viewMode = useListViewMode("tmwe:cargo-offers-view-mode", "infinite");
const listSource = useClientSideListSource<CargoOffer>(() => store.rows, {
  loading: () => store.loading,
  mode: () => viewMode.value,
});

const valutazioneOptions = computed(() => [
  { title: t("enums.offer_rating.pending"), value: "X" },
  { title: t("enums.offer_rating.best"), value: "M" },
  { title: t("enums.offer_rating.good"), value: "B" },
  { title: t("enums.offer_rating.medium"), value: "D" },
  { title: t("enums.offer_rating.high"), value: "A" },
  { title: t("enums.offer_rating.expensive"), value: "C" },
]);

function carrierLabel(o: CargoOffer): string {
  if (o.vettore_nome) return String(o.vettore_nome);
  if (o.vettore_sigla) return String(o.vettore_sigla);
  if (o.id_vettore) return t("cargo.offers.carrier_num", { id: o.id_vettore });
  return "—";
}

function repliedLabel(o: CargoOffer): string {
  const s = String(o.data_risp ?? "");
  if (!s || s === "0000-00-00 00:00:00") return "—";
  return s;
}

function statusColor(o: CargoOffer): string {
  if (o.accettata === "S") return "success";
  if (o.controllata === "X") return "grey";
  if (o.data_risp && o.data_risp !== "0000-00-00 00:00:00") return "primary";
  return "warning";
}

function statusLabel(o: CargoOffer): string {
  if (o.accettata === "S") return t("cargo.offers.status_winner");
  if (o.controllata === "X") return t("cargo.offers.status_locked");
  if (o.data_risp && o.data_risp !== "0000-00-00 00:00:00")
    return t("cargo.offers.status_replied");
  return t("cargo.offers.status_pending");
}

async function load(): Promise<void> {
  if (!id.value) return;
  await store.load(Number(id.value));
}

async function onPatch(
  offer_id: number,
  patch: Omit<OfferPatch, "id">,
): Promise<void> {
  await store.update({ id: offer_id, ...patch });
}

async function confirmRemove(o: CargoOffer): Promise<void> {
  if (
    !window.confirm(
      t("cargo.offers.remove_confirm", { carrier: carrierLabel(o) }),
    )
  )
    return;
  await store.remove(Number(o.id));
}

// --- Accept winner ---
const acceptOpen = ref(false);
const acceptTarget = ref<CargoOffer | null>(null);
const accepting = ref(false);

function confirmAccept(o: CargoOffer): void {
  acceptTarget.value = o;
  acceptOpen.value = true;
}

async function submitAccept(): Promise<void> {
  if (!acceptTarget.value) return;
  accepting.value = true;
  try {
    const ok = await store.acceptWinner(Number(acceptTarget.value.id));
    if (ok) acceptOpen.value = false;
  } finally {
    accepting.value = false;
  }
}

// --- Record carrier reply (G6): txt_risposta / data_risp / schedule / cost ---
const replyOpen = ref(false);
const replyTarget = ref<CargoOffer | null>(null);
const savingReply = ref(false);
const replyForm = ref<{
  costo: number | null;
  change_valuta: string;
  data_risp: string;
  txt_risposta: string;
  txt_schedule: string;
  controllata: "S" | "N";
}>({
  costo: null,
  change_valuta: "",
  data_risp: "",
  txt_risposta: "",
  txt_schedule: "",
  controllata: "N",
});

function toDatetimeLocal(v: unknown): string {
  const s = String(v ?? "");
  if (!s || s === "0000-00-00 00:00:00") return "";
  // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM" for the datetime-local input.
  return s.replace(" ", "T").slice(0, 16);
}

function openReply(o: CargoOffer): void {
  replyTarget.value = o;
  replyForm.value = {
    costo: o.costo != null ? Number(o.costo) : null,
    change_valuta: String(o.change_valuta ?? ""),
    data_risp: toDatetimeLocal(o.data_risp),
    txt_risposta: String(o.txt_risposta ?? ""),
    txt_schedule: String(o.txt_schedule ?? ""),
    controllata: o.controllata === "S" ? "S" : "N",
  };
  replyOpen.value = true;
}

async function submitReply(): Promise<void> {
  if (!replyTarget.value) return;
  savingReply.value = true;
  try {
    const f = replyForm.value;
    const patch: Omit<OfferPatch, "id"> = {
      txt_risposta: f.txt_risposta,
      txt_schedule: f.txt_schedule,
      controllata: f.controllata,
      change_valuta: f.change_valuta,
    };
    if (f.costo != null && !Number.isNaN(f.costo)) patch.costo = f.costo;
    // datetime-local returns "YYYY-MM-DDTHH:MM"; DB wants a space separator.
    if (f.data_risp) patch.data_risp = f.data_risp.replace("T", " ") + ":00";
    const ok = await store.update({
      id: Number(replyTarget.value.id),
      ...patch,
    });
    if (ok) replyOpen.value = false;
  } finally {
    savingReply.value = false;
  }
}

// --- Distribute RFQ ---
const rfqOpen = ref(false);
const rfqCarriers = ref<string[]>([]);
const rfqText = ref("");
const rfqFileIds = ref<number[]>([]);
const fileItems = ref<CargoFile[]>([]);
const distributing = ref(false);
const carrierItems = ref<VettoreOption[]>([]);
const carriersLoading = ref(false);

/**
 * Siglas que ya tienen una oferta viva en este cargo. Volver a pedirles
 * precio crearía una segunda fila para la misma aerolínea y le llegaría un
 * RFQ duplicado.
 */
const alreadyRequested = computed<Set<string>>(() => {
  const s = new Set<string>();
  for (const o of store.rows) {
    const sigla = String(o.vettore_sigla ?? "").trim();
    if (sigla) s.add(sigla);
  }
  return s;
});

function carrierItemProps(item: VettoreOption): Record<string, unknown> {
  return { disabled: alreadyRequested.value.has(item.sigla) };
}

async function loadCarriers(): Promise<void> {
  if (!id.value) return;
  carriersLoading.value = true;
  try {
    const r = await vettoriService.listCarriers(Number(id.value));
    if (r.success && r.data) carrierItems.value = r.data.carriers;
  } finally {
    carriersLoading.value = false;
  }
}

async function submitDistribute(): Promise<void> {
  if (!id.value || !rfqCarriers.value.length) return;
  distributing.value = true;
  try {
    const ok = await store.distribute(Number(id.value), {
      cargo_id: Number(id.value),
      carriers: [...rfqCarriers.value],
      rfq_text: rfqText.value,
      file_ids: [...rfqFileIds.value],
    });
    if (ok) {
      rfqOpen.value = false;
      rfqCarriers.value = [];
      rfqText.value = "";
      rfqFileIds.value = [];
    }
  } finally {
    distributing.value = false;
  }
}

async function loadFiles(): Promise<void> {
  if (!id.value) return;
  const r = await filesService.list(Number(id.value), "ext");
  if (r.success) fileItems.value = r.files;
}

// Lazy-load carrier + file lists when the dialog opens for the first time.
// El stock de AWB cambia al reservarlo en otra pantalla, así que se recarga
// en cada apertura salvo que ya se esté cargando.
watch(rfqOpen, async (open) => {
  if (open) {
    if (!carriersLoading.value) await loadCarriers();
    await loadFiles();
  }
});

onMounted(load);
watch(id, load);
</script>

<style scoped lang="scss">
/* The shared ListingDataView owns the visual style (sticky header, zebra,
   hover). Here we only adapt it for an editable list inside a modal:
   bound its height so it scrolls internally, and stop the rows from reading
   as clickable records — the inline inputs own the interaction. */
.offers-listing {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  min-height: 200px;
}

/* Rows are not record links here: drop the pointer + hover lift so the
   editors read as the primary interaction. */
.offers-listing :deep(.sdv-tr) {
  cursor: default;
}
.offers-listing :deep(.sdv-tr:hover) {
  transform: none;
  box-shadow: none;
}

/* Keep the plain inline inputs compact within the shared cell padding. */
.offers-listing :deep(td .v-input) {
  --v-input-padding-top: 0;
  margin-top: 0;
}
.offers-listing :deep(td .v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: 28px;
}
</style>
