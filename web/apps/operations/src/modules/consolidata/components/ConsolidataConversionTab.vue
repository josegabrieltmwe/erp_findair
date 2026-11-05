<template>
  <div>
    <!-- Antes de convertir: avisos que bloquean y cotización vencida. -->
    <v-alert
      v-if="blocking.length"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div class="font-weight-medium mb-1">
        {{ t("consolidata.conversion.blocking", { n: blocking.length }) }}
      </div>
      <ul class="pl-4">
        <li v-for="(a, i) in blocking" :key="i">
          <strong>{{ a.codice }}</strong> — {{ a.messaggio }}
        </li>
      </ul>
    </v-alert>
    <v-alert
      v-if="quoteExpired"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div class="d-flex align-center flex-wrap ga-2">
        <span>{{ t("consolidata.conversion.quoteExpired") }}</span>
        <v-spacer />
        <v-btn
          v-if="gates.recalc"
          size="small"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="store.saving"
          @click="recalc"
        >
          {{ t("consolidata.legs.recalc") }}
        </v-btn>
      </div>
    </v-alert>

    <!-- Camino 1: operar (recomendado). -->
    <v-card variant="outlined" class="mb-4">
      <v-card-title class="text-subtitle-1">
        {{ t("consolidata.conversion.operateTitle") }}
        <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
          {{ t("consolidata.conversion.recommended") }}
        </v-chip>
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">
          {{ t("consolidata.conversion.operateHelp") }}
        </p>
        <template v-if="gates.operate">
          <v-row dense>
            <v-col cols="12" md="7">
              <v-autocomplete
                v-model="cargo.selected.value"
                :items="cargo.items.value"
                :loading="cargo.searching.value"
                item-title="label"
                item-value="id"
                variant="outlined"
                density="compact"
                clearable
                no-filter
                :label="t('consolidata.conversion.existingCargo')"
                :hint="t('consolidata.conversion.existingCargoHint')"
                persistent-hint
                prepend-inner-icon="mdi-magnify"
                @update:search="cargo.onSearch"
              />
            </v-col>
            <v-col cols="12" md="5">
              <v-checkbox
                v-model="reservar"
                :label="t('consolidata.conversion.reservar')"
                :disabled="!bookingAllowed"
                :hint="
                  bookingAllowed
                    ? ''
                    : t('consolidata.conversion.bookingDisabled')
                "
                persistent-hint
                density="compact"
              />
            </v-col>
          </v-row>
          <div class="d-flex ga-2 mt-3">
            <v-btn
              color="success"
              prepend-icon="mdi-cog-play-outline"
              :loading="store.operating"
              :disabled="store.operating || blocking.length > 0"
              @click="runOperate"
            >
              {{
                hasSteps
                  ? t("consolidata.conversion.retry")
                  : t("consolidata.conversion.operate")
              }}
            </v-btn>
          </div>
        </template>
        <p v-else class="text-medium-emphasis text-body-2">
          {{
            t("consolidata.conversion.notAvailable", {
              state: t(stateI18nKey(stato)),
            })
          }}
        </p>

        <v-alert
          v-if="store.operateResult"
          :type="store.operateResult.completo ? 'success' : 'warning'"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{
            store.operateResult.completo
              ? t("consolidata.convert.complete")
              : t("consolidata.convert.incomplete", {
                  n: pending.length,
                })
          }}
          <ul v-if="pending.length" class="pl-4 mt-1">
            <li v-for="(p, i) in pending" :key="i">{{ p }}</li>
          </ul>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pasos (view=conversion): solo lectura, por house + MAWB/camión. -->
    <h3 class="text-subtitle-1 mb-2">
      {{ t("consolidata.conversion.steps") }}
    </h3>
    <p v-if="store.stepsUnavailable" class="text-medium-emphasis text-body-2">
      {{ t("consolidata.conversion.stepsUnavailable") }}
    </p>
    <p
      v-else-if="store.steps && !store.steps.length"
      class="text-medium-emphasis text-body-2"
    >
      {{ t("consolidata.conversion.noSteps") }}
    </p>
    <v-row v-else-if="groups.length" dense>
      <v-col
        v-for="g in groups"
        :key="g.global ? '__global' : g.key"
        cols="12"
        md="6"
      >
        <v-card variant="tonal" density="compact">
          <v-card-title class="text-body-2 font-weight-medium">
            {{
              g.global
                ? t("consolidata.conversion.globalGroup")
                : t("consolidata.conversion.houseGroup", { ref: g.key })
            }}
          </v-card-title>
          <v-card-text>
            <v-timeline density="compact" side="end" truncate-line="both">
              <v-timeline-item
                v-for="s in g.steps"
                :key="`${s.passo}-${s.chiave}`"
                :dot-color="stepColor(s.stato)"
                size="x-small"
              >
                <div class="d-flex align-center flex-wrap ga-2">
                  <strong>{{ stepLabel(String(s.passo)) }}</strong>
                  <v-chip
                    size="x-small"
                    :color="stepColor(s.stato)"
                    variant="tonal"
                  >
                    {{ stepStateLabel(s.stato) }}
                  </v-chip>
                  <span v-if="s.risultato_id" class="text-caption">
                    <router-link
                      v-if="s.passo === 'cargo'"
                      :to="{
                        name: 'cargo-detail',
                        params: { id: String(s.risultato_id) },
                      }"
                    >
                      #{{ s.risultato_id }}
                    </router-link>
                    <router-link
                      v-else-if="
                        s.passo === 'spedizione' || s.passo === 'camion'
                      "
                      :to="{
                        name: 'shipment-detail',
                        params: { id: String(s.risultato_id) },
                      }"
                    >
                      #{{ s.risultato_id }}
                    </router-link>
                    <template v-else>#{{ s.risultato_id }}</template>
                  </span>
                  <span
                    v-if="s.tentativi > 1"
                    class="text-caption text-medium-emphasis"
                  >
                    {{
                      t("consolidata.conversion.attempts", { n: s.tentativi })
                    }}
                  </span>
                </div>
                <div
                  v-if="s.dettaglio"
                  class="text-caption"
                  :class="
                    s.stato?.toUpperCase() === 'ERRORE'
                      ? 'text-error'
                      : 'text-medium-emphasis'
                  "
                >
                  {{ s.dettaglio }}
                </div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Camino 2: enlazar a un cargo existente (convert). -->
    <v-card v-if="gates.convert" variant="outlined" class="mt-4">
      <v-card-title class="text-subtitle-1">{{
        t("consolidata.conversion.linkTitle")
      }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t("consolidata.convert.help") }}</p>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-link-variant"
          @click="emit('convert')"
        >
          {{ t("consolidata.actions.convert") }}
        </v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useCargoSearch } from "../composables/useCargoSearch";
import { useConsolidataConfirm } from "../composables/useConfirm";
import {
  blockingWarnings,
  groupConversionSteps,
  stateI18nKey,
  stepColor,
  type projectGates,
} from "../logic";

const props = defineProps<{ gates: ReturnType<typeof projectGates> }>();
const emit = defineEmits<{ (e: "convert"): void }>();
const { t, te } = useI18n();
const store = useConsolidataStore();
const toast = useToastStore();
const confirm = useConsolidataConfirm();
const cargo = useCargoSearch();
const reservar = ref(false);

const stato = computed(() => store.project?.stato ?? "");
const blocking = computed(() =>
  blockingWarnings(store.readiness?.avisos ?? []),
);
const bookingAllowed = computed(() => store.meta?.booking_allowed === true);
const groups = computed(() => groupConversionSteps(store.steps ?? []));
const hasSteps = computed(() => (store.steps?.length ?? 0) > 0);
/** Todo lo pendiente de operate: houses, MAWB, camión y reserva (las houses ya vienen como "ref: error"). */
const pending = computed<string[]>(() => {
  const p = store.operateResult?.pendientes;
  return Array.isArray(p) ? p.map(String) : [];
});

/** Cotización respondida y ya vencida, o algún tramo con tarifa caducada. */
const quoteExpired = computed(() => {
  const p = store.project;
  if (!p) return false;
  if (p.fase === "respuesta_vencida") return true;
  return (store.readiness?.avisos ?? []).some(
    (a) => a.codice === "QUOTE_EXPIRED" && !a.ignorato,
  );
});

function stepLabel(passo: string): string {
  const key = `consolidata.conversion.step.${passo}`;
  return te(key) ? t(key) : passo;
}

function stepStateLabel(s: string): string {
  const key = `consolidata.conversion.stepState.${(s || "").toUpperCase()}`;
  return te(key) ? t(key) : s;
}

async function recalc(): Promise<void> {
  if (await store.recalc()) toast.success(t("consolidata.legs.recalculated"));
}

async function runOperate(): Promise<void> {
  if (!props.gates.operate || store.operating) return;
  const msg = reservar.value
    ? t("consolidata.confirm.operateBooking")
    : t("consolidata.confirm.operate");
  if (!(await confirm(msg))) return;
  const res = await store.operate({
    id_cargo: cargo.selected.value,
    reservar: bookingAllowed.value && reservar.value,
  });
  if (res) {
    toast.success(
      t(
        res.completo
          ? "consolidata.messages.operated"
          : "consolidata.messages.operatedPartial",
      ),
    );
  }
}

onMounted(() => {
  cargo.reset(store.project?.id_cargo ?? null);
  if (store.steps === null && !store.stepsUnavailable) void store.loadSteps();
});
</script>
