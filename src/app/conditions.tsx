import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFamily } from '@/contexts/family-context';
import {
  useOuting,
  WEATHER_LABELS,
  WEATHER_OPTIONS,
  type WeatherOption,
} from '@/contexts/outing-context';

export default function ConditionsScreen() {
  const {
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
  } = useOuting();
  const { selectedMemberIds } = useFamily();

  function handleRequestPlans() {
    if (selectedMemberIds.length === 0) {
      const message = '参加者を1人以上選んでください';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('確認', message);
      }
      return;
    }
    router.push('/results');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
      <ScrollView
    contentContainerStyle={styles.scrollContent}
    keyboardShouldPersistTaps="handled"
  >
        <ThemedText type="title" style={styles.title}>
          今日のおでかけ条件
        </ThemedText>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.label}>出発時間</ThemedText>
          <TextInput
            style={styles.input}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="10:00"
          />

          <ThemedText style={styles.label}>帰着時間</ThemedText>
          <TextInput
            style={styles.input}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="16:00"
          />

          <ThemedText style={styles.label}>出発場所</ThemedText>
          <TextInput
            style={styles.input}
            value={departurePlace}
            onChangeText={setDeparturePlace}
            placeholder="自宅"
          />

          <ThemedText style={styles.label}>予算</ThemedText>
          <TextInput
            style={styles.input}
            value={budget}
            onChangeText={setBudget}
            placeholder="15000"
            keyboardType="numeric"
          />

          <ThemedText style={styles.label}>移動手段</ThemedText>
          <TextInput
            style={styles.input}
            value={transport}
            onChangeText={setTransport}
            placeholder="車"
          />

          <ThemedText style={styles.label}>天気</ThemedText>
          <ThemedText style={styles.hint}>
            雨を選ぶと屋内寄りの候補が優先されます（API未接続・手入力）
          </ThemedText>
          <View style={styles.chipRow}>
            {WEATHER_OPTIONS.map((option) => {
              const selected = weather === option;
              return (
                <Pressable
                  key={option === '' ? 'none' : option}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                  onPress={() => setWeather(option as WeatherOption)}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      selected ? styles.chipTextSelected : null,
                    ]}
                  >
                    {WEATHER_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.label}>特別な要望</ThemedText>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={specialRequests}
            onChangeText={setSpecialRequests}
            placeholder="例：ベビーカー、昼寝の時間を確保したい"
            multiline
          />
        </ThemedView>

        <Pressable
          style={styles.button}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <ThemedText style={styles.buttonText}>
            保存してホームに戻る
          </ThemedText>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleRequestPlans}>
          <ThemedText style={styles.secondaryButtonText}>
            AIに提案してもらう
          </ThemedText>
        </Pressable>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
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
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  chipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#ffffff',
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
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  scrollContent: {
    width: '100%',
    paddingBottom: 40,
    gap: 20,
  },
});
