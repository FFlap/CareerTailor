import { useState } from "react";

const isEntryKey = (key: string) => /:\d+$/.test(key);

export const sectionsOpen = (key: string) => !isEntryKey(key);

export function useDisclosure(
  defaultOpen: (key: string) => boolean = () => false,
) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return {
    isOpen: (key: string) => open[key] ?? defaultOpen(key),

    toggle: (key: string) =>
      setOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen(key)) })),

    set: (key: string, value: boolean) =>
      setOpen((prev) => ({ ...prev, [key]: value })),

    setAll: (keys: string[], value: boolean) =>
      setOpen(Object.fromEntries(keys.map((key) => [key, value]))),
  };
}
