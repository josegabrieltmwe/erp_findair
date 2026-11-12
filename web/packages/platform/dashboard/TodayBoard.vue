<template>
  <!--
    «Da fare oggi»: lo que espera una acción del operador, en tarjetas con su número y su
    enlace a la lista ya filtrada (traído de la home de Jose_master).

    - Se pinta al instante: cada tarjeta enseña su último valor bueno (si lo hay) o un esqueleto,
      y se rellena cuando llega su fuente; una fuente lenta no frena a las demás.
    - Las tarjetas a cero se ocultan (y los grupos que se quedan vacíos); un contador que falla
      es «n/d», nunca 0.
    - Con más de un grupo hay un carril vertical para filtrar por grupo.
  -->
  <section class="today" data-testid="home-today" :aria-busy="anyLoading">
    <div class="today__bar">
      <h2 class="today__title">{{ t("home.today.title") }}</h2>
      <v-spacer />
      <span
        v-if="statusText"
        class="today__status"
        data-testid="home-today-status"
        >{{ statusText }}</span
      >
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-refresh"
        data-testid="home-today-refresh"
        @click="reload()"
      >
        {{ t("home.landing.refresh") }}
      </v-btn>
    </div>

    <v-alert
      v-if="cockpitFailed"
      type="warning"
      variant="tonal"
      density="compact"
      class="today__alert"
      data-testid="home-today-error"
    >
      {{ t("home.today.error") }}
      <template #append>
        <v-btn variant="text" size="small" @click="reload()">{{
          t("common.retry")
        }}</v-btn>
      </template>
    </v-alert>

    <div class="today__body">
      <v-tabs
        v-if="groups.length > 1"
        v-model="activeGroup"
        direction="vertical"
        color="primary"
        class="today__rail"
        data-testid="home-today-rail"
      >
        <v-tab :value="ALL">{{ t("home.today.all_groups") }}</v-tab>
        <v-tab
          v-for="g in groups"
          :key="g.id"
          :value="g.id"
          :data-testid="`home-today-group-${g.id}`"
        >
          {{ t(`home.today.group.${g.id}`) }}
        </v-tab>
      </v-tabs>

      <div class="today__content">
        <HomeKpiGroup
          v-for="g in shownGroups"
          :key="g.id"
          :title="t(`home.today.group.${g.id}`)"
          :total="g.total"
          :loading="g.loading"
        >
          <HomeKpiTile
            v-for="row in g.rows"
            :key="row.tile.key"
            :icon="row.tile.icon"
            :label="t(`home.today.tile.${row.tile.key}.label`)"
            :description="describe(row.tile)"
            :value="row.res.value"
            :variant="row.tile.variant"
            :loading="row.res.state === 'loading' && row.res.value === null"
            :unavailable="row.res.state === 'unavailable'"
            :no-value="row.tile.source === 'none'"
            :server-filtered="true"
            :data-testid="`home-today-${row.tile.key}`"
            @click="open(row.tile)"
          />
        </HomeKpiGroup>

        <p v-if="allClear" class="today__clear" data-testid="home-today-empty">
          <v-icon
            icon="mdi-check-circle-outline"
            size="18"
            color="success"
            class="mr-1"
          />
          {{ t("home.landing.attention_empty") }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import HomeKpiTile from "./HomeKpiTile.vue";
import HomeKpiGroup from "./HomeKpiGroup.vue";
import { useCockpitStore } from "./cockpit.store";
import { useTodayStore } from "./today.store";
import { useAccess } from "../composables/useAccess";
import {
  TODAY_GROUPS,
  isZeroTile,
  resolveTile,
  todayCategories,
  visibleTodayTiles,
  type TileResolution,
  type TodayGroupId,
  type TodayTile,
} from "./today_catalog";

const { t, locale } = useI18n();
const router = useRouter();
const BASE_PATH = "/bff/v1";
const ALL = "__all__";

const cockpit = useCockpitStore();
const { counts, pending, errors, updatedAt } = storeToRefs(cockpit);
const today = useTodayStore();
const { special, cached, cachedAt } = storeToRefs(today);
const { access, ensureProfile } = useAccess();

const tiles = computed(() => visibleTodayTiles(access.value));
const categories = computed(() => todayCategories(tiles.value));

interface Row {
  tile: TodayTile;
  res: TileResolution;
}
interface GroupView {
  id: TodayGroupId;
  rows: Row[];
  total: number;
  loading: boolean;
}

const resolved = computed<Row[]>(() =>
  tiles.value.map((tile) => ({
    tile,
    res: resolveTile(tile, {
      counts: counts.value,
      pending: pending.value,
      errors: errors.value,
      special: special.value,
      cached: cached.value,
    }),
  })),
);

/** Grupos con alguna tarjeta que seguirá visible (el rail no ofrece grupos vacíos). */
const groups = computed<GroupView[]>(() =>
  TODAY_GROUPS.map((id) => {
    const rows = resolved.value.filter(
      (r) => r.tile.group === id && !isZeroTile(r.tile, r.res),
    );
    return {
      id,
      rows,
      total: rows.reduce((sum, r) => sum + (r.res.value ?? 0), 0),
      loading: rows.some(
        (r) => r.res.state === "loading" && r.res.value === null,
      ),
    };
  }).filter((g) => g.rows.length > 0),
);

const activeGroup = ref<string>(ALL);
watch(groups, (list) => {
  if (
    activeGroup.value !== ALL &&
    !list.some((g) => g.id === activeGroup.value)
  )
    activeGroup.value = ALL;
});
const shownGroups = computed(() =>
  activeGroup.value === ALL
    ? groups.value
    : groups.value.filter((g) => g.id === activeGroup.value),
);

const anyLoading = computed(() =>
  resolved.value.some((r) => r.res.state === "loading" && r.res.value === null),
);
const allClear = computed(() => !anyLoading.value && groups.value.length === 0);
const cockpitFailed = computed(() =>
  categories.value.some(
    (c) => errors.value[c] !== undefined && !pending.value.has(c),
  ),
);

const statusText = computed(() => {
  const ts = updatedAt.value ?? cachedAt.value;
  if (!ts) return "";
  const time = new Date(ts).toLocaleTimeString(String(locale.value), {
    hour: "2-digit",
    minute: "2-digit",
  });
  return t("home.landing.updated_at", { time });
});

function describe(tile: TodayTile): string {
  return t(`home.today.tile.${tile.key}.desc`);
}

function open(tile: TodayTile): void {
  const query = { ...tile.link.query };
  // Las tarjetas del catálogo llevan su clave para que el listado pinte el chip del KPI.
  if (tile.source === "catalog") query.kpi = tile.key;
  void router.push({ name: tile.link.page, query });
}

function wantedSpecial(): Set<string> {
  return new Set(
    tiles.value.filter((tl) => tl.source === "special").map((tl) => tl.key),
  );
}

function load(force = false): void {
  if (force) cockpit.forceRefresh(categories.value, BASE_PATH);
  else cockpit.ensureCategories(categories.value, BASE_PATH);
  void today.loadSpecial(wantedSpecial(), force);
}

function reload(): void {
  load(true);
}

// Guarda como «último valor bueno» lo ya resuelto, sin reescribir si nada cambió.
let lastSignature = "";
watch(
  resolved,
  (rows) => {
    const ready: Record<string, number> = {};
    for (const r of rows)
      if (r.res.state === "ready" && !r.res.stale && r.res.value !== null)
        ready[r.tile.key] = r.res.value;
    const signature = JSON.stringify(ready);
    if (signature === lastSignature) return;
    lastSignature = signature;
    today.remember(ready);
  },
  { flush: "post" },
);

onMounted(async () => {
  // Los scopes deciden qué tarjetas hay: se espera al perfil para no pedir lo que no se va a mostrar
  // (si no carga, las tarjetas fallan abiertas: ver visibleTodayTiles).
  await ensureProfile().catch(() => undefined);
  load();
});

// Al conocerse el perfil pueden aparecer/desaparecer tarjetas especiales: se piden las nuevas.
watch(
  () => tiles.value.map((tl) => tl.key).join(","),
  () => load(),
);

defineExpose({ reload });
</script>

<style scoped lang="scss">
.today {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.today__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.today__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}
.today__status {
  font-size: 0.8rem;
  opacity: 0.7;
}
.today__alert {
  margin: 0;
}
.today__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.today__rail {
  flex: 0 0 150px;
}
.today__content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.today__clear {
  display: flex;
  align-items: center;
  margin: 0;
  opacity: 0.8;
}
@media (max-width: 720px) {
  .today__body {
    flex-direction: column;
  }
  .today__rail {
    flex-basis: auto;
    width: 100%;
  }
}
</style>
