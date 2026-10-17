<template>
  <!--
    "¿De dónde sale este porcentaje?"

    El KPI de la ficha muestra un número sin contexto, y el mismo envío puede
    enseñar dos porcentajes distintos —200% en el buscador de vuelos, 66.7%
    aquí— sin que ninguna pantalla explique que son DOS MAGNITUDES DISTINTAS
    sobre las mismas dos cifras. Este diálogo enseña la cadena entera: coste,
    venta, las dos fórmulas y de qué escalón salió el margen.
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-help-circle-outline" size="20" />
        {{ t("cargo.margin_explain.title") }}
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-divider />

      <v-card-text>
        <!-- Las dos cifras de las que sale todo -->
        <div class="me-figures">
          <div class="me-fig">
            <div class="me-fig__lbl">{{ t("cargo.margin_explain.cost") }}</div>
            <div class="me-fig__val">{{ currency }} {{ cost.toFixed(2) }}</div>
            <div class="me-fig__sub">{{ costSourceLabel }}</div>
          </div>
          <v-icon icon="mdi-arrow-right-thin" class="me-fig__arrow" />
          <div class="me-fig">
            <div class="me-fig__lbl">{{ t("cargo.margin_explain.sale") }}</div>
            <div class="me-fig__val">{{ currency }} {{ sale.toFixed(2) }}</div>
            <div class="me-fig__sub">
              {{ t("cargo.margin_explain.sale_sub") }}
            </div>
          </div>
        </div>

        <!--
          Las dos lecturas del mismo par de cifras. Se muestran JUNTAS a
          propósito: verlas por separado en pantallas distintas es lo que hace
          creer que una de las dos está mal.
        -->
        <div class="me-formulas">
          <div class="me-formula">
            <div class="me-formula__head">
              <span class="me-formula__pct">{{ markupPct }}</span>
              <span class="me-formula__name">{{
                t("cargo.margin_explain.markup")
              }}</span>
            </div>
            <code class="me-formula__eq">
              ({{ sale.toFixed(2) }} − {{ cost.toFixed(2) }}) ÷
              {{ cost.toFixed(2) }}
            </code>
            <div class="me-formula__note">
              {{ t("cargo.margin_explain.markup_note") }}
            </div>
          </div>

          <div class="me-formula">
            <div class="me-formula__head">
              <span class="me-formula__pct">{{ marginPct }}</span>
              <span class="me-formula__name">{{
                t("cargo.margin_explain.margin")
              }}</span>
            </div>
            <code class="me-formula__eq">
              ({{ sale.toFixed(2) }} − {{ cost.toFixed(2) }}) ÷
              {{ sale.toFixed(2) }}
            </code>
            <div class="me-formula__note">
              {{ t("cargo.margin_explain.margin_note") }}
            </div>
          </div>
        </div>

        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
          :text="t('cargo.margin_explain.two_numbers_hint')"
        />

        <!-- De qué escalón salió: lo que el operador configuró en el admin -->
        <div class="me-section">
          <div class="me-section__title">
            <v-icon icon="mdi-stairs" size="16" />
            {{ t("cargo.margin_explain.bracket_title") }}
          </div>

          <div v-if="loading" class="d-flex align-center ga-2 py-3">
            <v-progress-circular indeterminate size="18" width="2" />
            <span class="text-caption">{{
              t("cargo.margin_explain.loading")
            }}</span>
          </div>

          <template v-else-if="brackets.length">
            <div class="me-weight">
              {{ t("cargo.margin_explain.applied_weight") }}
              <strong>{{
                t("cargo.flight.kg_value", { v: chargeableWeight.toFixed(2) })
              }}</strong>
              <span v-if="weightIsSuspect" class="me-warn">
                <v-icon icon="mdi-alert" size="13" />
                {{ t("cargo.margin_explain.weight_zero_warn") }}
              </span>
            </div>

            <table class="me-table">
              <thead>
                <tr>
                  <th>{{ t("cargo.margin_explain.from_kg") }}</th>
                  <th class="text-right">
                    {{ t("cargo.margin_explain.bracket_pct") }}
                  </th>
                  <th class="text-right">
                    {{ t("cargo.margin_explain.would_sell") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in brackets"
                  :key="i"
                  :class="{ 'me-row--active': b === expectedBracket }"
                >
                  <td>
                    <!-- La franja marca el escalón que aplica a este peso: sin
                         ella hay que releer los kg de cada fila para deducirlo. -->
                    <span
                      v-if="b === expectedBracket"
                      class="me-row__flag"
                      :aria-label="t('cargo.margin_explain.bracket_applied')"
                    />
                    {{ t("cargo.flight.kg_value", { v: b.min_weight }) }}
                  </td>
                  <td class="text-right">{{ b.margin_percent }}%</td>
                  <td class="text-right text-medium-emphasis">
                    {{ currency }}
                    {{ (cost * (1 + b.margin_percent / 100)).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!--
              El contraste que hace visible un margen mal aplicado: si el
              escalón que corresponde al peso no es el que se cobró, aquí se ve.
            -->
            <v-alert
              v-if="mismatch"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              {{
                t("cargo.margin_explain.mismatch", {
                  applied: markupRaw.toFixed(0),
                  expected: expectedBracket?.margin_percent ?? "—",
                  weight: chargeableWeight.toFixed(2),
                })
              }}
            </v-alert>
          </template>

          <div v-else class="text-caption text-medium-emphasis py-2">
            {{ t("cargo.margin_explain.no_brackets") }}
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t("common.close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  fetchMarginExplain,
  type MarginBracket,
} from "@cargo/services/cargo_pricing.service";

const { t } = useI18n();
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { cargo } = storeToRefs(useCargoStore());
const n = (v: unknown): number => Number(v ?? 0) || 0;

/* EUR fijo: `costo_volo_*` y `carico_volo` se guardan siempre en la moneda
   canónica del modelo cargo, no en la del carico. */
const currency = "EUR";

/* Coste y venta DEL VUELO, no los totales de la ficha.
   El KPI de la tarjeta suma export+import+extra en el numerador pero sólo resta
   el coste del vuelo, así que su porcentaje no es comparable con ningún margen
   configurado. Aquí se comparan las dos cifras homogéneas. */
const cost = computed<number>(
  () => n(cargo.value?.costo_volo_reale) || n(cargo.value?.costo_volo_previsto),
);
const sale = computed<number>(() => n(cargo.value?.carico_volo));

const costSourceLabel = computed<string>(() =>
  n(cargo.value?.costo_volo_reale) > 0
    ? t("cargo.margin_explain.cost_real")
    : t("cargo.margin_explain.cost_estimated"),
);

/** Markup sobre coste: la magnitud que se configura en el admin. */
const markupRaw = computed<number>(() =>
  cost.value > 0 ? ((sale.value - cost.value) / cost.value) * 100 : 0,
);
const markupPct = computed<string>(() =>
  cost.value > 0 ? `${markupRaw.value.toFixed(1)}%` : "—",
);
/** Margen sobre venta: la magnitud contable, siempre < 100%. */
const marginPct = computed<string>(() =>
  sale.value > 0
    ? `${(((sale.value - cost.value) / sale.value) * 100).toFixed(1)}%`
    : "—",
);

const chargeableWeight = computed<number>(
  () => n(cargo.value?.pesor) || n(cargo.value?.peso),
);

const loading = ref(false);
const brackets = ref<MarginBracket[]>([]);

/** El escalón que TOCARÍA por peso, con la misma regla que el backend:
    el último cuyo `min_weight` es <= al peso tasado. */
const expectedBracket = computed<MarginBracket | null>(() => {
  let hit: MarginBracket | null = null;
  for (const b of brackets.value) {
    if (chargeableWeight.value >= b.min_weight) hit = b;
  }
  return hit;
});

/* Se compara con tolerancia de medio punto: los importes vienen redondeados a
   dos decimales, así que el markup reconstruido nunca cae exacto. */
const mismatch = computed<boolean>(() => {
  const exp = expectedBracket.value;
  if (!exp || cost.value <= 0 || sale.value <= 0) return false;
  return Math.abs(markupRaw.value - exp.margin_percent) > 0.5;
});

/** Peso cero: el caso que hace caer al primer escalón (el % más alto). */
const weightIsSuspect = computed<boolean>(() => chargeableWeight.value <= 0);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || brackets.value.length) return;
    const id = Number(cargo.value?.id ?? 0);
    if (!id) return;
    loading.value = true;
    try {
      const res = await fetchMarginExplain(id);
      brackets.value = res.brackets ?? [];
    } catch {
      brackets.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.me-figures {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.me-fig {
  flex: 1 1 0;
  text-align: center;
  &__lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }
  &__val {
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  &__sub {
    font-size: 11px;
    opacity: 0.6;
  }
  &__arrow {
    flex: 0 0 auto;
    opacity: 0.5;
  }
}
.me-formulas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.me-formula {
  border: 1px solid rgba(var(--v-border-color), 0.22);
  border-radius: 6px;
  padding: 10px;
  &__head {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  &__pct {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  &__name {
    font-size: 12px;
    opacity: 0.75;
  }
  &__eq {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.8;
  }
  &__note {
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.65;
    line-height: 1.35;
  }
}
.me-section {
  margin-top: 16px;
  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.75;
    margin-bottom: 6px;
  }
}
.me-weight {
  font-size: 12px;
  margin-bottom: 6px;
}
.me-warn {
  margin-left: 8px;
  color: rgb(var(--v-theme-warning));
}
.me-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th {
    text-align: left;
    font-weight: 600;
    opacity: 0.7;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.22);
  }
  td {
    padding: 3px 6px;
    font-variant-numeric: tabular-nums;
  }
}
/* Franja lateral + fondo en el escalón aplicado. El fondo solo no basta: con
   10 filas y tonos tenues cuesta localizarlo, y la barra de la izquierda da un
   ancla vertical que se ve de un vistazo. `box-shadow` en vez de `border-left`
   para no descuadrar el ancho de la primera columna. */
.me-row--active {
  background: rgba(var(--v-theme-primary), 0.1);
  font-weight: 700;

  td:first-child {
    box-shadow: inset 3px 0 0 0 rgb(var(--v-theme-primary));
  }
}
.me-row__flag {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: middle;
  background: rgb(var(--v-theme-primary));
}
</style>
