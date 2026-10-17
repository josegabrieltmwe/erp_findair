import { bootstrapBff } from "@tmwe/shared-frontend/http";

// Punto de entrada. Comprueba la sesión del BFF antes de cargar nada más: sin sesión
// se redirige a /bff/auth/login y la SPA no llega a evaluarse. La app se importa de
// forma dinámica porque los módulos leen los globales (`__TMWE_NAV__`,
// `__TMWE_OPERATIONS__`, antes inyectados por PHP) que `bootstrapBff` deja listos.
if (await bootstrapBff()) {
  await import("./app");
}
