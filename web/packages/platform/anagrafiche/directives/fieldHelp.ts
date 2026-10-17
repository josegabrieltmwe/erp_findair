/**
 * Directiva `v-field-help` — tooltip de ayuda por campo (paridad icono "i" del
 * legacy `flashfunz.php::Cmp` / `itxt.php`).
 *
 * Uso:  <v-text-field v-model="…" v-field-help="'rag_soc'" />
 *
 * El binding es la CLAVE de campo (`rag_soc`), que se expande a la clave i18n
 * `anagrafiche.help.rag_soc`. Al pasar el mouse (o enfocar) el campo durante
 * ~1.5s, muestra un tooltip flotante con la explicación en el idioma i18n
 * activo. Si no existe la clave de ayuda para ese campo, NO muestra nada
 * (permite desplegar campo a campo sin tooltips vacíos).
 *
 * Diseño:
 *  - El texto es PLANO (los locales guardan texto sin HTML) → se inyecta con
 *    textContent, sin riesgo XSS.
 *  - El delay de 1.5s vive aquí (setTimeout), NO en la config global de Vuetify,
 *    para no afectar a los tooltips de iconos (que abren rápido).
 *  - Accesible: se dispara también con focus/blur y usa role="tooltip".
 *  - El paquete compartido no acopla ninguna app: la instancia i18n se inyecta
 *    al instalar el plugin (createFieldHelpPlugin(i18n)).
 */
import type { App, DirectiveBinding, ObjectDirective } from 'vue';

/** Contrato mínimo del i18n global que necesitamos (vue-i18n Composer/global). */
interface I18nLike {
  te: (key: string) => boolean;
  t: (key: string) => string;
}

const OPEN_DELAY_MS = 1500;
const HELP_PREFIX = 'anagrafiche.help.';
const POP_CLASS = 'cm-field-help-pop';

/** Estado por-elemento, para poder limpiar en unmount. */
interface HelpState {
  key: string;
  enterTimer: number | null;
  pop: HTMLElement | null;
  onEnter: () => void;
  onLeave: () => void;
  onScroll: () => void;
}
const states = new WeakMap<HTMLElement, HelpState>();

function resolveText(i18n: I18nLike, campo: string): string | null {
  if (!campo) return null;
  const key = HELP_PREFIX + campo;
  if (!i18n.te(key)) return null;
  const txt = i18n.t(key);
  return txt && txt !== key ? txt : null;
}

function buildPopover(text: string): HTMLElement {
  const pop = document.createElement('div');
  pop.className = POP_CLASS;
  pop.setAttribute('role', 'tooltip');
  pop.textContent = text; // texto plano → sin XSS
  return pop;
}

function positionPopover(pop: HTMLElement, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  // Preferimos arriba del campo; si no cabe, debajo.
  pop.style.position = 'fixed';
  pop.style.visibility = 'hidden';
  document.body.appendChild(pop);
  const ph = pop.offsetHeight;
  const pw = pop.offsetWidth;
  let top = r.top - ph - 8;
  if (top < 8) top = r.bottom + 8; // no cabe arriba → debajo
  let left = r.left;
  const maxLeft = window.innerWidth - pw - 8;
  if (left > maxLeft) left = Math.max(8, maxLeft);
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.visibility = 'visible';
}

export function createFieldHelpPlugin(i18n: I18nLike) {
  const directive: ObjectDirective<HTMLElement, string> = {
    mounted(el, binding) {
      setup(el, binding);
    },
    updated(el, binding) {
      // La clave puede cambiar (raro) o el idioma; re-vinculamos el texto en
      // el momento de mostrar, así que basta actualizar la key guardada.
      const st = states.get(el);
      if (st) st.key = String(binding.value ?? '');
    },
    unmounted(el) {
      teardown(el);
    },
  };

  function setup(el: HTMLElement, binding: DirectiveBinding<string>): void {
    const key = String(binding.value ?? '');
    // Si no hay ayuda para este campo, no instalamos listeners.
    if (!resolveText(i18n, key)) return;

    const show = (): void => {
      const st = states.get(el);
      if (!st) return;
      const text = resolveText(i18n, st.key); // resuelve en el idioma ACTUAL
      if (!text) return;
      hide(el); // limpia cualquier pop previo
      const pop = buildPopover(text);
      positionPopover(pop, el);
      st.pop = pop;
      window.addEventListener('scroll', st.onScroll, true);
      window.addEventListener('resize', st.onScroll);
    };

    const onEnter = (): void => {
      const st = states.get(el);
      if (!st) return;
      if (st.enterTimer) window.clearTimeout(st.enterTimer);
      st.enterTimer = window.setTimeout(show, OPEN_DELAY_MS);
    };
    const onLeave = (): void => {
      const st = states.get(el);
      if (!st) return;
      if (st.enterTimer) { window.clearTimeout(st.enterTimer); st.enterTimer = null; }
      hide(el);
    };
    const onScroll = (): void => hide(el);

    const st: HelpState = { key, enterTimer: null, pop: null, onEnter, onLeave, onScroll };
    states.set(el, st);

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focusin', onEnter);
    el.addEventListener('focusout', onLeave);
  }

  function hide(el: HTMLElement): void {
    const st = states.get(el);
    if (!st) return;
    if (st.pop) {
      window.removeEventListener('scroll', st.onScroll, true);
      window.removeEventListener('resize', st.onScroll);
      st.pop.remove();
      st.pop = null;
    }
  }

  function teardown(el: HTMLElement): void {
    const st = states.get(el);
    if (!st) return;
    if (st.enterTimer) window.clearTimeout(st.enterTimer);
    hide(el);
    el.removeEventListener('mouseenter', st.onEnter);
    el.removeEventListener('mouseleave', st.onLeave);
    el.removeEventListener('focusin', st.onEnter);
    el.removeEventListener('focusout', st.onLeave);
    states.delete(el);
  }

  return {
    install(app: App): void {
      app.directive('field-help', directive);
      injectStyleOnce();
    },
  };
}

/** Inyecta el CSS del popover una sola vez (evita depender de import de estilos). */
function injectStyleOnce(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cm-field-help-style')) return;
  const style = document.createElement('style');
  style.id = 'cm-field-help-style';
  style.textContent = `
.${POP_CLASS} {
  z-index: 3000;
  max-width: 320px;
  padding: 8px 11px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.45;
  color: rgb(var(--v-theme-on-surface, 30 34 40));
  background: rgb(var(--v-theme-surface, 255 255 255));
  border: 1px solid rgba(var(--v-border-color, 0 0 0), var(--v-border-opacity, 0.12));
  box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.12);
  pointer-events: none;
}`;
  document.head.appendChild(style);
}
