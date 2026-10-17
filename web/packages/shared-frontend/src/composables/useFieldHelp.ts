import { ref, type Ref } from 'vue';

/**
 * Per-field help texts for a form (legacy itxt.php). Loads the whole
 * { campo: help } map once and exposes a lookup. Store-agnostic: the app
 * injects the fetcher (its own form-field-help service) and the form id.
 *
 * The help text contains light HTML (<b>, <br>); callers decide whether to
 * render it (tooltip) or strip it (plain hint) via `helpText`/`helpHtml`.
 */
export interface FieldHelp {
  ready: Ref<boolean>;
  /** Raw help (may contain <b>/<br>). '' when none. */
  helpHtml: (field: string) => string;
  /** Plain-text help (HTML stripped, <br>→space). '' when none. */
  helpText: (field: string) => string;
  load: () => Promise<void>;
}

export interface FieldHelpDeps {
  /** Legacy form id (cargo='40', express='31'). */
  formId: string;
  /** Returns the { campo: help } map for the form in the active language. */
  fetcher: (formId: string) => Promise<Record<string, string>>;
}

export function useFieldHelp(deps: FieldHelpDeps): FieldHelp {
  const map = ref<Record<string, string>>({});
  const ready = ref(false);
  let loading = false;

  async function load(): Promise<void> {
    if (ready.value || loading) return;
    loading = true;
    try {
      map.value = await deps.fetcher(deps.formId);
    } catch {
      map.value = {};
    } finally {
      ready.value = true;
      loading = false;
    }
  }

  function helpHtml(field: string): string {
    return map.value[field] ?? '';
  }

  function helpText(field: string): string {
    const raw = map.value[field] ?? '';
    if (!raw) return '';
    return raw
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { ready, helpHtml, helpText, load };
}
