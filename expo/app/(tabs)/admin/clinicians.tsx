import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Plus,
  Shield,
  Check,
  Minus,
} from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Clinician, ClinicianTier } from '@/types';

const SALT = '_slp_jason_salt';

type OverrideValue = boolean | null;

const PERMISSION_KEYS = [
  { key: 'override_can_manage_patients', label: 'Manage Patients', labelZh: '管理病人' },
  { key: 'override_can_create_programs', label: 'Create Programs', labelZh: '建立療程' },
  { key: 'override_can_use_shared_exercises', label: 'Use Shared Exercises', labelZh: '使用共享運動' },
  { key: 'override_can_upload_exercises', label: 'Upload Exercises', labelZh: '上傳運動' },
  { key: 'override_can_assign_assessments', label: 'Assign Assessments', labelZh: '分配評估' },
  { key: 'override_can_view_dashboard', label: 'View Dashboard', labelZh: '查看儀表板' },
  { key: 'override_can_push_knowledge_videos', label: 'Push Knowledge Videos', labelZh: '推送知識影片' },
  { key: 'override_can_push_feeding_skills', label: 'Push Feeding Skills', labelZh: '推送餵食技巧' },
  { key: 'override_can_manage_reinforcement', label: 'Manage Reinforcement', labelZh: '管理強化' },
  { key: 'override_can_send_notifications', label: 'Send Notifications', labelZh: '發送通知' },
] as const;

interface EditForm {
  name: string;
  name_zh: string;
  email: string;
  phone: string;
  clinic_name: string;
  clinic_name_zh: string;
  tier_id: string;
  is_active: boolean;
  is_approved: boolean;
  overrides: Record<string, OverrideValue>;
  newPassword: string;
}

const emptyForm: EditForm = {
  name: '',
  name_zh: '',
  email: '',
  phone: '',
  clinic_name: '',
  clinic_name_zh: '',
  tier_id: '',
  is_active: true,
  is_approved: true,
  overrides: {},
  newPassword: '',
};

function SegmentedControl({ value, onChange }: { value: OverrideValue; onChange: (v: OverrideValue) => void }) {
  return (
    <View style={segStyles.container}>
      <TouchableOpacity
        style={[segStyles.seg, value === null && segStyles.segActiveNeutral]}
        onPress={() => onChange(null)}
      >
        <Minus size={13} color={value === null ? Colors.white : Colors.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[segStyles.seg, value === true && segStyles.segActiveAllow]}
        onPress={() => onChange(true)}
      >
        <Check size={13} color={value === true ? Colors.white : Colors.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[segStyles.seg, value === false && segStyles.segActiveDeny]}
        onPress={() => onChange(false)}
      >
        <X size={13} color={value === false ? Colors.white : Colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  seg: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segActiveNeutral: { backgroundColor: Colors.frozen },
  segActiveAllow: { backgroundColor: Colors.success },
  segActiveDeny: { backgroundColor: Colors.danger },
});

export default function ClinicianManagementScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedClinician, setSelectedClinician] = useState<Clinician | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [isNewClinician, setIsNewClinician] = useState(false);

  const cliniciansQuery = useQuery({
    queryKey: ['admin-clinicians'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('clinicians').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Clinician[];
      } catch (e) {
        console.log('Error fetching clinicians:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const tiersQuery = useQuery({
    queryKey: ['admin-clinician-tiers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('clinician_tiers').select('*');
        if (error) throw error;
        return (data || []) as ClinicianTier[];
      } catch (e) {
        console.log('Error fetching tiers:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!cliniciansQuery.data) return [];
    if (!search.trim()) return cliniciansQuery.data;
    const s = search.toLowerCase();
    return cliniciansQuery.data.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.name_zh?.toLowerCase().includes(s) ||
      c.clinic_name?.toLowerCase().includes(s)
    );
  }, [cliniciansQuery.data, search]);

  const openEdit = useCallback((c: Clinician) => {
    setSelectedClinician(c);
    setIsNewClinician(false);
    const overrides: Record<string, OverrideValue> = {};
    PERMISSION_KEYS.forEach(pk => {
      overrides[pk.key] = (c as any)[pk.key] ?? null;
    });
    setForm({
      name: c.name || '',
      name_zh: c.name_zh || '',
      email: c.email || '',
      phone: c.phone || '',
      clinic_name: c.clinic_name || '',
      clinic_name_zh: c.clinic_name_zh || '',
      tier_id: c.tier_id || '',
      is_active: c.is_active !== false,
      is_approved: c.is_approved !== false,
      overrides,
      newPassword: '',
    });
    setEditModalVisible(true);
  }, []);

  const openNew = useCallback(() => {
    setSelectedClinician(null);
    setIsNewClinician(true);
    const overrides: Record<string, OverrideValue> = {};
    PERMISSION_KEYS.forEach(pk => {
      overrides[pk.key] = null;
    });
    setForm({ ...emptyForm, overrides });
    setEditModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {
        name: form.name,
        name_zh: form.name_zh,
        email: form.email.toLowerCase().trim(),
        phone: form.phone,
        clinic_name: form.clinic_name,
        clinic_name_zh: form.clinic_name_zh,
        tier_id: form.tier_id || null,
        is_active: form.is_active,
        is_approved: form.is_approved,
      };

      PERMISSION_KEYS.forEach(pk => {
        updates[pk.key] = form.overrides[pk.key] ?? null;
      });

      if (form.newPassword.trim()) {
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          form.newPassword + SALT
        );
        updates.password_hash = hash;
      }

      if (isNewClinician) {
        if (!form.newPassword.trim()) {
          throw new Error('Password is required for new clinician');
        }
        const { error } = await supabase.from('clinicians').insert(updates);
        if (error) throw error;
      } else if (selectedClinician) {
        const { error } = await supabase.from('clinicians').update(updates).eq('id', selectedClinician.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setEditModalVisible(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-clinicians'] });
      setEditModalVisible(false);
      Alert.alert('Success', 'Clinician saved successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!form.newPassword.trim()) throw new Error('Enter a new password');
      if (!selectedClinician) throw new Error('No clinician selected');
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        form.newPassword + SALT
      );
      const { error } = await supabase.from('clinicians').update({ password_hash: hash }).eq('id', selectedClinician.id);
      if (error) throw error;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Password reset successfully');
      setForm(prev => ({ ...prev, newPassword: '' }));
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const getTierName = useCallback((tierId?: string) => {
    if (!tierId || !tiersQuery.data) return 'None';
    const tier = tiersQuery.data.find(t => t.id === tierId);
    return tier?.name || 'Unknown';
  }, [tiersQuery.data]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Clinicians</Text>
            <Text style={styles.headerSubtitle}>治療師管理</Text>
          </View>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clinicians..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={cliniciansQuery.isFetching} onRefresh={() => void cliniciansQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {cliniciansQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No clinicians found</Text>
        ) : (
          filtered.map(c => (
            <TouchableOpacity key={c.id} style={styles.card} onPress={() => openEdit(c)} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{c.name}{c.name_zh ? ` ${c.name_zh}` : ''}</Text>
                  <Text style={styles.cardEmail}>{c.email}</Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: Colors.accentLight }]}>
                  <Text style={styles.tierBadgeText}>{getTierName(c.tier_id)}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={[styles.statusDot, { backgroundColor: c.is_active !== false ? Colors.success : Colors.danger }]} />
                <Text style={styles.statusText}>{c.is_active !== false ? 'Active' : 'Inactive'}</Text>
                <View style={[styles.statusDot, { backgroundColor: c.is_approved !== false ? Colors.success : Colors.warning, marginLeft: 12 }]} />
                <Text style={styles.statusText}>{c.is_approved !== false ? 'Approved' : 'Pending'}</Text>
                {c.clinic_name && <Text style={styles.clinicText}>{c.clinic_name}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isNewClinician ? 'New Clinician' : 'Edit Clinician'}</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Basic Info 基本資料</Text>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="English name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Name (Chinese) 中文名稱</Text>
              <TextInput style={styles.input} value={form.name_zh} onChangeText={v => setForm(p => ({ ...p, name_zh: v }))} placeholder="中文名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Clinic Name</Text>
              <TextInput style={styles.input} value={form.clinic_name} onChangeText={v => setForm(p => ({ ...p, clinic_name: v }))} placeholder="Clinic name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Clinic Name (Chinese) 診所名稱</Text>
              <TextInput style={styles.input} value={form.clinic_name_zh} onChangeText={v => setForm(p => ({ ...p, clinic_name_zh: v }))} placeholder="診所名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.sectionLabel}>Tier & Status 級別和狀態</Text>

              <Text style={styles.fieldLabel}>Tier 級別</Text>
              <View style={styles.tierPicker}>
                {tiersQuery.data?.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tierOption, form.tier_id === t.id && styles.tierOptionActive]}
                    onPress={() => setForm(p => ({ ...p, tier_id: t.id }))}
                  >
                    <Text style={[styles.tierOptionText, form.tier_id === t.id && styles.tierOptionTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.fieldLabel}>Active 啟用</Text>
                </View>
                <Switch
                  value={form.is_active}
                  onValueChange={v => setForm(p => ({ ...p, is_active: v }))}
                  trackColor={{ true: Colors.success, false: Colors.border }}
                />
              </View>

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.fieldLabel}>Approved 已批准</Text>
                </View>
                <Switch
                  value={form.is_approved}
                  onValueChange={v => setForm(p => ({ ...p, is_approved: v }))}
                  trackColor={{ true: Colors.success, false: Colors.border }}
                />
              </View>

              <Text style={styles.sectionLabel}>Permission Overrides 權限覆寫</Text>
              <Text style={styles.hintText}>Default = use tier setting · Allow = force on · Deny = force off</Text>

              {PERMISSION_KEYS.map(pk => (
                <View key={pk.key} style={styles.permRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.permLabel}>{pk.label}</Text>
                    <Text style={styles.permLabelZh}>{pk.labelZh}</Text>
                  </View>
                  <SegmentedControl
                    value={form.overrides[pk.key] ?? null}
                    onChange={v => setForm(p => ({ ...p, overrides: { ...p.overrides, [pk.key]: v } }))}
                  />
                </View>
              ))}

              <Text style={styles.sectionLabel}>Password 密碼</Text>
              <TextInput
                style={styles.input}
                value={form.newPassword}
                onChangeText={v => setForm(p => ({ ...p, newPassword: v }))}
                placeholder={isNewClinician ? 'Set password (required)' : 'New password (leave empty to keep)'}
                secureTextEntry
                placeholderTextColor={Colors.textTertiary}
              />

              {!isNewClinician && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.resetBtnText}>Reset Password 重設密碼</Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.accent },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  countText: { fontSize: 16, fontWeight: '600' as const, color: 'rgba(255,255,255,0.9)' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  tierBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tierBadgeText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accentDark },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  statusText: { fontSize: 12, color: Colors.textSecondary },
  clinicText: { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' as const },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  saveText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  tierPicker: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  tierOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierOptionActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tierOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  tierOptionTextActive: { color: Colors.white },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: { fontSize: 12, color: Colors.textTertiary, marginBottom: 12 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  permLabelZh: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  resetBtn: {
    backgroundColor: Colors.warning,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
});
