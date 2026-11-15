/**
 * Polyfills para montar componentes Vuetify (VDialog/VMenu/VOverlay…) bajo
 * happy-dom en los tests de MONTAJE (`*.mount.spec.ts`, ver
 * `environmentMatchGlobs` en vitest.config.ts).
 *
 * `VOverlay` (base de VDialog) usa `window.visualViewport` para calcular su
 * posición; happy-dom no lo implementa y sin esto cualquier mount() de un
 * componente con VDialog/VMenu revienta con "visualViewport is not defined"
 * en cuanto Vuetify intenta abrir el overlay.
 *
 * Este fichero se registra como `test.setupFiles` GLOBAL (se ejecuta para
 * TODOS los specs, también los de lógica pura en entorno "node"): el guard
 * `typeof window` evita que reviente donde no hay DOM.
 */
if (typeof window !== "undefined" && !window.visualViewport) {
  // Objeto mínimo compatible con el uso que hace Vuetify (lectura de
  // width/height/offsetLeft/offsetTop + un addEventListener que no hace nada).
  (window as unknown as { visualViewport: unknown }).visualViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
