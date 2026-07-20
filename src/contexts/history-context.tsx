import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  isValidRating,
  type SpotHistory,
} from '@/types/spot-history';

type HistoryContextValue = {
  spotHistories: SpotHistory[];
  isHydrated: boolean;
  addSpotHistory: (input: Omit<SpotHistory, 'id' | 'updatedAt'>) => SpotHistory;
  updateSpotHistory: (
    id: string,
    patch: Partial<Omit<SpotHistory, 'id'>>
  ) => void;
  deleteSpotHistory: (id: string) => void;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

const STORAGE_KEY = 'family-ai-concierge:spotHistories';

function isSpotHistory(value: unknown): value is SpotHistory {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== 'string' ||
    typeof entry.spotId !== 'string' ||
    typeof entry.visitedOn !== 'string' ||
    typeof entry.updatedAt !== 'string' ||
    !Array.isArray(entry.participantIds) ||
    !entry.participantIds.every((id) => typeof id === 'string') ||
    !Array.isArray(entry.memberRatings)
  ) {
    return false;
  }
  if (
    !entry.memberRatings.every((rating) => {
      if (typeof rating !== 'object' || rating === null) {
        return false;
      }
      const row = rating as Record<string, unknown>;
      return typeof row.memberId === 'string' && isValidRating(row.rating);
    })
  ) {
    return false;
  }
  if (
    entry.spotDisplayName !== undefined &&
    typeof entry.spotDisplayName !== 'string'
  ) {
    return false;
  }
  if (entry.note !== undefined && typeof entry.note !== 'string') {
    return false;
  }
  if (entry.wantAgain !== undefined && typeof entry.wantAgain !== 'boolean') {
    return false;
  }
  return true;
}

function normalizeHistories(raw: unknown): SpotHistory[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isSpotHistory);
}

function createId(): string {
  return `visit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [spotHistories, setSpotHistories] = useState<SpotHistory[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || !json) {
          return;
        }
        const parsed = normalizeHistories(JSON.parse(json) as unknown);
        if (!cancelled) {
          setSpotHistories(parsed);
        }
      } catch {
        // Keep empty when storage is unavailable or corrupted.
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (histories: SpotHistory[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    } catch {
      // Persistence failure should not block editing.
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    void persist(spotHistories);
  }, [spotHistories, isHydrated, persist]);

  function addSpotHistory(
    input: Omit<SpotHistory, 'id' | 'updatedAt'>
  ): SpotHistory {
    const entry: SpotHistory = {
      ...input,
      id: createId(),
      updatedAt: new Date().toISOString(),
    };
    setSpotHistories((current) => [...current, entry]);
    return entry;
  }

  function updateSpotHistory(
    id: string,
    patch: Partial<Omit<SpotHistory, 'id'>>
  ) {
    setSpotHistories((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              id: entry.id,
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
    );
  }

  function deleteSpotHistory(id: string) {
    setSpotHistories((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <HistoryContext.Provider
      value={{
        spotHistories,
        isHydrated,
        addSpotHistory,
        updateSpotHistory,
        deleteSpotHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within HistoryProvider');
  }
  return context;
}
