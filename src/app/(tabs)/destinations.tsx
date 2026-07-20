import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';

/**
 * Phase A placeholder. Spot list UI arrives in Phase D.
 */
export default function DestinationsScreen() {
  const content = (
    <>
      <ThemedText type="title" style={styles.title}>
        行先リスト
      </ThemedText>
      <ThemedText style={styles.body}>
        スポット一覧は次のステップで追加します。都道府県・市区町村での絞り込み、訪問評価の表示に対応予定です。
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
