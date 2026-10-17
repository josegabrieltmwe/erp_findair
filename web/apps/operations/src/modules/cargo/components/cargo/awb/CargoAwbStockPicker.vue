<template>
  <!--
    Elegir el AWB del stock en vez de teclearlo.

    El campo AWB del MAWB era texto libre: se podía escribir un número que no
    existe en el stock, o uno ya usado por otra expedición, y no se
    decrementaba nada. Aquí se elige de la reserva real del vettore y el
    backend hace la operación completa (marcar usado, liberar el anterior,
    registrar el histórico) de forma transaccional.
  -->
  <v-dialog v-model="model" max-width="520" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-barcode" size="20" />
        {{ t("cargo.awb_stock.title") }}
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <div v-if="store.loadingAwbs" class="d-flex align-center ga-2 pa-4">
          <v-progress-circular indeterminate size="20" width="2" />
          <span class="text-caption">{{ t("cargo.awb_stock.loading") }}</span>
        </div>

        <template v-else>
          <div v-if="vettoreLabel" class="cm-awb-carrier">
            <v-icon icon="mdi-airplane" size="14" class="me-1" />
            {{ vettoreLabel }}
          </div>

          <!-- Vacío = no hay stock para este vettore/partner. El siguiente
               paso natural es pedirle números a la aerolínea. -->
          <div v-if="!store.awbStock.length" class="pa-6 text-center">
            <v-icon
              icon="mdi-barcode-off"
              size="34"
              class="text-medium-emphasis mb-2"
            />
            <div class="text-body-2 mb-1">
              {{ t("cargo.awb_stock.empty_title") }}
            </div>
            <div class="text-caption text-medium-emphasis mb-3">
              {{ t("cargo.awb_stock.empty_text") }}
            </div>
            <v-btn
              v-if="canRequest"
              color="primary"
              variant="tonal"
              size="small"
              rounded="lg"
              prepend-icon="mdi-email-arrow-right-outline"
              @click="requestOpen = true"
            >
              {{ t("cargo.awb_request.title") }}
            </v-btn>
          </div>

          <v-list v-else density="compact" class="py-0">
            <v-list-item
              v-for="a in store.awbStock"
              :key="a.awb"
              :disabled="store.reservingAwb"
              @click="pick(a.awb)"
            >
              <template #prepend>
                <v-icon
                  :icon="
                    a.awb === currentAwb ? 'mdi-check-circle' : 'mdi-pound'
                  "
                  :color="a.awb === currentAwb ? 'success' : undefined"
                  size="18"
                />
              </template>
              <v-list-item-title class="cm-awb-num">
                {{ a.awb }}
              </v-list-item-title>
              <template #append>
                <!-- Un AWB caduca: si vence pronto conviene gastar antes
                     otro, así que el aviso va en la propia fila. -->
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="expiryColor(a.expires_at)"
                >
                  {{ a.expires_at }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-4 py-2">
        <span class="text-caption text-medium-emphasis">
          {{ t("cargo.awb_stock.count", { n: store.awbStock.length }) }}
        </span>
        <v-spacer />
        <!-- También con stock: se pide antes de agotarlo, no después. -->
        <v-btn
          v-if="canRequest && store.awbStock.length"
          variant="text"
          size="small"
          @click="requestOpen = true"
        >
          {{ t("cargo.awb_request.request_more") }}
        </v-btn>
        <v-btn variant="text" size="small" @click="model = false">
          {{ t("common.close") }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <CargoAwbRequestDialog
      v-model="requestOpen"
      :id-vettore="store.awbStockVettoreId"
      :partner-id="store.awbStockPartnerId"
      :carrier-label="vettoreLabel"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVettoriStore } from "@cargo/stores/vettori.store";
import CargoAwbRequestDialog from "./CargoAwbRequestDialog.vue";

const props = defineProps<{
  modelValue: boolean;
  cargoId: number;
  /** AWB ya asignado, para marcarlo en la lista. */
  currentAwb?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  /** AWB reservado con éxito: el padre refresca el MAWB. */
  (e: "reserved", awb: string): void;
}>();

const { t } = useI18n();
const store = useVettoriStore();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const requestOpen = ref(false);

const vettoreLabel = computed(() => {
  const id = store.awbStockVettoreId;
  return id > 0 ? (store.carriers.find((c) => c.id === id)?.label ?? "") : "";
});

/** Sin vettore o sin partner resueltos no hay a quién pedirle nada. */
const canRequest = computed(
  () => store.awbStockVettoreId > 0 && store.awbStockPartnerId > 0,
);

/** Menos de 30 días para caducar: el número sigue siendo válido, pero conviene
    no reservarlo para un envío lejano. */
function expiryColor(iso: string): string | undefined {
  if (!iso) return undefined;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (Number.isNaN(days)) return undefined;
  if (days < 0) return "error";
  return days < 30 ? "warning" : undefined;
}

async function pick(awb: string): Promise<void> {
  const reserved = await store.reserveAwb(props.cargoId, awb);
  if (reserved) {
    emit("reserved", reserved);
    model.value = false;
    return;
  }
  // Falló: lo más probable es que otro operador lo cogiera entre la carga de
  // la lista y el clic (409). Releer deja ver el stock real.
  await store.fetchAwbStock(props.cargoId);
}

// Recargar en cada apertura: el stock es compartido entre operadores, así que
// una lista cacheada ofrecería números que ya no están libres.
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.cargoId) void store.fetchAwbStock(props.cargoId);
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.cm-awb-carrier {
  padding: 8px 16px;
  font-size: 12px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}
.cm-awb-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
