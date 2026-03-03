'use client';

import { useCallback, useEffect, useState } from 'react';

type SetValue<T> = T | ((prev: T) => T);

interface UseLocalStorageStateOptions<T> {
  defaultValue: T;
}

export function useLocalStorageState<T>(
  key: string,
  options: UseLocalStorageStateOptions<T>
) {
  const { defaultValue } = options;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota and serialization errors.
    }
  }, [key, value]);

  const updateValue = useCallback((next: SetValue<T>) => {
    setValue((prev) =>
      typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
    );
  }, []);

  return [value, updateValue] as const;
}
