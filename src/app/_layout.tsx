import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { FamilyProvider } from '@/contexts/family-context';
import { HistoryProvider } from '@/contexts/history-context';
import { OutingProvider } from '@/contexts/outing-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OutingProvider>
        <FamilyProvider>
          <HistoryProvider>
            <AnimatedSplashOverlay />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="conditions" />
              <Stack.Screen name="profile-edit" />
              <Stack.Screen name="results" />
              <Stack.Screen name="spot-history-edit" />
            </Stack>
          </HistoryProvider>
        </FamilyProvider>
      </OutingProvider>
    </ThemeProvider>
  );
}
