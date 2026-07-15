import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export type FamilyMember = {
  id: string;
  name: string;
  age: number | null;
  likes: string;
  gender: string;
  favoriteFoods: string;
  dislikedFoods: string;
  allergies: string;
  favoritePlay: string;
  dislikedPlay: string;
  interests: string;
  canTolerate: string;
  cannotTolerate: string;
};

export type FamilyMemberInput = Omit<FamilyMember, 'id'>;

type FamilyContextValue = {
  familyProfiles: FamilyMember[];
  setFamilyProfiles: Dispatch<SetStateAction<FamilyMember[]>>;
  updateFamilyMember: (id: string, data: FamilyMemberInput) => void;
  addFamilyMember: (data: FamilyMemberInput) => void;
  selectedMemberIds: string[];
  setSelectedMemberIds: Dispatch<SetStateAction<string[]>>;
  toggleMember: (memberId: string) => void;
  isHydrated: boolean;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

const STORAGE_KEYS = {
  familyProfiles: 'family-ai-concierge:familyProfiles',
  selectedMemberIds: 'family-ai-concierge:selectedMemberIds',
} as const;

const emptyExtraFields = {
  gender: '',
  favoriteFoods: '',
  dislikedFoods: '',
  allergies: '',
  favoritePlay: '',
  dislikedPlay: '',
  interests: '',
  canTolerate: '',
  cannotTolerate: '',
};

const initialFamilyProfiles: FamilyMember[] = [
  {
    id: 'dad',
    name: 'パパ',
    age: null,
    likes: '運転2時間まで・コスパ重視',
    gender: '男性',
    favoriteFoods: '',
    dislikedFoods: '',
    allergies: '',
    favoritePlay: '',
    dislikedPlay: '',
    interests: 'コスパ重視',
    canTolerate: '運転2時間まで',
    cannotTolerate: '',
  },
  {
    id: 'mom',
    name: 'ママ',
    age: null,
    likes: 'カフェ・写真スポット',
    gender: '女性',
    favoriteFoods: '',
    dislikedFoods: '',
    allergies: '',
    favoritePlay: '',
    dislikedPlay: '',
    interests: 'カフェ、写真スポット',
    canTolerate: '',
    cannotTolerate: '',
  },
  {
    id: 'son1',
    name: '長男',
    age: 7,
    likes: '工作・恐竜・体験型施設',
    gender: '男性',
    favoriteFoods: '',
    dislikedFoods: '',
    allergies: '',
    favoritePlay: '工作、恐竜',
    dislikedPlay: '',
    interests: '体験型施設',
    canTolerate: '',
    cannotTolerate: '',
  },
  {
    id: 'son2',
    name: '次男',
    age: 4,
    likes: '動物・電車・短時間で楽しめる遊び',
    gender: '男性',
    favoriteFoods: '',
    dislikedFoods: '',
    allergies: '',
    favoritePlay: '動物、電車、短時間で楽しめる遊び',
    dislikedPlay: '',
    interests: '',
    canTolerate: '',
    cannotTolerate: '',
  },
];

const initialSelectedMemberIds = ['dad', 'mom', 'son1', 'son2'];

function isFamilyMember(value: unknown): value is FamilyMember {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const member = value as Record<string, unknown>;
  return (
    typeof member.id === 'string' &&
    typeof member.name === 'string' &&
    (typeof member.age === 'number' || member.age === null) &&
    typeof member.likes === 'string'
  );
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [familyProfiles, setFamilyProfiles] = useState(initialFamilyProfiles);
  const [selectedMemberIds, setSelectedMemberIds] = useState(
    initialSelectedMemberIds
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [profilesJson, selectedJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.familyProfiles),
          AsyncStorage.getItem(STORAGE_KEYS.selectedMemberIds),
        ]);

        if (cancelled) {
          return;
        }

        if (profilesJson) {
          const parsed = JSON.parse(profilesJson) as unknown;
          if (Array.isArray(parsed) && parsed.every(isFamilyMember)) {
            setFamilyProfiles(parsed);
          }
        }

        if (selectedJson) {
          const parsed = JSON.parse(selectedJson) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((id) => typeof id === 'string')
          ) {
            setSelectedMemberIds(parsed);
          }
        }
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

  const persistFamilyData = useCallback(
    async (profiles: FamilyMember[], selectedIds: string[]) => {
      try {
        await Promise.all([
          AsyncStorage.setItem(
            STORAGE_KEYS.familyProfiles,
            JSON.stringify(profiles)
          ),
          AsyncStorage.setItem(
            STORAGE_KEYS.selectedMemberIds,
            JSON.stringify(selectedIds)
          ),
        ]);
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
    void persistFamilyData(familyProfiles, selectedMemberIds);
  }, [familyProfiles, selectedMemberIds, isHydrated, persistFamilyData]);

  function updateFamilyMember(id: string, data: FamilyMemberInput) {
    setFamilyProfiles((current) =>
      current.map((member) =>
        member.id === id ? { ...member, ...data, id } : member
      )
    );
  }

  function addFamilyMember(data: FamilyMemberInput) {
    const newMember: FamilyMember = {
      ...emptyExtraFields,
      ...data,
      id: `member-${Date.now()}`,
    };
    setFamilyProfiles((current) => [...current, newMember]);
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  }

  return (
    <FamilyContext.Provider
      value={{
        familyProfiles,
        setFamilyProfiles,
        updateFamilyMember,
        addFamilyMember,
        selectedMemberIds,
        setSelectedMemberIds,
        toggleMember,
        isHydrated,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }
  return context;
}
