import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'My Library 我的文庫',
          headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
        }}
      />
    </Stack>
  );
}
