import { bootstrapBff, hasErpAccess, showNoAccess } from "@tmwe/shared-frontend/http";

// Punto de entrada. Comprueba la sesión del BFF antes de cargar nada más: sin sesión
// se redirige a /bff/auth/login y la SPA no llega a evaluarse. La app se importa de
// forma dinámica porque los módulos leen los globales (`__TMWE_NAV__`,
// `__TMWE_OPERATIONS__`, antes inyectados por PHP) que `bootstrapBff` deja listos.
// Si el API declaró que el usuario no tiene ningún acceso al ERP, no se monta la SPA
// (evita el aluvión de 403 de los widgets del home): solo se ofrece cerrar sesión.
if (await bootstrapBff()) {
  if (hasErpAccess()) {
    await import("./app");
  } else {
    showNoAccess();
  }
}
