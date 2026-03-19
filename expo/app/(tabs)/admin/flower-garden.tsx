import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Flower2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function FlowerGardenScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Flower Garden</Text>
            <Text style={styles.headerSubtitle}>花田管理</Text>
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Flower2 size={56} color={Colors.textTertiary} />
        </View>
        <Text style={styles.title}>Flower Garden — Coming Soon</Text>
        <Text style={styles.subtitle}>花田管理 — 即將推出</Text>
        <Text style={styles.desc}>This feature will be available in a future update.{'\n'}Use the web portal for now.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  iconWrap: { width: 100, height: 100, borderRadius: 30, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  desc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
