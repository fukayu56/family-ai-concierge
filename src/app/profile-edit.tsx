import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  buildMemberLikes,
  useFamily,
  type FamilyMember,
  type FamilyMemberInput,
} from '@/contexts/family-context';

function getInitialForm(member: FamilyMember | undefined) {
  return {
    name: member?.name ?? '',
    age: member?.age != null ? String(member.age) : '',
    gender: member?.gender ?? '',
    favoriteFoods: member?.favoriteFoods ?? '',
    dislikedFoods: member?.dislikedFoods ?? '',
    allergies: member?.allergies ?? '',
    favoritePlay: member?.favoritePlay ?? '',
    dislikedPlay: member?.dislikedPlay ?? '',
    interests: member?.interests ?? '',
    canTolerate: member?.canTolerate ?? '',
    cannotTolerate: member?.cannotTolerate ?? '',
  };
}

export default function ProfileEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { familyProfiles, updateFamilyMember, addFamilyMember } = useFamily();

  const memberId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const isNew = memberId === 'new' || !memberId;
  const existingMember = isNew
    ? undefined
    : familyProfiles.find((member) => member.id === memberId);

  const [form, setForm] = useState(() => getInitialForm(existingMember));

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    const parsedAge = form.age.trim() === '' ? null : Number(form.age);
    const age =
      parsedAge !== null && Number.isFinite(parsedAge) ? parsedAge : null;

    const data: FamilyMemberInput = {
      name: form.name.trim() || '名前未設定',
      age,
      likes: buildMemberLikes(form.favoritePlay, form.interests),
      gender: form.gender,
      favoriteFoods: form.favoriteFoods,
      dislikedFoods: form.dislikedFoods,
      allergies: form.allergies,
      favoritePlay: form.favoritePlay,
      dislikedPlay: form.dislikedPlay,
      interests: form.interests,
      canTolerate: form.canTolerate,
      cannotTolerate: form.cannotTolerate,
    };

    if (isNew) {
      addFamilyMember(data);
    } else {
      updateFamilyMember(memberId, data);
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/family' as Href);
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
            {isNew ? '家族を追加' : '家族プロフィール編集'}
          </ThemedText>

          <ThemedView style={styles.card}>
            <Field
              label="名前"
              value={form.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="例：パパ"
            />
            <Field
              label="年齢"
              value={form.age}
              onChangeText={(value) => updateField('age', value)}
              placeholder="例：7"
              keyboardType="numeric"
            />
            <Field
              label="性別"
              value={form.gender}
              onChangeText={(value) => updateField('gender', value)}
              placeholder="例：男性"
            />
            <Field
              label="好きな食べ物"
              value={form.favoriteFoods}
              onChangeText={(value) => updateField('favoriteFoods', value)}
              placeholder="例：カレー、うどん"
              multiline
            />
            <Field
              label="嫌いな食べ物"
              value={form.dislikedFoods}
              onChangeText={(value) => updateField('dislikedFoods', value)}
              placeholder="例：ピーマン"
              multiline
            />
            <Field
              label="アレルギー"
              value={form.allergies}
              onChangeText={(value) => updateField('allergies', value)}
              placeholder="例：卵、乳"
              multiline
            />
            <Field
              label="好きな遊び"
              value={form.favoritePlay}
              onChangeText={(value) => updateField('favoritePlay', value)}
              placeholder="例：工作、恐竜"
              multiline
            />
            <Field
              label="嫌いな遊び"
              value={form.dislikedPlay}
              onChangeText={(value) => updateField('dislikedPlay', value)}
              placeholder="例：長い待ち時間"
              multiline
            />
            <Field
              label="今興味があるもの"
              value={form.interests}
              onChangeText={(value) => updateField('interests', value)}
              placeholder="例：電車、動物"
              multiline
            />
            <Field
              label="耐えられること"
              value={form.canTolerate}
              onChangeText={(value) => updateField('canTolerate', value)}
              placeholder="例：車で1時間"
              multiline
            />
            <Field
              label="耐えられないこと"
              value={form.cannotTolerate}
              onChangeText={(value) => updateField('cannotTolerate', value)}
              placeholder="例：長い行列"
              multiline
            />
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
                router.replace('/family' as Href);
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

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
}: FieldProps) {
  return (
    <>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    minHeight: 72,
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
});
