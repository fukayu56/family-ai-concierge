import { type Href, router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { formatMemberLikesDisplay, useFamily } from '@/contexts/family-context';

export default function FamilyTabScreen() {
  const { familyProfiles } = useFamily();

  const content = (
    <>
      <ThemedText type="title" style={styles.title}>
        家族図鑑
      </ThemedText>

      <ThemedText style={styles.subtitle}>
        AIが理解している家族の情報
      </ThemedText>

      {familyProfiles.map((member) => (
        <Pressable
          key={member.id}
          onPress={() =>
            router.push({
              pathname: '/profile-edit',
              params: { id: member.id },
            } as unknown as Href)
          }
        >
          <ThemedView style={styles.card}>
            <ThemedText style={styles.sectionTitle}>{member.name}</ThemedText>
            <ThemedText>
              年齢：{member.age ? `${member.age}歳` : '未設定'}
            </ThemedText>
            <ThemedText>
              好きなこと：{formatMemberLikesDisplay(member)}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: '/profile-edit',
            params: { id: 'new' },
          } as unknown as Href)
        }
      >
        <ThemedText style={styles.buttonText}>＋ 家族を追加</ThemedText>
      </Pressable>
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
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: BottomTabInset + 40,
    gap: 20,
    alignItems: 'center',
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
});
