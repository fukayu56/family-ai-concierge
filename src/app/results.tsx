import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECOMMENDATIONS_URL } from '@/constants/api';
import { MaxContentWidth } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useOuting, WEATHER_LABELS } from '@/contexts/outing-context';
import {
  parseRecommendationResponse,
  type Plan,
  type RelaxedPlanEntry,
  type RelaxedScenarioId,
} from '@/utils/validate-recommendation-response';

const SCENARIO_UI: Record<
  RelaxedScenarioId,
  { title: string; accent: string; badge: string }
> = {
  budget_relaxed: {
    title: '予算を少し広げたプラン',
    accent: '#b45309',
    badge: '予算ゆとり',
  },
  time_relaxed: {
    title: '時間を少し広げたプラン',
    accent: '#0f766e',
    badge: '時間ゆとり',
  },
};

function formatConditionMap(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ');
}

function userFacingError(err: unknown): string {
  if (!(err instanceof Error)) {
    return '通信に失敗しました。ネットワークを確認して再試行してください。';
  }

  const message = err.message;

  if (
    err.name === 'TypeError' ||
    /Failed to fetch|Network request failed|fetch/i.test(message)
  ) {
    return 'サーバーに接続できません。APIが起動しているか、実機では EXPO_PUBLIC_API_BASE_URL を確認してください。';
  }

  if (message.includes('参加者を1人以上')) {
    return message;
  }

  if (message.includes('AIの返却形式が不正')) {
    return 'AIの返却形式が不正です。もう一度提案を試してください。';
  }

  if (
    message.includes('プランの取得に失敗') ||
    message.includes('OpenAI') ||
    message.includes('API error: 5')
  ) {
    return 'プランの取得に失敗しました。しばらくしてから再試行してください。';
  }

  if (message.includes('おでかけ条件の形式が不正') || message.includes('API error: 4')) {
    return 'おでかけ条件の形式を確認してから、もう一度お試しください。';
  }

  // Prefer short server error strings; never show stacks.
  if (message.length > 0 && message.length < 120 && !message.includes('\n')) {
    return message;
  }

  return 'プランの取得に失敗しました。条件を確認して再試行してください。';
}

function PlanTimeline({ plan }: { plan: Plan }) {
  return (
    <View style={styles.timeline}>
      {(plan.timeline ?? []).map((item, index) => {
        const timeline = plan.timeline ?? [];
        return (
          <View key={`${plan.id}-${index}`} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <ThemedText style={styles.timelineTime}>{item.time}</ThemedText>
              {index < timeline.length - 1 ? (
                <View style={styles.timelineLine} />
              ) : null}
            </View>
            <View style={styles.timelineRight}>
              <ThemedText style={styles.timelineTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.timelineDescription}>
                {item.description}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StrictPlanCard({ plan }: { plan: Plan }) {
  return (
    <ThemedView style={styles.planCard}>
      <ThemedText style={styles.sectionTitle}>{plan.title}</ThemedText>
      <ThemedText style={styles.bodyText}>おすすめ理由：{plan.reason}</ThemedText>
      <ThemedText>概算費用：{plan.cost}</ThemedText>
      <ThemedText>スポット：{plan.spots}</ThemedText>

      <View style={styles.summaryBox}>
        <ThemedText>現地で楽しめる時間：{plan.localEnjoymentTime}</ThemedText>
        <ThemedText>往復移動：{plan.roundTripTime}</ThemedText>
        <ThemedText>予算内：{plan.withinBudget ? 'はい' : 'いいえ'}</ThemedText>
      </View>

      <ThemedText style={styles.timelineHeading}>1日のタイムライン</ThemedText>
      <PlanTimeline plan={plan} />
    </ThemedView>
  );
}

function RelaxedPlanCard({ entry }: { entry: RelaxedPlanEntry }) {
  const ui = SCENARIO_UI[entry.scenarioId];
  const hint = entry.relaxationHint;
  const plan = entry.plan;

  return (
    <ThemedView style={[styles.planCard, styles.relaxedCard]}>
      <View style={[styles.badge, { backgroundColor: ui.accent }]}>
        <ThemedText style={styles.badgeText}>{ui.badge}</ThemedText>
      </View>
      <ThemedText style={styles.relaxedSectionTitle}>{ui.title}</ThemedText>
      <ThemedText style={styles.sectionTitle}>{plan.title}</ThemedText>

      <View style={styles.hintBox}>
        <ThemedText style={styles.hintLabel}>条件の広げ方</ThemedText>
        <ThemedText style={styles.bodyText}>{hint.label}</ThemedText>
        <ThemedText style={styles.metaText}>
          元の条件：{formatConditionMap(hint.before)}
        </ThemedText>
        <ThemedText style={styles.metaText}>
          緩和後：{formatConditionMap(hint.after)}
        </ThemedText>
      </View>

      <ThemedText style={styles.bodyText}>おすすめ理由：{plan.reason}</ThemedText>
      <ThemedText>概算費用：{plan.cost}</ThemedText>
      <ThemedText>スポット：{plan.spots}</ThemedText>

      <View style={styles.summaryBox}>
        <ThemedText>現地で楽しめる時間：{plan.localEnjoymentTime}</ThemedText>
        <ThemedText>往復移動：{plan.roundTripTime}</ThemedText>
        <ThemedText>予算内：{plan.withinBudget ? 'はい' : 'いいえ'}</ThemedText>
      </View>

      <ThemedText style={styles.timelineHeading}>1日のタイムライン</ThemedText>
      <PlanTimeline plan={plan} />
    </ThemedView>
  );
}

export default function ResultsScreen() {
  const {
    startTime,
    endTime,
    departurePlace,
    budget,
    transport,
    specialRequests,
    weather,
  } = useOuting();
  const { familyProfiles, selectedMemberIds } = useFamily();

  const selectedMembers = familyProfiles.filter((member) =>
    selectedMemberIds.includes(member.id)
  );
  const participantNames =
    selectedMembers.map((member) => member.name).join('、') || '未選択';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [relaxedPlans, setRelaxedPlans] = useState<RelaxedPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchPlans = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setPlans([]);
    setRelaxedPlans([]);

    if (selectedMemberIds.length === 0) {
      setError('参加者を1人以上選んでから、もう一度お試しください。');
      setLoading(false);
      inFlightRef.current = false;
      return;
    }

    const participants = familyProfiles.filter((member) =>
      selectedMemberIds.includes(member.id)
    );

    try {
      const body: Record<string, unknown> = {
        conditions: {
          startTime,
          endTime,
          departurePlace,
          budget,
          transport,
          specialRequests,
        },
        participants,
      };
      // 指定なし: omit weather so ScenarioFilter skips rain scoring.
      if (weather.trim() !== '') {
        body.weather = weather;
      }

      const response = await fetch(RECOMMENDATIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? 'AIの返却形式が不正です'
            : `API error: ${response.status}`
        );
      }

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

      const parsed = parseRecommendationResponse(data);
      setPlans(parsed.plans);
      setRelaxedPlans(parsed.relaxedPlans ?? []);
    } catch (err) {
      setError(userFacingError(err));
      setPlans([]);
      setRelaxedPlans([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [
    startTime,
    endTime,
    departurePlace,
    budget,
    transport,
    specialRequests,
    weather,
    familyProfiles,
    selectedMemberIds,
  ]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const budgetRelaxed = relaxedPlans.filter(
    (entry) => entry.scenarioId === 'budget_relaxed'
  );
  const timeRelaxed = relaxedPlans.filter(
    (entry) => entry.scenarioId === 'time_relaxed'
  );

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
              <ThemedText>天気：{WEATHER_LABELS[weather]}</ThemedText>
              <ThemedText>参加者：{participantNames}</ThemedText>
              {specialRequests.trim() ? (
                <ThemedText>要望：{specialRequests}</ThemedText>
              ) : null}
            </ThemedView>

            {loading ? (
              <ThemedView style={styles.card}>
                <ThemedText>AIがプランを考えています...</ThemedText>
                <ThemedText style={styles.metaText}>
                  条件どおりの案と、条件を少し広げた案を作成中です。1〜2分かかることがあります。
                </ThemedText>
              </ThemedView>
            ) : null}

            {error ? (
              <ThemedView style={styles.card}>
                <ThemedText>取得に失敗しました：{error}</ThemedText>
                <ThemedText>
                  ホームで参加者と条件を確認してから、再試行してください。
                </ThemedText>
                <Pressable
                  style={[styles.button, loading ? styles.buttonDisabled : null]}
                  disabled={loading}
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

            {!loading && !error ? (
              <>
                <ThemedText style={styles.blockHeading}>おすすめプラン</ThemedText>
                <ThemedText style={styles.metaText}>
                  入力した条件を守った案です（厳守）
                </ThemedText>
                {plans.map((plan) => (
                  <StrictPlanCard key={plan.id} plan={plan} />
                ))}

                {relaxedPlans.length > 0 ? (
                  <>
                    <ThemedText style={styles.blockHeading}>
                      条件を少し広げると
                    </ThemedText>
                    <ThemedText style={styles.metaText}>
                      条件違反ではなく、少し条件を広げたときの選択肢です
                    </ThemedText>
                    {budgetRelaxed.map((entry) => (
                      <RelaxedPlanCard
                        key={`budget-${entry.plan.id}`}
                        entry={entry}
                      />
                    ))}
                    {timeRelaxed.map((entry) => (
                      <RelaxedPlanCard
                        key={`time-${entry.plan.id}`}
                        entry={entry}
                      />
                    ))}
                  </>
                ) : null}

                <Pressable
                  style={[styles.button, loading ? styles.buttonDisabled : null]}
                  disabled={loading}
                  onPress={() => void fetchPlans()}
                >
                  <ThemedText style={styles.buttonText}>もう一度提案</ThemedText>
                </Pressable>
              </>
            ) : null}

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/conditions')}
            >
              <ThemedText style={styles.secondaryButtonText}>
                条件を変更する
              </ThemedText>
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
  blockHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
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
  relaxedCard: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafaf9',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  relaxedSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  hintBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  hintLabel: {
    fontSize: 14,
    fontWeight: 'bold',
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
  button: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
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
