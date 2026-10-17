<template>
  <v-dialog v-model="model" max-width="820" persistent scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <CmAirlineTail v-if="vettore" :code="vettore" :size="28" />
        <v-icon v-else :icon="mdiAirplaneCog" />
        <span>
          {{
            isEdit
              ? t('anagrafiche.scaglioni_vettore.dialog_title_edit', { carrier: currentLabel })
              : t('anagrafiche.scaglioni_vettore.dialog_title')
          }}
        </span>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <!-- PASO 1 — proveedor. Autocomplete sobre el catálogo real de
             aerolíneas (cargo_vettori): con ~100 opciones un select plano
             obliga a desplazarse; escribiendo "klm" o "KL" se llega en dos
             teclas. El código nunca se teclea libre — variantes como
             'KLM'/'KL'/'Air France' no casarían en el lookup y el margen
             dejaría de aplicarse en silencio. -->
        <section class="cm-vd-step">
          <div class="cm-vd-step__label">
            <span class="cm-vd-step__num">1</span>
            {{ t('anagrafiche.scaglioni_vettore.step_carrier') }}
          </div>

          <v-autocomplete
            v-model="vettore"
            :items="selectableVettori"
            item-title="label"
            item-value="code"
            :label="t('anagrafiche.scaglioni_vettore.carrier')"
            :disabled="isEdit"
            :error-messages="carrierError ? [carrierError] : []"
            :custom-filter="filterVettore"
            density="comfortable"
            variant="outlined"
            hide-details="auto"
            auto-select-first
            clearable
          >
            <!-- Cola + código en la opción: el mismo par que se ve luego en la
                 tabla y en el título, para que el operador reconozca la fila. -->
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :disabled="item.raw.configured && !isEdit"
                :subtitle="
                  item.raw.configured && !isEdit
                    ? t('anagrafiche.scaglioni_vettore.already_configured')
                    : item.raw.code
                "
              >
                <template #prepend>
                  <CmAirlineTail
                    v-if="item.raw.kind === 'airline'"
                    :code="item.raw.code"
                    :size="24"
                    class="mr-3"
                  />
                  <v-icon v-else :icon="mdiWeb" size="24" class="mr-3" />
                </template>
              </v-list-item>
            </template>

            <template #selection="{ item }">
              <span class="d-flex align-center ga-2">
                <span>{{ item.raw.label }}</span>
                <span class="cm-vd-code">{{ item.raw.code }}</span>
              </span>
            </template>
          </v-autocomplete>
        </section>

        <template v-if="vettore">
          <v-divider />

          <!-- PASO 2 — tramos. Antes eran 10 filas sueltas ocupando todo el
               alto del modal; ahora van en dos columnas de 5, así entran sin
               scroll y la relación kg→% se lee de un vistazo. -->
          <section class="cm-vd-step">
            <div class="cm-vd-step__label">
              <span class="cm-vd-step__num">2</span>
              {{ t('anagrafiche.scaglioni_vettore.step_tiers') }}
            </div>

            <!-- Origen de los tramos. Clonar es lo habitual cuando dos
                 aerolíneas del mismo grupo (AF/KL) comparten condiciones:
                 evita teclear 20 valores por segunda vez. Es una COPIA, no un
                 vínculo — editar el origen después no toca a esta. -->
            <div v-if="!isEdit" class="cm-vd-source">
              <v-select
                v-model="seedFrom"
                :items="seedOptions"
                item-title="label"
                item-value="value"
                :label="t('anagrafiche.scaglioni_vettore.copy_from')"
                density="compact"
                variant="outlined"
                hide-details
              >
                <template #item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps">
                    <template v-if="item.raw.code" #prepend>
                      <CmAirlineTail :code="item.raw.code" :size="22" class="mr-3" />
                    </template>
                  </v-list-item>
                </template>
              </v-select>
            </div>

            <v-alert
              v-if="seedSource"
              :type="seedSource === 'empty' ? 'warning' : 'info'"
              variant="tonal"
              density="compact"
              class="mb-4 text-caption"
            >
              {{ seedMessage }}
            </v-alert>

            <div class="cm-vd-tiers">
              <div v-for="col in [0, 1]" :key="col" class="cm-vd-tiers__col">
                <div class="cm-vd-tier-head">
                  <span></span>
                  <span>{{ t('anagrafiche.scaglioni.kg') }}</span>
                  <span></span>
                  <span>{{ t('anagrafiche.scaglioni.profit_pct') }}</span>
                </div>
                <div
                  v-for="b in brackets.slice(col * 5, col * 5 + 5)"
                  :key="b.n"
                  class="cm-vd-tier-row"
                  :class="{ 'cm-vd-tier-row--active': isDefined(b) }"
                >
                  <span class="cm-vd-tier-row__n">{{ b.n }}</span>
                  <v-text-field
                    v-model.number="b.kg"
                    type="number"
                    step="0.01"
                    min="0"
                    density="compact"
                    variant="outlined"
                    hide-details
                    suffix="kg"
                  />
                  <v-select
                    :model-value="b.mt === 'F' ? 'F' : 'P'"
                    :items="[
                      { title: '%', value: 'P' },
                      { title: '€', value: 'F' },
                    ]"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="cm-vd-tier-mode"
                    @update:model-value="(v) => (b.mt = v as 'P' | 'F')"
                  />
                  <v-text-field
                    v-if="b.mt === 'F'"
                    v-model.number="b.fx"
                    type="number"
                    step="0.01"
                    min="0"
                    density="compact"
                    variant="outlined"
                    hide-details
                    :suffix="marginCurrency"
                  />
                  <v-text-field
                    v-else
                    v-model.number="b.pr"
                    type="number"
                    step="0.01"
                    min="0"
                    density="compact"
                    variant="outlined"
                    hide-details
                    suffix="%"
                  />
                </div>
              </div>
            </div>

            <!-- El % es un recargo ADITIVO sobre el coste (pr=160 → coste ×
                 2,60), no un multiplicador. Se muestra el cálculo con números
                 vivos porque confundir ambas lecturas cambia el precio
                 facturado por un factor ~1,6. -->
            <div class="cm-vd-formula">
              <div class="text-caption">
                {{ t('anagrafiche.scaglioni_vettore.formula_hint') }}
              </div>
              <div v-if="firstDefined" class="text-caption mt-1 font-weight-medium">
                {{ exampleText }}
              </div>
            </div>

            <v-alert
              v-if="validationError || bracketsSaveError"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-3 text-caption"
            >
              {{ validationError || bracketsSaveError }}
            </v-alert>
          </section>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-4 py-3">
        <span v-if="vettore && !validationError" class="text-caption text-medium-emphasis">
          {{ t('anagrafiche.scaglioni_vettore.tiers_count', { n: definedCount }) }}
        </span>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="!vettore || !!validationError"
          @click="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAirplaneCog, mdiWeb } from '@mdi/js';
import {
  scaglioniVettoreService,
  type AvailableVettore,
  type VettoreBracket,
  type VettoreConfiguration,
} from '../services/scaglioniVettore.service';
import type { ScaglioniTipo } from '../services/scaglioni.service';
import CmAirlineTail from '../components/CmAirlineTail.vue';

const props = defineProps<{
  modelValue: boolean;
  idAnagrafica: number;
  tipo?: ScaglioniTipo;
  availableVettori: AvailableVettore[];
  /** Código a editar; vacío = alta nueva. */
  editVettore?: string;
  /** Tramos actuales cuando se edita una configuración existente. */
  editBrackets?: VettoreBracket[];
  /** Moneda del importe fijo cuando se edita una configuración existente. */
  editMarginCurrency?: string;
  /** Pactos ya guardados, para poder clonar uno al crear otro. */
  existingConfigs?: VettoreConfiguration[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const tipo = computed<ScaglioniTipo>(() => props.tipo ?? 'A');
const isEdit = computed(() => !!props.editVettore);

const vettore = ref<string>('');
const brackets = ref<VettoreBracket[]>([]);
const seedSource = ref<'client' | 'empty' | 'clone' | ''>('');
const saving = ref(false);
const saveError = ref('');

/**
 * Origen de los tramos precargados: '' = escalones generales del cliente,
 * o el código de un pacto existente para clonarlo.
 */
const seedFrom = ref<string>('');

/** Nombre del pacto clonado, para el aviso. */
const clonedLabel = ref('');

/**
 * Opciones de origen: los generales del cliente + cada pacto ya configurado
 * (excluyendo el que se está creando, que aún no existe).
 */
const seedOptions = computed(() => {
  const opts: Array<{ value: string; label: string; code?: string }> = [
    { value: '', label: t('anagrafiche.scaglioni_vettore.copy_from_client') as string },
  ];
  for (const cfg of props.existingConfigs ?? []) {
    if (cfg.vettore === vettore.value) continue;
    opts.push({
      value: cfg.vettore,
      label: t('anagrafiche.scaglioni_vettore.copy_from_carrier', {
        carrier: cfg.vettore_label,
      }) as string,
      code: cfg.vettore,
    });
  }
  return opts;
});

const seedMessage = computed(() => {
  if (seedSource.value === 'clone') {
    return t('anagrafiche.scaglioni_vettore.seeded_from_clone', {
      carrier: clonedLabel.value,
    });
  }
  if (seedSource.value === 'client') {
    return t('anagrafiche.scaglioni_vettore.seeded_from_client');
  }
  return t('anagrafiche.scaglioni_vettore.seeded_empty');
});

/**
 * El backend atribuye el fallo a `vettore` o a `brackets`. Se pinta en el
 * control que lo causó: un error de tramos bajo el desplegable de aerolínea
 * manda a corregir el sitio equivocado.
 */
const carrierError = computed(() =>
  saveError.value && /vettore|carrier/i.test(saveError.value) ? saveError.value : '',
);
const bracketsSaveError = computed(() =>
  saveError.value && !carrierError.value ? saveError.value : '',
);

/** En alta se ocultan los ya configurados; en edición se muestra el actual. */
const selectableVettori = computed(() =>
  isEdit.value
    ? props.availableVettori
    : props.availableVettori.filter((v) => !v.configured),
);

const currentLabel = computed(
  () => props.availableVettori.find((v) => v.code === vettore.value)?.label ?? vettore.value,
);

/**
 * Buscar por nombre O por código IATA: el operador que sabe "KL" no debería
 * tener que recordar que la fila se llama "KLM".
 */
function filterVettore(value: string, query: string, item?: { raw?: AvailableVettore }): boolean {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  const raw = item?.raw;
  const label = (raw?.label ?? value ?? '').toLowerCase();
  const code = (raw?.code ?? '').toLowerCase();
  return label.includes(q) || code.includes(q);
}

function emptyBrackets(): VettoreBracket[] {
  return Array.from({ length: 10 }, (_, i) => ({ n: i + 1, kg: 0, pr: 0, mt: 'P' as const, fx: 0 }));
}

/** Un tramo cuenta como "definido" si es % con pr>0, o fijo con fx>0 — igual que Scaglioni_Vettore_Service::validate_brackets() en el backend. */
function isDefined(b: VettoreBracket): boolean {
  return b.mt === 'F' ? (b.fx ?? 0) > 0 : b.pr > 0;
}

const marginCurrency = ref('EUR');

const firstDefined = computed(() => brackets.value.find(isDefined) ?? null);
const definedCount = computed(() => brackets.value.filter(isDefined).length);

const exampleText = computed(() => {
  const b = firstDefined.value;
  if (!b) return '';
  const cost = 1000;
  if (b.mt === 'F') {
    const client = (cost + (b.fx ?? 0)).toFixed(2);
    return t('anagrafiche.scaglioni_vettore.example_text_fixed', {
      kg: b.kg,
      amount: (b.fx ?? 0).toFixed(2),
      currency: marginCurrency.value,
      cost: cost.toFixed(2),
      client,
    });
  }
  const client = (cost * (1 + b.pr / 100)).toFixed(2);
  return t('anagrafiche.scaglioni_vettore.example_text', {
    kg: b.kg,
    pct: b.pr,
    cost: cost.toFixed(2),
    client,
  });
});

/**
 * Mismas reglas que valida el backend (Scaglioni_Vettore_Service), replicadas
 * aquí solo para dar respuesta inmediata. El backend sigue siendo la autoridad.
 */
const validationError = computed<string>(() => {
  if (!vettore.value) return '';

  const defined = brackets.value.filter(isDefined);
  if (defined.length === 0) {
    return t('anagrafiche.scaglioni_vettore.err_no_tiers');
  }
  if (brackets.value.some((b) => b.kg < 0 || b.pr < 0 || (b.fx ?? 0) < 0)) {
    return t('anagrafiche.scaglioni_vettore.err_negative');
  }
  // Los kg deben crecer de un tramo al siguiente: con un orden inconsistente
  // el selector FLOOR elegiría un escalón que el operador no espera. Mismo
  // criterio que Scaglioni_Vettore_Service::validate_brackets() en el
  // backend — se compara por posición 'n', no por índice del array filtrado.
  const sorted = [...defined].sort((a, b) => a.n - b.n);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].kg <= sorted[i - 1].kg) {
      return t('anagrafiche.scaglioni_vettore.err_not_increasing');
    }
  }
  return '';
});

/**
 * Carga los tramos según el origen elegido: un pacto existente (clonar) o los
 * escalones generales del cliente. En ambos casos es una COPIA — lo que se
 * guarde queda como valores propios de la nueva aerolínea.
 */
async function loadSeed(): Promise<void> {
  // Clonar un pacto ya guardado: los datos ya están en memoria, sin ir al
  // servidor.
  if (seedFrom.value) {
    const src = (props.existingConfigs ?? []).find((c) => c.vettore === seedFrom.value);
    if (src) {
      brackets.value = Array.from({ length: 10 }, (_, i) => {
        const ii = i + 1 < 10 ? '0' + (i + 1) : String(i + 1);
        const mt = String(src['mt' + ii] ?? 'P').toUpperCase() === 'F' ? 'F' : 'P';
        return {
          n: i + 1,
          kg: Number(src['kg' + ii] ?? 0),
          pr: Number(src['pr' + ii] ?? 0),
          mt: mt as 'P' | 'F',
          fx: Number(src['fx' + ii] ?? 0),
        };
      });
      if (src.margin_currency) marginCurrency.value = String(src.margin_currency);
      clonedLabel.value = src.vettore_label;
      seedSource.value = 'clone';
      return;
    }
  }

  // Origen por defecto: los escalones generales del cliente. get_seed_brackets()
  // (backend) solo copia kg/pr — mt/fx no están en su alcance (Fase 3), así
  // que cada tramo llega como porcentual por defecto, editable después.
  try {
    const seed = await scaglioniVettoreService.seed(props.idAnagrafica, tipo.value);
    brackets.value = seed.brackets.length
      ? seed.brackets.map((b) => ({ mt: 'P' as const, fx: 0, ...b }))
      : emptyBrackets();
    seedSource.value = seed.source;
  } catch {
    brackets.value = emptyBrackets();
    seedSource.value = 'empty';
  }
}

/** Al elegir proveedor se precargan los tramos del origen seleccionado. */
watch(vettore, async (code) => {
  saveError.value = '';
  if (!code || isEdit.value) return;
  // Si el origen elegido es el propio proveedor recién seleccionado, deja de
  // ser válido como fuente de clonado.
  if (seedFrom.value === code) seedFrom.value = '';
  await loadSeed();
});

/** Cambiar el origen recarga los tramos sin perder la aerolínea elegida. */
watch(seedFrom, async () => {
  if (!vettore.value || isEdit.value) return;
  await loadSeed();
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    saveError.value = '';
    seedFrom.value = '';
    clonedLabel.value = '';
    if (isEdit.value) {
      vettore.value = props.editVettore ?? '';
      brackets.value = props.editBrackets?.length
        ? props.editBrackets.map((b) => ({ ...b }))
        : emptyBrackets();
      marginCurrency.value = props.editMarginCurrency || 'EUR';
      seedSource.value = '';
    } else {
      vettore.value = '';
      brackets.value = emptyBrackets();
      marginCurrency.value = 'EUR';
      seedSource.value = '';
    }
  },
);

function close(): void {
  model.value = false;
}

async function save(): Promise<void> {
  if (!vettore.value || validationError.value) return;
  saving.value = true;
  try {
    await scaglioniVettoreService.save(
      props.idAnagrafica,
      vettore.value,
      brackets.value,
      { margin_currency: marginCurrency.value },
      tipo.value,
    );
    emit('saved');
    close();
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cm-vd-step {
  padding: 16px 20px;
}
.cm-vd-step__label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-vd-step__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  font-weight: 700;
}
.cm-vd-source {
  margin-bottom: 14px;
  max-width: 380px;
}
.cm-vd-code {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(var(--v-border-color), 0.12);
  color: var(--cm-text-muted);
}

/* Dos columnas de 5 tramos: entran sin scroll y la progresión kg→% se lee
   de un vistazo. En móvil colapsa a una sola. */
.cm-vd-tiers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
}
.cm-vd-tier-head,
.cm-vd-tier-row {
  display: grid;
  grid-template-columns: 20px 1fr 64px 1fr;
  gap: 8px;
  align-items: center;
}
.cm-vd-tier-mode {
  min-width: 64px;
}
.cm-vd-tier-head {
  margin-bottom: 6px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-vd-tier-row {
  margin-bottom: 6px;
}
.cm-vd-tier-row__n {
  font-size: 11px;
  color: var(--cm-text-muted);
  text-align: right;
}
/* Un tramo con % definido se distingue de los vacíos sin leer los números. */
.cm-vd-tier-row--active .cm-vd-tier-row__n {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

.cm-vd-formula {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: var(--cm-radius-lg, 8px);
  background: rgba(var(--v-theme-primary), 0.06);
  color: var(--cm-text-muted);
}

@media (max-width: 700px) {
  .cm-vd-tiers {
    grid-template-columns: 1fr;
  }
}
</style>
