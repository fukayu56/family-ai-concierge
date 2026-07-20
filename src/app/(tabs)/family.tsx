import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';

/**
 * Phase A placeholder. Family profile list moves here in Phase B.
 */
export default function FamilyTabScreen() {
  const content = (
    <>
      <ThemedText type="title" style={styles.title}>
        家族
      </ThemedText>
      <ThemedText style={styles.body}>
        家族プロフィールの登録・編集画面は次のステップでこのタブへ移します。
      </ThemedText>
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: BottomTabInset + 40,
    gap: 16,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 480,
  },
});
