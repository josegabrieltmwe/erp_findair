/**
 * Pantalla «sin acceso al ERP». Se pinta ANTES de montar la SPA (no hay vue-i18n, Vuetify, router ni
 * Pinia), así que los textos viven aquí en los 5 idiomas, igual que `authError.ts`. No nombra scopes
 * ni endpoints. La única acción es cerrar la sesión: «volver» reentraría en el mismo estado.
 */
import type { AuthErrorLocale } from './authError';

interface NoAccessTexts {
  title: string;
  message: string;
  logout: string;
}

const TEXTS: Record<AuthErrorLocale, NoAccessTexts> = {
  es: { title: 'No tienes acceso a este sistema', message: 'Tu usuario no tiene permisos para usar esta aplicación. Si crees que es un error, contacta con tu administrador.', logout: 'Cerrar sesión' },
  en: { title: 'You do not have access to this system', message: 'Your user is not allowed to use this application. If you think this is a mistake, contact your administrator.', logout: 'Sign out' },
  it: { title: 'Non hai accesso a questo sistema', message: 'Il tuo utente non è autorizzato a usare questa applicazione. Se pensi sia un errore, contatta il tuo amministratore.', logout: 'Esci' },
  nl: { title: 'Je hebt geen toegang tot dit systeem', message: 'Je gebruiker mag deze applicatie niet gebruiken. Denk je dat dit een vergissing is, neem dan contact op met je beheerder.', logout: 'Afmelden' },
  de: { title: 'Sie haben keinen Zugriff auf dieses System', message: 'Ihr Benutzer darf diese Anwendung nicht verwenden. Falls Sie einen Irrtum vermuten, wenden Sie sich an Ihren Administrator.', logout: 'Abmelden' },
};

export function noAccessMessage(locale: string | null): NoAccessTexts {
  const v = (locale ?? '').toLowerCase().slice(0, 2);
  return TEXTS[v in TEXTS ? (v as AuthErrorLocale) : 'en'];
}

/** Pinta la pantalla en `#app-wrapper` con nodos DOM (nada de `innerHTML`). */
export function renderNoAccess(locale: string | null, onLogout: () => void): void {
  if (typeof document === 'undefined') return;
  const { title, message, logout } = noAccessMessage(locale);
  const host = document.getElementById('app-wrapper') ?? document.body;
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.setAttribute('data-testid', 'no-access');
  box.style.cssText = 'font-family:sans-serif;max-width:480px;margin:15vh auto;padding:24px;text-align:center';
  const h = document.createElement('h1');
  h.style.cssText = 'font-size:1.25rem;margin:0 0 12px';
  h.textContent = title;
  const p = document.createElement('p');
  p.style.cssText = 'margin:0 0 20px';
  p.textContent = message;
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('data-testid', 'no-access-logout');
  b.textContent = logout;
  b.style.cssText = 'padding:8px 20px;border:1px solid currentColor;border-radius:4px;background:none;color:inherit;cursor:pointer;font:inherit';
  b.addEventListener('click', onLogout);
  box.append(h, p, b);
  host.replaceChildren(box);
}
