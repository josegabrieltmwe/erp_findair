import { http } from './http';

/**
 * Per-field help map (legacy itxt.php). Wraps api_form_field_help.
 * Cargo form id = '40'.
 */
export const fieldHelpService = {
  async map(formId: string, lang = ''): Promise<Record<string, string>> {
    const r = await http<{ success: boolean; help: Record<string, string> }>(
      '/api_form_help',
      { query: lang ? { form: formId, lang } : { form: formId } },
    );
    return r.help ?? {};
  },
};
