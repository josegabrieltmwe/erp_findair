import { createApp } from "vue";
import App from "./App.vue";
import { vuetify } from "./plugins/vuetify";
import { pinia } from "./plugins/pinia";
import { i18n } from "./plugins/i18n";
import { router } from "./router";
import { installFetchInterceptor } from "@shared/anagrafiche/services/http";
import { startPresenceHeartbeat } from "@shared/presence/presence";
import "./styles/tokens.scss";
import "@shared/styles/switch.scss"; // compact iOS-like <v-switch>, all apps
import "./styles/reset.scss";
import "./styles/page-utils.scss";
// Layout V2 global (namespace `.shipment-v2`): da estilo a las páginas de
// detalle de cargo/shipment (CargoDetailLayoutV2, overview, tarjetas…). Es
// entity-agnostic y las apps standalone cargo/shipment lo importaban en su
// main.ts; sin él, esas vistas integradas se renderizan SIN sus estilos base.
import "@shared/styles/mockup2.scss";
import "@shared/styles/cockpit.scss";

installFetchInterceptor();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(i18n);
app.use(vuetify);
app.mount("#app-wrapper");

// Presencia online: latido de esta pestaña (se para solo si el backend tiene
// la presencia desactivada). Ver docs/03-diseno/presencia_online/PROPUESTA.md.
startPresenceHeartbeat({
  basePath: () => window.__TMWE_NAV__?.basePath ?? "/bff/v1",
});
