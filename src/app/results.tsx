import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECOMMENDATIONS_URL } from '@/constants/api';
import { MaxContentWidth } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useOuting } from '@/contexts/outing-context';
import {
  type Plan,
  validateRecommendationResponse,
} from '@/utils/validate-recommendation-response';

export default function ResultsScreen() {
  const {
    startTime,
    endTime,
    departurePlace,
    budget,
    transport,
    specialRequests,
  } = useOuting();
  const { familyProfiles, selectedMemberIds } = useFamily();

  const selectedMembers = familyProfiles.filter((member) =>
    selectedMemberIds.includes(member.id)
  );
  const participantNames =
    selectedMembers.map((member) => member.name).join('、') || '未選択';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlans([]);

    if (selectedMemberIds.length === 0) {
      setError('参加者を1人以上選んでから、もう一度お試しください。');
      setLoading(false);
      return;
    }

    const participants = familyProfiles.filter((member) =>
      selectedMemberIds.includes(member.id)
    );

    try {
      const response = await fetch(RECOMMENDATIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conditions: {
            startTime,
            endTime,
            departurePlace,
            budget,
            transport,
            specialRequests,
          },
          participants,
        }),
      });

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

      validateRecommendationResponse(data);
      setPlans(data.plans);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '通信に失敗しました。ネットワークを確認して再試行してください。';
      setError(message);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [
    startTime,
    endTime,
    departurePlace,
    budget,
    transport,
    specialRequests,
    familyProfiles,
    selectedMemberIds,
  ]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              AIのおすすめプラン
            </ThemedText>

            <ThemedView style={styles.card}>
              <ThemedText style={styles.sectionTitle}>今日の条件</ThemedText>
              <ThemedText>
                {startTime}〜{endTime}
              </ThemedText>
              <ThemedText>出発：{departurePlace}</ThemedText>
              <ThemedText>予算：{budget}円</ThemedText>
              <ThemedText>移動手段：{transport}</ThemedText>
              <ThemedText>参加者：{participantNames}</ThemedText>
              {specialRequests.trim() ? (
                <ThemedText>要望：{specialRequests}</ThemedText>
              ) : null}
            </ThemedView>

            {loading ? (
              <ThemedView style={styles.card}>
                <ThemedText>AIがプランを考えています...</ThemedText>
              </ThemedView>
            ) : null}

            {error ? (
              <ThemedView style={styles.card}>
                <ThemedText>取得に失敗しました：{error}</ThemedText>
                <ThemedText>
                  ホームで参加者と条件を確認してから、再試行してください。
                </ThemedText>
                <Pressable
                  style={styles.button}
                  onPress={() => void fetchPlans()}
                >
                  <ThemedText style={styles.buttonText}>再試行</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => router.replace('/')}
                >
                  <ThemedText style={styles.secondaryButtonText}>
                    ホームに戻る
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : null}

            {!loading && !error
              ? plans.map((plan) => (
                  <ThemedView key={plan.id} style={styles.planCard}>
                    <ThemedText style={styles.sectionTitle}>
                      {plan.title}
                    </ThemedText>
                    <ThemedText>おすすめ理由：{plan.reason}</ThemedText>
                    <ThemedText>概算費用：{plan.cost}</ThemedText>
                    <ThemedText>スポット：{plan.spots}</ThemedText>

                    <View style={styles.summaryBox}>
                      <ThemedText>
                        現地で楽しめる時間：{plan.localEnjoymentTime}
                      </ThemedText>
                      <ThemedText>往復移動：{plan.roundTripTime}</ThemedText>
                      <ThemedText>
                        予算内：{plan.withinBudget ? 'はい' : 'いいえ'}
                      </ThemedText>
                    </View>

                    <ThemedText style={styles.timelineHeading}>
                      1日のタイムライン
                    </ThemedText>

                    <View style={styles.timeline}>
                      {(plan.timeline ?? []).map((item, index) => {
                        const timeline = plan.timeline ?? [];
                        return (
                          <View
                            key={`${plan.id}-${index}`}
                            style={styles.timelineRow}
                          >
                            <View style={styles.timelineLeft}>
                              <ThemedText style={styles.timelineTime}>
                                {item.time}
                              </ThemedText>
                              {index < timeline.length - 1 ? (
                                <View style={styles.timelineLine} />
                              ) : null}
                            </View>
                            <View style={styles.timelineRight}>
                              <ThemedText style={styles.timelineTitle}>
                                {item.title}
                              </ThemedText>
                              <ThemedText style={styles.timelineDescription}>
                                {item.description}
                              </ThemedText>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <Pressable style={styles.planButton} onPress={() => {}}>
                      <ThemedText style={styles.buttonText}>
                        このプランを見る
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))
              : null}

            <Pressable
              style={styles.button}
              onPress={() => router.push('/conditions')}
            >
              <ThemedText style={styles.buttonText}>条件を変更する</ThemedText>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
            >
              <ThemedText style={styles.secondaryButtonText}>
                ホームに戻る
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: 24,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    gap: 8,
  },
  planCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryBox: {
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  timelineHeading: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
  },
  timelineLeft: {
    width: 88,
    alignItems: 'center',
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 6,
    marginBottom: 2,
    backgroundColor: '#cbd5e1',
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 16,
    gap: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  timelineDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  planButton: {
    marginTop: 4,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 24,
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
