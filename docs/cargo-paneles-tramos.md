# Ficha de cargo: tramos de recogida y entrega en paneles laterales

> **Estado:** vigente (implementado en sandbox) · **Última modificación:** 2026-11-07

Desde la ficha de un cargo se opera cada tramo (la expedición de recogida y la de entrega) sin salir de ella.

## Qué hay

- **Botones en la barra superior** (flechas arriba-derecha y abajo-derecha, junto a chat y documentos): abren u ocultan el panel del tramo. Están desactivados, con la explicación en el título, si el cargo aún no tiene ese tramo.
- **Panel izquierdo = recogida** (`spedizioni_cargo.id_spediz_part`); **panel derecho = entrega** (`id_spediz_dest`). Se abren bajo solicitud y se ocultan con la x o con el mismo botón.
- **Contenido:** el mismo detalle de expedición que se abre desde el listado courier (`ShipmentOverviewV2` + sus modales), en el componente nuevo `ShipmentDetailDrawer` (versión genérica de `ShipmentDetailOverlay`, sin navegación entre registros). Trae la opción de abrir la ficha completa en otra pestaña.
- **Bloque «Envíos vinculados»** (card Direcciones): pulsar la recogida o la entrega abre su panel en vez de navegar a otra página; al crear un tramo nuevo se refresca el cargo y se abre su panel. El handler sigue abriendo su ficha.
- **Carga diferida:** el detalle de expedición va en un chunk aparte y solo se descarga al abrir un tramo.
- Al ocultar un panel se relee la cabecera del cargo (`cargo.store.refreshQuiet`, sin pantalla de carga) porque operar el tramo puede cambiar importes.

## Reparto de paneles y modales en la ficha de cargo

Los paneles laterales quedan reservados para los tramos; lo demás es modal para no competir por el mismo lado:

| Elemento | Antes | Ahora |
|---|---|---|
| Recogida / Entrega | — | panel izquierdo / derecho (`ShipmentDetailDrawer`) |
| CRM (expedición y cargo) | panel `v-navigation-drawer` derecho de 720 px | **modal** `CrmContextDialog` (880 px) |
| Documentos | `<aside>` propio de 440 px con pestaña fija en el borde y fondo oscuro | **modal** `DocumentsModal` (sin pestaña fija; el botón de la barra lo abre) |
| Auditoría | `v-navigation-drawer` derecho de 520 px | **modal** `AuditModal` |
| Chat | panel propio a la derecha | **sigue siendo panel** (tiempo real); se cierra al abrir un tramo y al revés |

Documentos y auditoría usan la pila de modales de la ficha (`ui.store`, un solo modal a la vez); `docOpen` y `auditOpen` salen de `activeModal`.

## Limitación conocida

Los dos paneles comparten el `shipment.store` de la aplicación, que guarda una sola expedición a la vez. **Solo uno puede estar abierto**: abrir la entrega cierra la recogida y al revés (`leg_panels.store`). Mostrar los dos a la vez exigiría un store de expedición por panel (o aislar cada panel en su propio contexto), un cambio mayor que no se hizo.

Los tramos son los que el cargo señala con `id_spediz_part` / `id_spediz_dest`. Una recogida o entrega adicional (otro tramo con `id_cargo` sin puntero, ver [listado courier](../../tmwe_api/docs/03-diseno/listado_courier_tramos_cargo.md)) no tiene panel: se alcanza desde el listado courier con el filtro «Tramos de cargo».

## Pruebas

`cargoLegs.spec.ts` (puntero del tramo, lado de cada panel, un solo panel abierto). Compilación de producción comprobada; el recorrido en navegador queda por hacer en sandbox.
