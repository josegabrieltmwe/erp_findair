# E2E de la UI (Playwright)

Plan y catálogo de casos: `docs/pruebas/plan-de-pruebas-ui.md`.

```
export E2E_BASE_URL=https://erp-findair.php8   # opcional
export E2E_USER=...  E2E_PASS=...               # usuario de pruebas
cd web && npx playwright install chromium       # una vez
pnpm e2e
```
Sin credenciales solo corre el proyecto `anon`: `npx playwright test --project=anon`.
