<template>
  <div>
    <CmSectionHeader
      :title="t('sections.email_templates')"
      :subtitle="t('email_templates.subtitle')"
    />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div
        style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center"
      >
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('email_templates.search')"
          density="compact"
          hide-details
          clearable
          style="max-width: 280px"
        />
        <v-select
          v-model="tipoFilter"
          :items="tipoItems"
          :label="t('email_templates.filter_tipo')"
          density="compact"
          hide-details
          clearable
          style="max-width: 200px"
        />
        <v-select
          v-model="linguaFilter"
          :items="linguaItems"
          :label="t('email_templates.filter_lingua')"
          density="compact"
          hide-details
          clearable
          style="max-width: 160px"
        />
        <!--
          Solo TMWE: un partner ve únicamente las suyas, así que el filtro no
          le aportaría nada (y el backend lo ignoraría igualmente).
        -->
        <v-select
          v-if="isTmwe"
          v-model="ownerFilter"
          :items="ownerItems"
          :label="t('email_templates.filter_owner')"
          density="compact"
          hide-details
          clearable
          style="max-width: 220px"
        />
        <v-spacer />
        <v-btn
          class="cm-btn-accent"
          variant="flat"
          :prepend-icon="mdiPlus"
          @click="openCreate"
        >
          {{ t("email_templates.new") }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="6"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState
          :icon="mdiEmailEditOutline"
          :title="t('email_templates.empty')"
        />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cm-table-zebra">
            <thead>
              <tr>
                <th style="width: 110px">{{ t("email_templates.tipo") }}</th>
                <th style="width: 90px">{{ t("email_templates.lingua") }}</th>
                <th style="width: 150px">{{ t("email_templates.owner") }}</th>
                <th>{{ t("email_templates.descriz") }}</th>
                <th>{{ t("email_templates.oggetto") }}</th>
                <th style="width: 110px">{{ t("email_templates.engine") }}</th>
                <th style="width: 120px">
                  {{ t("email_templates.channels") }}
                </th>
                <th style="width: 90px" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td>
                  <code>{{ row.tipo }}</code>
                </td>
                <td>{{ row.lingua }}</td>
                <td>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="row.id_anagrafica === 1 ? 'primary' : undefined"
                  >
                    {{
                      row.id_anagrafica === 1
                        ? t("email_templates.owner_base")
                        : ownerNames[row.id_anagrafica] ||
                          `#${row.id_anagrafica}`
                    }}
                  </v-chip>
                </td>
                <td>{{ row.descriz || "—" }}</td>
                <td class="text-truncate" style="max-width: 320px">
                  {{ row.oggetto || "—" }}
                </td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="row.engine === 'modern' ? 'primary' : undefined"
                    variant="tonal"
                  >
                    {{
                      row.engine === "modern"
                        ? t("email_templates.engine_modern")
                        : t("email_templates.engine_legacy")
                    }}
                  </v-chip>
                </td>
                <td>
                  <span class="et-channels">
                    <span
                      v-if="row.mail === 'S'"
                      :title="t('email_templates.ch_mail')"
                      >✉</span
                    >
                    <span
                      v-if="row.fax === 'S'"
                      :title="t('email_templates.ch_fax')"
                      >🖷</span
                    >
                    <span
                      v-if="row.sms === 'S'"
                      :title="t('email_templates.ch_sms')"
                      >✆</span
                    >
                    <span
                      v-if="row.carta === 'S'"
                      :title="t('email_templates.ch_post')"
                      >✉︎</span
                    >
                  </span>
                </td>
                <td>
                  <CmRowActions :actions="actionsFor(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <div class="text-caption mt-2">
          {{ t("email_templates.total", { n: filtered.length }) }}
        </div>
      </template>
    </CmAsyncSection>

    <EmailTemplateEditor
      v-model="editorOpen"
      :template-id="editingId"
      :clone-from="cloneFrom"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  mdiPlus,
  mdiPencil,
  mdiMagnify,
  mdiDelete,
  mdiEmailEditOutline,
  mdiContentCopy,
  mdiEyeOutline,
} from "@mdi/js";
import CmSectionHeader from "@shared/anagrafiche/components/CmSectionHeader.vue";
import CmRowActions, {
  type RowAction,
} from "@shared/anagrafiche/components/CmRowActions.vue";
import CmAsyncSection from "@shared/anagrafiche/components/CmAsyncSection.vue";
import CmEmptyState from "@shared/anagrafiche/components/CmEmptyState.vue";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConfirm } from "@shared/anagrafiche/composables/useConfirm";
import EmailTemplateEditor from "../components/EmailTemplateEditor.vue";
import { useIsTmwe } from "../useIsTmwe";
import { anagraficaService } from "@shared/anagrafiche/services/anagrafica.service";
import {
  emailTemplatesService,
  type EmailTemplate,
} from "../services/emailTemplates.service";

/** Anagrafica dueña de las plantillas base (espejo del backend). */
const BASE_ANAGRAFICA_ID = 1;

/** Fila con el motor ya derivado, para no calcularlo en el template. */
type Row = EmailTemplate & { engine: "legacy" | "modern" };

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<Row[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref("");
const tipoFilter = ref<string | null>(null);
const linguaFilter = ref<string | null>(null);
const ownerFilter = ref<number | null>(null);

/**
 * TMWE gestiona las plantillas BASE (id_anagrafica = 1) y las de cualquier
 * partner; un partner solo las suyas. El backend ya lo impone — esto solo
 * decide qué controles tiene sentido mostrar.
 */
const isTmwe = computed(() => useIsTmwe());

/** id_anagrafica → razón social, para no mostrar números sueltos. */
const ownerNames = ref<Record<number, string>>({});

const editorOpen = ref(false);
const editingId = ref<number | null>(null);
/** Plantilla de partida al duplicar. null = crear en blanco. */
const cloneFrom = ref<number | null>(null);

/**
 * Misma regla que el backend (Modelli_Render_Service::RE_MODERN). Se duplica
 * a propósito para poder etiquetar el listado sin una llamada por fila; el
 * backend sigue siendo la autoridad al renderizar.
 */
const RE_MODERN = /\{\{[-~\s]*[A-Za-z_0-9[('"]|\{%[-~\s]*[A-Za-z]/;

function detectEngine(row: EmailTemplate): "legacy" | "modern" {
  const src = `${row.oggetto ?? ""}\n${(row as { html?: string }).html ?? ""}`;
  return RE_MODERN.test(src) ? "modern" : "legacy";
}

const tipoItems = computed(() =>
  Array.from(new Set(rows.value.map((r) => r.tipo))).sort(),
);

const linguaItems = computed(() =>
  Array.from(new Set(rows.value.map((r) => r.lingua))).sort(),
);

/** Dueños presentes en el listado: las base primero, luego cada partner. */
const ownerItems = computed(() => {
  const ids = Array.from(new Set(rows.value.map((r) => r.id_anagrafica))).sort(
    (a, b) => a - b,
  );
  return ids.map((id) => ({
    value: id,
    title:
      id === 1
        ? t("email_templates.owner_base")
        : ownerNames.value[id] || `#${id}`,
  }));
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (tipoFilter.value && r.tipo !== tipoFilter.value) return false;
    if (linguaFilter.value && r.lingua !== linguaFilter.value) return false;
    if (ownerFilter.value !== null && r.id_anagrafica !== ownerFilter.value)
      return false;
    if (!q) return true;
    return (
      r.tipo.toLowerCase().includes(q) ||
      (r.descriz ?? "").toLowerCase().includes(q) ||
      (r.oggetto ?? "").toLowerCase().includes(q)
    );
  });
});

/**
 * ¿El usuario puede modificar esta fila?
 *
 * TMWE puede con todas. Un partner solo con las suyas: las BASE las ve (y las
 * duplica) pero no las edita, porque las comparten todos los partners que no
 * tienen la suya. Mismo criterio que can_update()/can_delete() en el backend
 * — aquí solo se refleja para no ofrecer acciones que darían 403.
 */
function canModify(row: Row): boolean {
  return isTmwe.value || row.id_anagrafica !== BASE_ANAGRAFICA_ID;
}

function actionsFor(row: Row): RowAction[] {
  const editable = canModify(row);
  return [
    {
      key: "edit",
      title: editable ? t("common.edit") : t("email_templates.view"),
      icon: editable ? mdiPencil : mdiEyeOutline,
      onClick: () => openEdit(row.id),
    },
    {
      key: "clone",
      // Es la vía natural para crear una especialización: se parte de la
      // plantilla base (o de la de otro partner) en vez de copiar el HTML a
      // mano. El editor se abre relleno y sin id, así que guardar CREA.
      title: t("email_templates.clone"),
      icon: mdiContentCopy,
      onClick: () => openClone(row),
    },
    {
      key: "delete",
      title: t("common.delete"),
      icon: mdiDelete,
      color: "error",
      hidden: !editable,
      onClick: () => askDelete(row),
    },
  ];
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const list = await emailTemplatesService.list();
    // El backend devuelve los enteros como STRING ("1", "6730"). Sin
    // normalizar, las comparaciones estrictas (=== 1) nunca casan y la
    // columna de propietario mostraría siempre el partner en vez de «Base».
    rows.value = list
      .map((r) => ({
        ...r,
        id: Number(r.id),
        id_anagrafica: Number(r.id_anagrafica),
        engine: detectEngine(r),
      }))
      // Defensa: el listado no debería traer borradas, pero si llegan no se
      // muestran (una plantilla con stato='O' está eliminada).
      .filter((r) => r.stato !== "O");
    if (isTmwe.value) void loadOwnerNames();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

/**
 * Resuelve la razón social de cada partner con plantillas propias.
 *
 * Es cosmético: si falla, la tabla muestra `#<id>` y todo lo demás sigue
 * funcionando. Por eso no toca `error` ni bloquea la carga.
 */
async function loadOwnerNames(): Promise<void> {
  const ids = Array.from(
    new Set(rows.value.map((r) => r.id_anagrafica)),
  ).filter((id) => id > 1 && !ownerNames.value[id]);

  await Promise.all(
    ids.map(async (id) => {
      try {
        const a = await anagraficaService.getById(id);
        if (a?.rag_soc) ownerNames.value[id] = a.rag_soc;
      } catch {
        /* se queda el #id */
      }
    }),
  );
}

function openCreate(): void {
  editingId.value = null;
  cloneFrom.value = null;
  editorOpen.value = true;
}

/**
 * Duplicar: abre el editor con el contenido de `row` pero SIN id, de modo que
 * al guardar se cree una plantilla nueva. Es el camino para especializar una
 * base para un partner sin copiar el HTML a mano.
 */
function openClone(row: Row): void {
  editingId.value = null;
  cloneFrom.value = row.id;
  editorOpen.value = true;
}

function openEdit(id: number): void {
  editingId.value = id;
  cloneFrom.value = null;
  editorOpen.value = true;
}

async function askDelete(row: Row): Promise<void> {
  const ok = await confirm.askDanger(
    t("email_templates.delete_confirm", { tipo: row.tipo, lingua: row.lingua }),
    t("email_templates.delete_title"),
  );
  if (!ok) return;

  try {
    await emailTemplatesService.remove(row.id);
    toast.success(t("email_templates.deleted"));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

function onSaved(): void {
  void load();
}

onMounted(load);
</script>

<style scoped>
.et-channels {
  display: inline-flex;
  gap: 6px;
  font-size: 15px;
  opacity: 0.75;
}
</style>
