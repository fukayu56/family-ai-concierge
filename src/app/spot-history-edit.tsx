import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFamily } from '@/contexts/family-context';
import { useHistory } from '@/contexts/history-context';
import type { MemberSpotRating } from '@/types/spot-history';

function todayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SpotHistoryEditScreen() {
  const params = useLocalSearchParams<{
    spotId?: string;
    spotName?: string;
    historyId?: string;
  }>();
  const spotId =
    typeof params.spotId === 'string'
      ? params.spotId
      : Array.isArray(params.spotId)
        ? params.spotId[0]
        : '';
  const spotName =
    typeof params.spotName === 'string'
      ? params.spotName
      : Array.isArray(params.spotName)
        ? params.spotName[0]
        : '';
  const historyId =
    typeof params.historyId === 'string'
      ? params.historyId
      : Array.isArray(params.historyId)
        ? params.historyId[0]
        : '';

  const { familyProfiles, selectedMemberIds } = useFamily();
  const { spotHistories, addSpotHistory, updateSpotHistory } = useHistory();

  const existing = useMemo(
    () => spotHistories.find((entry) => entry.id === historyId),
    [spotHistories, historyId]
  );

  const [visitedOn, setVisitedOn] = useState(
    existing?.visitedOn ?? todayYmd()
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    existing?.participantIds ??
      (selectedMemberIds.length > 0
        ? selectedMemberIds
        : familyProfiles.map((member) => member.id))
  );
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const row of existing?.memberRatings ?? []) {
      initial[row.memberId] = row.rating;
    }
    return initial;
  });
  const [note, setNote] = useState(existing?.note ?? '');
  const [wantAgain, setWantAgain] = useState(existing?.wantAgain ?? false);

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) => {
      if (current.includes(memberId)) {
        const next = current.filter((id) => id !== memberId);
        setRatings((prev) => {
          const copy = { ...prev };
          delete copy[memberId];
          return copy;
        });
        return next;
      }
      return [...current, memberId];
    });
  }

  function setMemberRating(memberId: string, rating: number) {
    setRatings((current) => ({ ...current, [memberId]: rating }));
  }

  function handleSave() {
    if (!spotId) {
      const message = 'スポットが指定されていません';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('確認', message);
      }
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedOn.trim())) {
      const message = '訪問日は YYYY-MM-DD 形式で入力してください';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('確認', message);
      }
      return;
    }
    if (participantIds.length === 0) {
      const message = '参加者を1人以上選んでください';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('確認', message);
      }
      return;
    }

    const memberRatings: MemberSpotRating[] = [];
    for (const memberId of participantIds) {
      const rating = ratings[memberId];
      if (rating == null || rating < 1 || rating > 5) {
        const name =
          familyProfiles.find((member) => member.id === memberId)?.name ??
          memberId;
        const message = `${name}の評価（1〜5）を選んでください`;
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('確認', message);
        }
        return;
      }
      memberRatings.push({
        memberId,
        rating: rating as 1 | 2 | 3 | 4 | 5,
      });
    }

    const payload = {
      spotId,
      spotDisplayName: spotName || existing?.spotDisplayName,
      visitedOn: visitedOn.trim(),
      participantIds,
      memberRatings,
      note: note.trim() || undefined,
      wantAgain,
    };

    if (existing) {
      updateSpotHistory(existing.id, payload);
    } else {
      addSpotHistory(payload);
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/destinations' as Href);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText type="title" style={styles.title}>
            {existing ? '訪問記録を編集' : '訪問を記録'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {spotName || existing?.spotDisplayName || spotId}
          </ThemedText>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.label}>訪問日 (YYYY-MM-DD)</ThemedText>
            <TextInput
              style={styles.input}
              value={visitedOn}
              onChangeText={setVisitedOn}
              placeholder="2026-07-20"
            />

            <ThemedText style={styles.label}>参加者</ThemedText>
            {familyProfiles.map((member) => {
              const selected = participantIds.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                >
                  <ThemedText>
                    {selected ? '☑' : '☐'} {member.name}
                  </ThemedText>
                </Pressable>
              );
            })}

            <ThemedText style={styles.label}>参加者ごとの評価</ThemedText>
            {participantIds.map((memberId) => {
              const member = familyProfiles.find((row) => row.id === memberId);
              const current = ratings[memberId];
              return (
                <View key={memberId} style={styles.ratingBlock}>
                  <ThemedText style={styles.ratingName}>
                    {member?.name ?? memberId}
                  </ThemedText>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => {
                      const selected = current === value;
                      return (
                        <Pressable
                          key={value}
                          style={[
                            styles.ratingChip,
                            selected ? styles.ratingChipSelected : null,
                          ]}
                          onPress={() => setMemberRating(memberId, value)}
                        >
                          <ThemedText
                            style={
                              selected
                                ? styles.ratingChipTextSelected
                                : styles.ratingChipText
                            }
                          >
                            {value}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <ThemedText style={styles.label}>メモ（任意）</ThemedText>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={note}
              onChangeText={setNote}
              placeholder="感想など"
              multiline
            />

            <Pressable onPress={() => setWantAgain((value) => !value)}>
              <ThemedText>
                {wantAgain ? '☑' : '☐'} また行きたい
              </ThemedText>
            </Pressable>
          </ThemedView>

          <Pressable style={styles.button} onPress={handleSave}>
            <ThemedText style={styles.buttonText}>保存する</ThemedText>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/destinations' as Href);
              }
            }}
          >
            <ThemedText style={styles.secondaryButtonText}>キャンセル</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  scrollContent: {
    width: '100%',
    paddingBottom: 40,
    gap: 20,
    alignItems: 'center',
  },
  title: { textAlign: 'center' },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    fontSize: 16,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  ratingBlock: { gap: 6 },
  ratingName: { fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ratingChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  ratingChipText: { fontWeight: '700', color: '#374151' },
  ratingChipTextSelected: { fontWeight: '700', color: '#ffffff' },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2563eb',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
