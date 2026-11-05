import { onActivated, onMounted } from 'vue';

/**
 * Entrada a un listado que vive bajo <KeepAlive> (OperationsShell.vue).
 *
 * Vue dispara `activated` también la PRIMERA vez que un componente se inserta
 * dentro de un KeepAlive, justo después de `mounted`. Si las dos llaman a la
 * carga, la primera visita pide el listado (y sus KPI) dos veces. Aquí:
 *
 *  - `onMounted` hace la carga real (y deja la página funcionar fuera de un
 *    KeepAlive, p.ej. en un test);
 *  - la primera activación, que sigue al montaje, se ignora;
 *  - cada reactivación posterior (volver de un detalle) recarga, para no
 *    enseñar datos obsoletos si algo cambió en el detalle.
 *
 * `onReenter` corre antes de `enter` solo en las reactivaciones (p.ej. para
 * invalidar la caché de los KPI).
 */
export function useListEntry(
  enter: () => void | Promise<void>,
  opts: { onReenter?: () => void } = {},
): void {
  let skipNextActivation = false;

  onMounted(async () => {
    skipNextActivation = true;
    await enter();
  });

  onActivated(() => {
    if (skipNextActivation) {
      skipNextActivation = false;
      return;
    }
    opts.onReenter?.();
    void enter();
  });
}
