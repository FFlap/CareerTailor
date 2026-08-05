import { useCallback, useState } from "react";

export function useDragReorder({
  listId,
  onMove,
}: {
  listId: string;
  onMove: (from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      onMove(from, to);
      // The handle keeps its DOM position, so follow the row to its new index.
      requestAnimationFrame(() => {
        const handle = document.querySelector<HTMLElement>(
          `[data-drag-handle="${listId}:${to}"]`,
        );
        handle?.focus();
      });
    },
    [listId, onMove],
  );

  const dragProps = useCallback(
    (index: number, label: string, count: number) => ({
      "data-drag-handle": `${listId}:${index}`,
      draggable: true as const,
      "aria-label": `Reorder ${label}. Position ${index + 1} of ${count}. Use the arrow keys to move it.`,
      onDragStart: (event: React.DragEvent) => {
        setDragging(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${listId}:${index}`);
        const row = (event.currentTarget as HTMLElement).closest(
          "[data-drag-row]",
        );
        if (row) event.dataTransfer.setDragImage(row, 12, 12);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "ArrowUp" && index > 0) {
          event.preventDefault();
          move(index, index - 1);
        }
        if (event.key === "ArrowDown" && index < count - 1) {
          event.preventDefault();
          move(index, index + 1);
        }
      },
    }),
    [listId, move],
  );

  const dropProps = useCallback(
    (index: number) => ({
      "data-drag-row": true,
      onDragOver: (event: React.DragEvent) => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (over !== index) setOver(index);
      },
      onDrop: (event: React.DragEvent) => {
        if (dragging === null) return;
        event.preventDefault();
        event.stopPropagation();
        move(dragging, index);
        setDragging(null);
        setOver(null);
      },
    }),
    [dragging, move, over],
  );

  /** Where the row would land, for the drop rule. */
  const dropEdge = useCallback(
    (index: number): "top" | "bottom" | null => {
      if (dragging === null || over !== index || dragging === index) return null;
      return dragging < index ? "bottom" : "top";
    },
    [dragging, over],
  );

  return { dragging, dragProps, dropProps, dropEdge };
}
