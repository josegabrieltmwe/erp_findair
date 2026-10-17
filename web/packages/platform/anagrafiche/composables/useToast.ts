import { useToastStore } from '../stores/toast.store';

export function useToast() {
  return useToastStore();
}
