/**
 * Re-export del toast store único (packages/platform/stores/toast.store.ts).
 *
 * Aquí vivía un segundo store con el mismo id de Pinia (`toast`) y otra forma (`toasts` + `error()`): según cuál se
 * creaba antes, los avisos se perdían. Se conserva la ruta para sus ~100 consumidores.
 */
export * from '../../stores/toast.store';
