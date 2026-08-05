import { useCallback, useEffect, useState } from "react";

export function useDisclosure(storageKey: string) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpen({});
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) setOpen(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  const write = useCallback(
    (next: Record<string, boolean>) => {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    },
    [storageKey],
  );

  const isOpen = useCallback((key: string) => open[key] ?? false, [open]);

  const toggle = useCallback(
    (key: string) =>
      setOpen((prev) => write({ ...prev, [key]: !(prev[key] ?? false) })),
    [write],
  );

  const set = useCallback(
    (key: string, value: boolean) =>
      setOpen((prev) => write({ ...prev, [key]: value })),
    [write],
  );

  const setAll = useCallback(
    (keys: string[], value: boolean) =>
      setOpen(() =>
        write(value ? Object.fromEntries(keys.map((key) => [key, true])) : {}),
      ),
    [write],
  );

  return { isOpen, toggle, set, setAll };
}
