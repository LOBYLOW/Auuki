/**
 * useKeyboardShortcuts Hook
 * 
 * Handles global keyboard shortcuts for the workout builder.
 */

import { useEffect, useCallback } from 'react';
import { useWorkoutBuilderStore, useUndo, useRedo } from '../store';
import { SHORTCUTS } from '../constants';
import { applySnap } from '../utils';

export function useKeyboardShortcuts() {
  const {
    selectedIds,
    deleteSelected,
    duplicateBlock,
    selectAll,
    clearSelection,
    updateBlock,
    snapConfig,
    workout,
  } = useWorkoutBuilderStore();

  const undo = useUndo();
  const redo = useRedo();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Undo: Ctrl+Z
      if (isCtrl && e.key.toLowerCase() === SHORTCUTS.UNDO) {
        e.preventDefault();
        if (isShift) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Redo: Ctrl+Y
      if (isCtrl && (SHORTCUTS.REDO as readonly string[]).includes(e.key)) {
        e.preventDefault();
        redo();
        return;
      }

      // Select All: Ctrl+A
      if (isCtrl && e.key.toLowerCase() === SHORTCUTS.SELECT_ALL) {
        e.preventDefault();
        selectAll();
        return;
      }

      // Duplicate: Ctrl+D
      if (isCtrl && e.key.toLowerCase() === SHORTCUTS.DUPLICATE) {
        e.preventDefault();
        if (selectedIds.length === 1) {
          duplicateBlock(selectedIds[0]);
        }
        return;
      }

      // Delete: Delete or Backspace
      if ((SHORTCUTS.DELETE as readonly string[]).includes(e.key)) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Escape: Clear selection
      if (e.key === SHORTCUTS.ESCAPE) {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Arrow keys for adjusting selected block
      if (selectedIds.length === 1) {
        const blockId = selectedIds[0];
        const block = workout.blocks.find(
          (b) => b.id === blockId || (b.type === 'repeat' && b.blocks?.some((bb) => bb.id === blockId))
        );

        // This is simplified - in reality we'd need to find the actual block
        const increment = isShift ? 'large' : 'small';

        switch (e.key) {
          case SHORTCUTS.ARROW_RIGHT:
            e.preventDefault();
            // Increase duration
            adjustBlockDuration(blockId, increment === 'large' ? 60 : 15, updateBlock, snapConfig);
            break;

          case SHORTCUTS.ARROW_LEFT:
            e.preventDefault();
            // Decrease duration
            adjustBlockDuration(blockId, increment === 'large' ? -60 : -15, updateBlock, snapConfig);
            break;

          case SHORTCUTS.ARROW_UP:
            e.preventDefault();
            // Increase power
            adjustBlockPower(blockId, increment === 'large' ? 0.10 : 0.05, updateBlock, snapConfig);
            break;

          case SHORTCUTS.ARROW_DOWN:
            e.preventDefault();
            // Decrease power
            adjustBlockPower(blockId, increment === 'large' ? -0.10 : -0.05, updateBlock, snapConfig);
            break;
        }
      }
    },
    [selectedIds, deleteSelected, duplicateBlock, selectAll, clearSelection, undo, redo, updateBlock, snapConfig, workout]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Helper functions for arrow key adjustments
function adjustBlockDuration(
  blockId: string,
  delta: number,
  updateBlock: (id: string, updates: Record<string, unknown>) => void,
  _snapConfig: unknown
) {
  // We'd need access to current duration - this is a simplified version
  // In practice, you'd fetch current value from store
  updateBlock(blockId, {
    // This would need the current value + delta, properly clamped
  });
}

function adjustBlockPower(
  blockId: string,
  delta: number,
  updateBlock: (id: string, updates: Record<string, unknown>) => void,
  _snapConfig: unknown
) {
  // Similar to above
}

export default useKeyboardShortcuts;
