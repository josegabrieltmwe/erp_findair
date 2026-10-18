<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.convert.title") }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t("consolidata.convert.help") }}</p>
        <ConsolidataApiError :error="error" />
        <v-autocomplete
          v-model="idCargo"
          :items="cargoItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          variant="outlined"
          density="compact"
          clearable
          no-filter
          :label="t('consolidata.convert.cargoSearch')"
          :no-data-text="t('consolidata.convert.cargoNoData')"
          :hint="t('consolidata.convert.cargoId')"
          persistent-hint
          prepend-inner-icon="mdi-magnify"
          :error-messages="error?.fields.id_cargo"
          @update:search="onSearch"
        />

        <template v-if="result">
          <v-alert
            :type="result.completo ? 'success' : 'warning'"
            variant="tonal"
            class="mb-2"
          >
            {{
              result.completo
                ? t("consolidata.convert.complete")
                : t("consolidata.convert.incomplete", { n: result.pendientes })
            }}
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("consolidata.shipments.ref") }}</th>
                <th>{{ t("consolidata.convert.shipmentId") }}</th>
                <th>{{ t("consolidata.convert.result") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in result.houses" :key="h.ref">
                <td>{{ h.ref }}</td>
                <td>{{ h.id_spedizione ?? "—" }}</td>
                <td>
                  <v-chip v-if="h.success" size="small" color="success">
                    {{
                      h.idempotent
                        ? t("consolidata.convert.alreadyLinked")
                        : t("consolidata.convert.linked")
                    }}
                  </v-chip>
                  <v-chip v-else size="small" color="warning">
                    {{
                      h.pendiente ? t("consolidata.convert.noShipment") : h.code
                    }}
                  </v-chip>
                  <span v-if="h.error" class="text-caption ml-2">{{
                    h.error
                  }}</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.close")
        }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!idCargo"
          @click="emit('submit', Number(idCargo))"
        >
          {{
            result
              ? t("consolidata.convert.retry")
              : t("consolidata.convert.run")
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { cargoListService } from "@cargo/services/cargo.service";
import type { ConsolidataError, ConversionResult } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  result: ConversionResult | null;
  linkedCargo?: number | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", idCargo: number): void;
}>();
const { t } = useI18n();
const idCargo = ref<number | null>(null);

interface CargoItem {
  id: number;
  label: string;
}
const cargoItems = ref<CargoItem[]>([]);
const searching = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function toItem(row: {
  id: number;
  awb?: unknown;
  cliente?: unknown;
}): CargoItem {
  const awb = typeof row.awb === "string" && row.awb ? ` · ${row.awb}` : "";
  const cli =
    typeof row.cliente === "string" && row.cliente ? ` · ${row.cliente}` : "";
  return { id: Number(row.id), label: `#${row.id}${awb}${cli}` };
}

async function search(q: string): Promise<void> {
  searching.value = true;
  try {
    const r = await cargoListService.fetch({
      search: q,
      per_page: 15,
      page: 1,
      type: "all",
    });
    const found = (r.data ?? []).map(toItem);
    // El cargo ya elegido o enlazado debe seguir en la lista aunque la búsqueda lo excluya.
    const keep = cargoItems.value.filter(
      (i) => i.id === idCargo.value && !found.some((f) => f.id === i.id),
    );
    cargoItems.value = [...keep, ...found];
  } catch {
    // El cliente HTTP ya informa del error; la lista queda como estaba.
  } finally {
    searching.value = false;
  }
}

function onSearch(q: string | null): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void search(q ?? ""), 250);
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    idCargo.value = props.linkedCargo ?? null;
    cargoItems.value = idCargo.value
      ? [{ id: idCargo.value, label: `#${idCargo.value}` }]
      : [];
    void search("");
  },
);
</script>
