import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { buildSpotsUrl } from '@/constants/api';
import { AICHI_CITIES, DEFAULT_PREFECTURE } from '@/constants/regions';
import { BottomTabInset } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useHistory } from '@/contexts/history-context';
import type { SpotListItem, SpotsListResponse } from '@/types/spot-list';
import {
  averageMemberRatings,
  latestVisitForSpot,
  visitCountForSpot,
} from '@/types/spot-history';
import { sortSpotsByName } from '@/utils/spot-list-filter';

export default function DestinationsScreen() {
  const [prefecture] = useState(DEFAULT_PREFECTURE);
  const [city, setCity] = useState<string>('');
  const [spots, setSpots] = useState<SpotListItem[]>([]);
  const [citiesFromApi, setCitiesFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { spotHistories } = useHistory();
  const { familyProfiles } = useFamily();

  const cityOptions =
    citiesFromApi.length > 0 ? citiesFromApi : [...AICHI_CITIES];

  const loadSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildSpotsUrl({
        prefecture,
        city: city || undefined,
      });
      const response = await fetch(url);
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : `API error: ${response.status}`;
        throw new Error(message);
      }
      const body = data as SpotsListResponse;
      if (!Array.isArray(body.spots)) {
        throw new Error('スポット一覧の形式が不正です');
      }
      setSpots(sortSpotsByName(body.spots));
      if (Array.isArray(body.meta?.cities) && body.meta.cities.length > 0) {
        setCitiesFromApi(body.meta.cities);
      }
    } catch (err) {
      const message =
        err instanceof Error &&
        (err.name === 'TypeError' ||
          /Failed to fetch|Network/i.test(err.message))
          ? 'サーバーに接続できません。APIが起動しているか確認してください。'
          : err instanceof Error
            ? err.message
            : 'スポット一覧の取得に失敗しました';
      setError(message);
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, [prefecture, city]);

  useEffect(() => {
    void loadSpots();
  }, [loadSpots]);

  function openHistoryEditor(spot: SpotListItem) {
    router.push({
      pathname: '/spot-history-edit',
      params: { spotId: spot.id, spotName: spot.name },
    } as unknown as Href);
  }

  const content = (
    <>
      <ThemedText type="title" style={styles.title}>
        行先リスト
      </ThemedText>

      <ThemedView style={styles.filterCard}>
        <ThemedText style={styles.filterLabel}>都道府県</ThemedText>
        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipSelected]}>
            <ThemedText style={styles.chipTextSelected}>{prefecture}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.filterLabel}>市区町村</ThemedText>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, city === '' ? styles.chipSelected : null]}
            onPress={() => setCity('')}
          >
            <ThemedText
              style={city === '' ? styles.chipTextSelected : styles.chipText}
            >
              すべて
            </ThemedText>
          </Pressable>
          {cityOptions.map((option) => {
            const selected = city === option;
            return (
              <Pressable
                key={option}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => setCity(option)}
              >
                <ThemedText
                  style={selected ? styles.chipTextSelected : styles.chipText}
                >
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ThemedView>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator />
          <ThemedText style={styles.meta}>読み込み中...</ThemedText>
        </View>
      ) : null}

      {error ? (
        <ThemedView style={styles.filterCard}>
          <ThemedText>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={() => void loadSpots()}>
            <ThemedText style={styles.retryButtonText}>再試行</ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      {!loading && !error ? (
        <ThemedText style={styles.meta}>
          {spots.length}件
          {city ? `（${city}）` : '（全市）'}
        </ThemedText>
      ) : null}

      {!loading && !error
        ? spots.map((spot) => {
            const count = visitCountForSpot(spotHistories, spot.id);
            const latest = latestVisitForSpot(spotHistories, spot.id);
            const familyAvg = latest
              ? averageMemberRatings(latest.memberRatings)
              : null;
            const memberLines =
              latest?.memberRatings.map((row) => {
                const name =
                  familyProfiles.find((member) => member.id === row.memberId)
                    ?.name ?? row.memberId;
                return `${name}:${row.rating}`;
              }) ?? [];

            return (
              <Pressable key={spot.id} onPress={() => openHistoryEditor(spot)}>
                <ThemedView style={styles.spotCard}>
                  <ThemedText style={styles.spotName}>{spot.name}</ThemedText>
                  <ThemedText style={styles.spotMeta}>
                    {[spot.city, spot.category].filter(Boolean).join(' · ')}
                  </ThemedText>
                  {spot.address ? (
                    <ThemedText style={styles.spotAddress}>
                      {spot.address}
                    </ThemedText>
                  ) : null}
                  {count > 0 && latest ? (
                    <>
                      <ThemedText style={styles.visitInfo}>
                        訪問{count}回 · 直近 {latest.visitedOn}
                        {familyAvg != null ? ` · 平均 ${familyAvg}` : ''}
                      </ThemedText>
                      {memberLines.length > 0 ? (
                        <ThemedText style={styles.visitInfo}>
                          評価：{memberLines.join(' / ')}
                        </ThemedText>
                      ) : null}
                    </>
                  ) : (
                    <ThemedText style={styles.visitHint}>
                      タップして訪問・評価を記録
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            );
          })
        : null}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      {Platform.OS === 'web' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        </SafeAreaView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, width: '100%' },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: BottomTabInset + 40,
    gap: 12,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  title: { textAlign: 'center', marginBottom: 8 },
  filterCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    gap: 8,
  },
  filterLabel: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  chipSelected: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextSelected: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  centerBlock: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  meta: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  spotCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  spotName: { fontSize: 17, fontWeight: 'bold' },
  spotMeta: { fontSize: 14, color: '#4b5563' },
  spotAddress: { fontSize: 13, color: '#6b7280' },
  visitInfo: { marginTop: 4, fontSize: 13, color: '#2563eb' },
  visitHint: { marginTop: 6, fontSize: 12, color: '#9ca3af' },
  retryButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  retryButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});
