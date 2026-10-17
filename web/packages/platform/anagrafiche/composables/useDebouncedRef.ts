import { ref, customRef, type Ref } from 'vue';

/** Debounced reactive ref — useful for search inputs that fire API calls. */
export function useDebouncedRef<T>(initial: T, delay = 300): Ref<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return customRef<T>((track, trigger) => {
    let value = initial;
    return {
      get() {
        track();
        return value;
      },
      set(newValue: T) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          value = newValue;
          trigger();
        }, delay);
      },
    };
  });
}

/** Debounced callback (alternative to debounced ref when you need a function). */
export function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

/** Mirror of `ref` to keep imports tidy in features that don't use debounce. */
export const _passthrough = ref;
