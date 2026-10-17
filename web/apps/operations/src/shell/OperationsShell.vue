<template>
  <!--
    Shell de la SPA operativa. Se basa en el diseño de `home`: DashboardShell
    (PlatformTopBar + PlatformSidebar + main) bajo `.shipment-v2`, idéntico al
    resto del ERP.

    NAVEGACIÓN UNIFICADA: el PlatformSidebar (compartido) lista todos los
    módulos y herramientas con `<a href>` a páginas del ERP. Aquí interceptamos
    esos clics: si el destino corresponde a un módulo YA migrado a operations,
    navegamos por el router interno (SPA, sin recarga); si no (cargo/shipment/
    admin, aún páginas propias), dejamos la recarga normal. Así "todas las
    funcionalidades son accesibles" desde el mismo menú, sin duplicarlo.

    Rutas `fullscreen` (p. ej. home): traen su PROPIO DashboardShell/header, así
    que se renderizan sin envolver para no doblar el chrome.
  -->
  <v-app>
    <div
      class="shipment-v2"
      :data-theme="themeName"
      @click.capture="onNavClick"
    >
      <template v-if="isFullscreen">
        <!-- Sin mode="out-in" por el mismo motivo que la rama de abajo. -->
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="fade">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>
      </template>

      <DashboardShell
        v-else
        storage-key="tmwe:sidebar:operations"
        hide-platform-nav
        :show-page-topbar="!isHomeRoute"
      >
        <template #topbar-title>
          <div class="dsh-brand">
            <v-icon :icon="activeDomain.icon" size="20" />
            <span class="dsh-brand-name">{{ activeDomain.title }}</span>
          </div>
        </template>

        <!-- Nav de dominios de operations, bajo la nav de plataforma. -->
        <template #sidebar="{ collapsed }">
          <OperationsNav :collapsed="collapsed" />
        </template>

        <!--
          NO usar mode="out-in" aqui. Ese modo espera el `transitionend` del
          componente SALIENTE antes de montar el entrante; HomeMainPage nunca lo
          emite (su raiz no recibe las clases .fade-*), asi que la entrada quedaba
          bloqueada PARA SIEMPRE: <main> con un nodo comentario vacio, sin error en
          consola y con el router ya en la ruta correcta (router.push resuelve OK,
          afterEach sin fail). Se veia al salir de /ops/home hacia cualquier
          destino no-fullscreen (clients, giacenze, tracking) y dejaba el
          RouterView inservible para el resto de la sesion.
          El fade simultaneo (sin mode) da el mismo efecto visual sin bloquear.

          ME1: KeepAlive acotado por nombre a los listados de mayor trafico
          (ver KEEP_ALIVE_INCLUDE) — evita el remontaje completo del listado
          (y el parpadeo de tabla vacia) en cada ida y vuelta a un detalle.
          Deliberadamente NO es un wildcard "*-list": cada pagina que se
          agregue aqui necesita su propio onActivated (ver
          CargoListPage.vue/ShipmentListPage.vue/CrmListPage.vue/
          AnagraficaListPage.vue) para no mostrar datos obsoletos tras
          editar algo en el detalle.
        -->
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="fade">
            <KeepAlive :include="KEEP_ALIVE_INCLUDE">
              <component :is="Component" :key="r.path" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </DashboardShell>
    </div>

    <!-- Hosts globales montados 1 vez para toda la SPA. -->
    <AppToaster />
    <AppConfirmHost />
    <NotificationActionHost />
  </v-app>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTheme } from "vuetify";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import { resolveSpaTarget } from "@shared/platform/navTargets";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import AppToaster from "@/shell/AppToaster.vue";
import AppConfirmHost from "@/shell/AppConfirmHost.vue";
import NotificationActionHost from "@/shell/NotificationActionHost.vue";

const router = useRouter();
const route = useRoute();
const { t, te } = useI18n();
const theme = useTheme();
const themeName = computed(() => theme.global.name.value);

const isFullscreen = computed<boolean>(() => route.meta?.fullscreen === true);
// La landing y las actividades del día llevan su propia cabecera: sin barra de página.
const isHomeRoute = computed<boolean>(() => route.name === "home" || String(route.name ?? "").startsWith("home-"));

/** ME1 — nombres de componente (inferidos del nombre de archivo SFC) a mantener vivos entre navegaciones. */
const KEEP_ALIVE_INCLUDE = [
  "CargoListPage",
  "ShipmentListPage",
  "CrmListPage",
  "AnagraficaListPage",
  "TicketsListPage",
];

interface Domain {
  title: string;
  icon: string;
}
const activeDomain = computed<Domain>(() => {
  const r = router
    .getRoutes()
    .find(
      (x) =>
        x.meta?.title &&
        (x.name === route.name ||
          String(route.name ?? "").startsWith(String(x.name) + "-")),
    );
  if (!r) {
    return { title: t("common.operations"), icon: "mdi-apps" };
  }
  // Título TRADUCIDO por el nombre de la ruta (mismas claves que OperationsNav:
  // platform.opsnav.<name>); fallback al meta.title (español) si no hay clave.
  const key = `platform.opsnav.${String(r.name)}`;
  const title = te(key) ? t(key) : (r.meta.title as string);
  return { title, icon: (r.meta.icon as string) ?? "mdi-apps" };
});

/**
 * Intercepta clics en enlaces (<a>) del chrome de plataforma. Si el href es de
 * un módulo migrado, navega por el router (SPA) evitando la recarga y
 * PRESERVANDO el query string (?new=1…). Cualquier otro enlace (módulo no
 * migrado, anclas #, externos) sigue su curso normal.
 *
 * El mapeo href→ruta vive centralizado en `resolveSpaTarget` (navTargets), la
 * misma fuente que usan ActionCard y los helpers moduleHref/detailHref.
 */
function onNavClick(ev: MouseEvent): void {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey)
    return;
  const a = (ev.target as HTMLElement | null)?.closest("a");
  if (!a) return;
  const href = a.getAttribute("href") ?? "";
  if (!href.startsWith("/erp/tmwe_json/")) return; // externos / anclas → normal
  const target = resolveSpaTarget(href);
  if (!target) return; // módulo no migrado / href ya-operations → curso normal
  ev.preventDefault();
  void router.push({ name: target.name, query: target.query });
}
</script>

<style scoped>
.dsh-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-brand-name {
  font-weight: 600;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
