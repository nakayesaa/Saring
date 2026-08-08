"use client";

import { useState } from "react";

export function useRowSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  function isSelected(id: string) {
    return selectedIds.has(id);
  }

  function allSelected(ids: readonly string[]) {
    return ids.length > 0 && ids.every(isSelected);
  }

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: readonly string[]) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const remove = ids.length > 0 && ids.every((id) => current.has(id));
      ids.forEach((id) => {
        if (remove) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  return { allSelected, count: selectedIds.size, isSelected, toggle, toggleAll };
}
