import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { User, Mail, Building2, LogOut, Info, Shield, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, adminUser, clinician, logout } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: async () => { await logout(); },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out 登出', 'Are you sure you want to sign out?\n確定要登出嗎？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: 'Sign Out 登出', style: 'destructive', onPress: () => logoutMutation.mutate() },
    ]);
  }, [logoutMutation]);

  const displayName = isAdmin ? 'Administrator 管理員' : clinician?.full_name || 'Clinician';
  const displayEmail = isAdmin ? adminUser?.email : clinician?.email;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}><Text style={styles.headerTitle}>Settings 設定</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}><User size={28} color={Colors.white} /></View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {clinician?.full_name_zh && <Text style={styles.profileNameZh}>{clinician.full_name_zh}</Text>}
            <View style={styles.rolePill}>
              <Shield size={12} color={Colors.accent} />
              <Text style={styles.rolePillText}>{isAdmin ? 'Admin' : `Clinician (Tier: ${clinician?.tier_id || 'N/A'})`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account 帳戶</Text>
          <View style={styles.sectionCard}>
            <SettingsRow icon={<Mail size={18} color={Colors.accent} />} label="Email 電郵" value={displayEmail || '-'} />
            {!isAdmin && clinician?.organization && (
              <SettingsRow icon={<Building2 size={18} color={Colors.accent} />} label="Organisation 機構" value={clinician.organization} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General 一般</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.6}>
              <View style={styles.settingsRowLeft}><Info size={18} color={Colors.accent} /><Text style={styles.settingsLabel}>About 關於</Text></View>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7} testID="logout-button">
          <LogOut size={18} color={Colors.danger} /><Text style={styles.logoutText}>Sign Out 登出</Text>
        </TouchableOpacity>

        <View style={styles.aboutFooter}>
          <Text style={styles.appVersion}>NanoHab Portal v1.0.0</Text>
          <Text style={styles.appVersion}>醫家動管理平台</Text>
          <View style={styles.divider} />
          <Text style={styles.copyright}>© Dr. Avive Group Limited. All rights reserved.</Text>
          <Text style={styles.credit}>Created by Mr. Jason Lai Chung Him 黎頌謙先生</Text>
          <Text style={styles.credit}>Speech-Language Pathologist</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>{icon}<Text style={styles.settingsLabel}>{label}</Text></View>
      <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0ED' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.3 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  profileCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 24 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  profileNameZh: { fontSize: 14, color: Colors.textSecondary },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  rolePillText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sectionCard: { backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  settingsValue: { fontSize: 14, color: Colors.textSecondary, maxWidth: '50%' as unknown as number, textAlign: 'right' as const },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dangerLight, borderRadius: 14, paddingVertical: 14, marginBottom: 32 },
  logoutText: { fontSize: 16, fontWeight: '600' as const, color: Colors.danger },
  aboutFooter: { alignItems: 'center', gap: 2, paddingBottom: 20 },
  appVersion: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  divider: { width: 40, height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  copyright: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' as const },
  credit: { fontSize: 10, color: Colors.textTertiary, textAlign: 'center' as const },
});
