import { useConfirmStore, type ConfirmOptions } from '../stores/confirm.store';

export function useConfirm() {
  const store = useConfirmStore();
  return {
    ask: (options: ConfirmOptions) => store.ask(options),
    askDanger: (message: string, title?: string) =>
      store.ask({ message, title, variant: 'danger', confirmLabel: 'Eliminar' }),
  };
}
