import { type Href, router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useOuting, WEATHER_LABELS } from '@/contexts/outing-context';

export default function HomeScreen() {
  const { startTime, endTime, budget, weather } = useOuting();
  const {
    familyProfiles,
    selectedMemberIds,
    toggleMember,
  } = useFamily();

  const selectedMembers = familyProfiles.filter((member) =>
    selectedMemberIds.includes(member.id)
  );

  function handleCreatePlan() {
    if (selectedMemberIds.length === 0) {
      const message = '参加者を1人以上選んでください';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('確認', message);
      }
      return;
    }
    router.push('/results' as Href);
  }

  const content = (
    <>
      <ThemedText type="title" style={styles.title}>
        Family AI Concierge
      </ThemedText>

      <ThemedText style={styles.subtitle}>
        家族にぴったりの一日を、AIと一緒に考えます。
      </ThemedText>

      <Pressable onPress={() => router.push('/conditions')}>
        <ThemedView style={styles.card}>
            <ThemedText style={styles.sectionTitle}>おでかけ条件</ThemedText>
          <ThemedText>出発：{startTime}</ThemedText>
          <ThemedText>帰着：{endTime}</ThemedText>
          <ThemedText>予算：{budget}円</ThemedText>
          <ThemedText>天気：{WEATHER_LABELS[weather]}</ThemedText>
            <ThemedText style={styles.editHint}>おでかけ条件を編集 →</ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView style={styles.card}>
          <ThemedText style={styles.sectionTitle}>おでかけする人</ThemedText>
        {familyProfiles.map((member) => (
          <Pressable
            key={member.id}
            onPress={() => toggleMember(member.id)}
          >
            <ThemedText>
              {selectedMemberIds.includes(member.id) ? '☑' : '☐'} {member.name}
              {member.age ? ` ${member.age}歳` : ''}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedView style={styles.card}>
          <ThemedText style={styles.sectionTitle}>参加者</ThemedText>
        <ThemedText>
          {selectedMembers.map((member) => member.name).join('、')}
        </ThemedText>
      </ThemedView>

      <Pressable style={styles.button} onPress={handleCreatePlan}>
        <ThemedText style={styles.buttonText}>AIにプランを作ってもらう</ThemedText>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push('/family' as Href)}
      >
        <ThemedText style={styles.secondaryButtonText}>
          家族プロフィールを編集
        </ThemedText>
      </Pressable>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      {Platform.OS === 'web' ? (
        <ScrollView
          style={styles.webScroll}
          contentContainerStyle={styles.webScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webScroll: {
    flex: 1,
    width: '100%',
  },
  webScrollContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
    paddingBottom: BottomTabInset + 48,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: BottomTabInset + 32,
    gap: 20,
  },
  title: {
    textAlign: 'center',
  },
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
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  editHint: {
    marginTop: 8,
    fontSize: 14,
    color: '#2563eb',
    fontWeight: 'bold',
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
