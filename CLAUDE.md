# erp_findair

SPA (`web/`) + BFF Slim 4 (`bff/`) sobre la API `tmwe_api`.

## Documentación

- La documentación del proyecto vive en `docs/`. Índice: `docs/README.md`. Lo que el ERP pide al API está en `docs/contrato-con-api.md`: al resolverse o añadirse una petición, actualizar ese documento y no abrir otro.
- Los READMEs de código (`bff/README.md`, `web/packages/scripts/I18N.md`) se quedan junto al código.
- Idioma: español. El backend se llama `tmwe_api` (antes `tmwe_json`).
- Cada documento lleva bajo el título `> **Estado:** borrador | vigente | ejecutado | obsoleto · **Última modificación:** AAAA-MM-DD`.
- Si un cambio de código altera lo que dice un documento, se actualiza en el mismo cambio. Un documento sustituido se marca `obsoleto` y enlaza al nuevo.
- Nunca se versionan resultados de consultas a producción (`*.local.md`).
- Estructura objetivo (aún no aplicada): `00-gobierno` … `07-gestion`, `99-archivo`. Comprobar enlaces antes de mover ficheros.
