/**
 * Error de inicio de sesión devuelto por el BFF (`/?auth_error=<codigo>`).
 *
 * Esto se pinta ANTES de que exista la SPA (ni vue-i18n ni Vuetify están cargados), por eso los
 * textos viven aquí en los 5 idiomas de la aplicación en vez de en los bundles `locales/`.
 * Al mostrar el error no se redirige al login: reintentar es una acción explícita del usuario
 * (el enlace «Reintentar»), así no hay bucle si el fallo se repite.
 */

export type AuthErrorLocale = 'it' | 'en' | 'es' | 'nl' | 'de';

interface AuthErrorTexts {
  title: string;
  /** Códigos conocidos del BFF (`AuthController`); el resto usa `generic`. */
  codes: Record<string, string>;
  generic: string;
  retry: string;
}

const TEXTS: Record<AuthErrorLocale, AuthErrorTexts> = {
  es: {
    title: 'No se pudo iniciar sesión',
    codes: {
      invalid_state: 'La respuesta del inicio de sesión no coincide con la solicitud. Vuelve a intentarlo.',
      login_expired: 'El inicio de sesión ha caducado. Vuelve a intentarlo.',
      token_exchange_failed: 'El servidor no confirmó el inicio de sesión. Vuelve a intentarlo.',
    },
    generic: 'El inicio de sesión ha fallado. Vuelve a intentarlo.',
    retry: 'Reintentar',
  },
  en: {
    title: 'Sign-in failed',
    codes: {
      invalid_state: 'The sign-in response does not match the request. Please try again.',
      login_expired: 'The sign-in attempt has expired. Please try again.',
      token_exchange_failed: 'The server did not confirm the sign-in. Please try again.',
    },
    generic: 'Sign-in failed. Please try again.',
    retry: 'Try again',
  },
  it: {
    title: 'Accesso non riuscito',
    codes: {
      invalid_state: 'La risposta di accesso non corrisponde alla richiesta. Riprova.',
      login_expired: 'Il tentativo di accesso è scaduto. Riprova.',
      token_exchange_failed: 'Il server non ha confermato l\'accesso. Riprova.',
    },
    generic: 'Accesso non riuscito. Riprova.',
    retry: 'Riprova',
  },
  nl: {
    title: 'Aanmelden mislukt',
    codes: {
      invalid_state: 'Het antwoord van de aanmelding komt niet overeen met het verzoek. Probeer het opnieuw.',
      login_expired: 'De aanmelding is verlopen. Probeer het opnieuw.',
      token_exchange_failed: 'De server heeft de aanmelding niet bevestigd. Probeer het opnieuw.',
    },
    generic: 'Aanmelden mislukt. Probeer het opnieuw.',
    retry: 'Opnieuw proberen',
  },
  de: {
    title: 'Anmeldung fehlgeschlagen',
    codes: {
      invalid_state: 'Die Antwort der Anmeldung passt nicht zur Anfrage. Bitte erneut versuchen.',
      login_expired: 'Die Anmeldung ist abgelaufen. Bitte erneut versuchen.',
      token_exchange_failed: 'Der Server hat die Anmeldung nicht bestätigt. Bitte erneut versuchen.',
    },
    generic: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
    retry: 'Erneut versuchen',
  },
};

/** Código `auth_error` de una query string, o null si no hay (solo `[a-z0-9_]`, máx. 64). */
export function authErrorFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('auth_error');
  if (!raw) return null;
  const code = raw.toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : 'unknown';
}

function pickLocale(stored: string | null): AuthErrorLocale {
  const v = (stored ?? '').toLowerCase().slice(0, 2);
  return v in TEXTS ? (v as AuthErrorLocale) : 'en';
}

export function authErrorMessage(code: string, locale: string | null): { title: string; message: string; retry: string } {
  const t = TEXTS[pickLocale(locale)];
  return { title: t.title, message: t.codes[code] ?? t.generic, retry: t.retry };
}

/** Pinta el error en `#app-wrapper` con nodos DOM (nada de `innerHTML`). `retryUrl` es una ruta interna. */
export function renderAuthError(code: string, locale: string | null, retryUrl: string): void {
  if (typeof document === 'undefined') return;
  const { title, message, retry } = authErrorMessage(code, locale);
  const host = document.getElementById('app-wrapper') ?? document.body;
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'font-family:sans-serif;max-width:480px;margin:15vh auto;padding:24px;text-align:center';
  const h = document.createElement('h1');
  h.style.cssText = 'font-size:1.25rem;margin:0 0 12px';
  h.textContent = title;
  const p = document.createElement('p');
  p.style.cssText = 'margin:0 0 20px';
  p.textContent = message;
  const a = document.createElement('a');
  a.href = retryUrl;
  a.textContent = retry;
  a.style.cssText = 'display:inline-block;padding:8px 20px;border:1px solid currentColor;border-radius:4px;text-decoration:none';
  box.append(h, p, a);
  host.replaceChildren(box);
}
