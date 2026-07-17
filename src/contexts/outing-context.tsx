import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/** MVP weather choices. Empty string = 指定なし (omit from API body). */
export const WEATHER_OPTIONS = ['', '晴れ', 'くもり', '雨'] as const;
export type WeatherOption = (typeof WEATHER_OPTIONS)[number];

export const WEATHER_LABELS: Record<WeatherOption, string> = {
  '': '指定なし',
  晴れ: '晴れ',
  くもり: 'くもり',
  雨: '雨',
};

type OutingContextValue = {
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  departurePlace: string;
  setDeparturePlace: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  transport: string;
  setTransport: (value: string) => void;
  specialRequests: string;
  setSpecialRequests: (value: string) => void;
  weather: WeatherOption;
  setWeather: (value: WeatherOption) => void;
  isHydrated: boolean;
};

const OutingContext = createContext<OutingContextValue | null>(null);

const STORAGE_KEY = 'family-ai-concierge:outingConditions';

const DEFAULTS = {
  startTime: '10:00',
  endTime: '16:00',
  departurePlace: '自宅',
  budget: '15000',
  transport: '車',
  specialRequests: '',
  weather: '' as WeatherOption,
};

function isWeatherOption(value: unknown): value is WeatherOption {
  return (
    typeof value === 'string' &&
    (WEATHER_OPTIONS as readonly string[]).includes(value)
  );
}

function parseStoredOuting(raw: unknown): Partial<typeof DEFAULTS> | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const next: Partial<typeof DEFAULTS> = {};

  if (typeof data.startTime === 'string') next.startTime = data.startTime;
  if (typeof data.endTime === 'string') next.endTime = data.endTime;
  if (typeof data.departurePlace === 'string') {
    next.departurePlace = data.departurePlace;
  }
  if (typeof data.budget === 'string') next.budget = data.budget;
  if (typeof data.transport === 'string') next.transport = data.transport;
  if (typeof data.specialRequests === 'string') {
    next.specialRequests = data.specialRequests;
  }
  // Legacy saves without weather still hydrate safely.
  if (isWeatherOption(data.weather)) {
    next.weather = data.weather;
  }

  return next;
}

export function OutingProvider({ children }: { children: ReactNode }) {
  const [startTime, setStartTime] = useState(DEFAULTS.startTime);
  const [endTime, setEndTime] = useState(DEFAULTS.endTime);
  const [departurePlace, setDeparturePlace] = useState(DEFAULTS.departurePlace);
  const [budget, setBudget] = useState(DEFAULTS.budget);
  const [transport, setTransport] = useState(DEFAULTS.transport);
  const [specialRequests, setSpecialRequests] = useState(
    DEFAULTS.specialRequests
  );
  const [weather, setWeather] = useState<WeatherOption>(DEFAULTS.weather);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || !json) {
          return;
        }
        const parsed = parseStoredOuting(JSON.parse(json) as unknown);
        if (!parsed || cancelled) {
          return;
        }
        if (parsed.startTime != null) setStartTime(parsed.startTime);
        if (parsed.endTime != null) setEndTime(parsed.endTime);
        if (parsed.departurePlace != null) {
          setDeparturePlace(parsed.departurePlace);
        }
        if (parsed.budget != null) setBudget(parsed.budget);
        if (parsed.transport != null) setTransport(parsed.transport);
        if (parsed.specialRequests != null) {
          setSpecialRequests(parsed.specialRequests);
        }
        if (parsed.weather != null) setWeather(parsed.weather);
      } catch {
        // Keep defaults when storage is unavailable or corrupted.
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

  const persist = useCallback(
    async (snapshot: {
      startTime: string;
      endTime: string;
      departurePlace: string;
      budget: string;
      transport: string;
      specialRequests: string;
      weather: WeatherOption;
    }) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Persistence failure should not block editing.
      }
    },
    []
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    void persist({
      startTime,
      endTime,
      departurePlace,
      budget,
      transport,
      specialRequests,
      weather,
    });
  }, [
    startTime,
    endTime,
    departurePlace,
    budget,
    transport,
    specialRequests,
    weather,
    isHydrated,
    persist,
  ]);

  return (
    <OutingContext.Provider
      value={{
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        departurePlace,
        setDeparturePlace,
        budget,
        setBudget,
        transport,
        setTransport,
        specialRequests,
        setSpecialRequests,
        weather,
        setWeather,
        isHydrated,
      }}
    >
      {children}
    </OutingContext.Provider>
  );
}

export function useOuting() {
  const context = useContext(OutingContext);
  if (!context) {
    throw new Error('useOuting must be used within OutingProvider');
  }
  return context;
}
