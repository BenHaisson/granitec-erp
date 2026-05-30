/**
 * useDraft — persists form state to localStorage so users can resume
 * after navigating away or closing the browser.
 *
 * Usage:
 *   const { draft, update, clearDraft, draftBanner } = useDraft('my-form', initialValue);
 *
 * - update(partialOrFn) — call instead of setState; auto-saves to localStorage
 * - clearDraft()        — call on successful submit to wipe the saved draft
 * - hasDraft           — true while waiting for user to choose continue/fresh
 * - continueDraft()    — user chose to keep their work
 * - discardDraft()     — user chose to start fresh
 * - savedAt            — ISO timestamp of when the draft was last saved
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { todayISO } from '@/utils/dates';

const PREFIX = 'granitec:draft:';
export const LAST_DATE_KEY = 'granitec:lastEntryDate';

export function getLastEntryDate(): string {
  return localStorage.getItem(LAST_DATE_KEY) ?? todayISO();
}
export function saveLastEntryDate(date: string) {
  if (date) localStorage.setItem(LAST_DATE_KEY, date);
}

type DraftState = 'loading' | 'asking' | 'ready';

export function useDraft<T extends object>(key: string, initial: T) {
  const storageKey = PREFIX + key;
  const savedSnapshot = useRef<T | null>(null);

  const [state, setState] = useState<DraftState>('loading');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [current, setCurrent] = useState<T>(initial);

  // On mount — check for a stored draft
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed: { data: T; ts: string } = JSON.parse(raw);
        savedSnapshot.current = parsed.data;
        setSavedAt(parsed.ts);
        setState('asking');
      } catch {
        localStorage.removeItem(storageKey);
        setState('ready');
      }
    } else {
      setState('ready');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const continueDraft = useCallback(() => {
    if (savedSnapshot.current) setCurrent(savedSnapshot.current);
    setState('ready');
  }, []);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrent(initial);
    setState('ready');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  /** Call this whenever a field changes — replaces individual setState calls */
  const update = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setCurrent(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      localStorage.setItem(storageKey, JSON.stringify({ data: next, ts: new Date().toISOString() }));
      return next;
    });
  }, [storageKey]);

  /** Call after a successful save to wipe the draft */
  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    draft: current,
    update,
    clearDraft,
    hasDraft: state === 'asking',
    isReady: state === 'ready',
    savedAt,
    continueDraft,
    discardDraft,
  };
}
