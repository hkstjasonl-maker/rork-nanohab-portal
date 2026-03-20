import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Shield,
  Building,
  User,
  ImageIcon,
  Save,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface PatientOrg {
  id: string;
  patient_name: string;
  managing_org_name_en: string | null;
  managing_org_name_zh: string | null;
  managing_org_logo_url: string | null;
}

interface AppConfigRow {
  key: string;
  value: string;
}

export default function ManagingOrgScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientOrg | null>(null);

  const [editOrgEn, setEditOrgEn] = useState('');
  const [editOrgZh, setEditOrgZh] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');

  const [defaultOrgEn, setDefaultOrgEn] = useState('');
  const [defaultOrgZh, setDefaultOrgZh] = useState('');
  const [defaultLogoUrl, setDefaultLogoUrl] = useState('');

  const configQuery = useQuery({
    queryKey: ['admin-managing-org-config'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('key, value')
          .in('key', ['default_org_name_en', 'default_org_name_zh', 'default_org_logo_url']);
        if (error) throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((row: AppConfigRow) => { map[row.key] = row.value; });
        return map;
      } catch (e) {
        console.log('Error fetching app_config for org defaults:', e);
        return {} as Record<string, string>;
      }
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (configQuery.data) {
      setDefaultOrgEn(configQuery.data['default_org_name_en'] || '');
      setDefaultOrgZh(configQuery.data['default_org_name_zh'] || '');
      setDefaultLogoUrl(configQuery.data['default_org_logo_url'] || '');
    }
  }, [configQuery.data]);

  const patientsQuery = useQuery({
    queryKey: ['admin-managing-org-patients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, managing_org_name_en, managing_org_name_zh, managing_org_logo_url')
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientOrg[];
      } catch (e) {
        console.log('Error fetching patients for managing org:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!search.trim()) return patientsQuery.data;
    const s = search.toLowerCase();
    return patientsQuery.data.filter(p => p.patient_name?.toLowerCase().includes(s));
  }, [patientsQuery.data, search]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const pairs = [
        { key: 'default_org_name_en', value: defaultOrgEn.trim() },
        { key: 'default_org_name_zh', value: defaultOrgZh.trim() },
        { key: 'default_org_logo_url', value: defaultLogoUrl.trim() },
      ];
      for (const pair of pairs) {
        const { error } = await supabase
          .from('app_config')
          .upsert({ key: pair.key, value: pair.value }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-managing-org-config'] });
      Alert.alert('Saved 已儲存', 'Default org settings saved successfully.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const applyDefaultMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patients')
        .update({
          managing_org_name_en: defaultOrgEn.trim() || null,
          managing_org_name_zh: defaultOrgZh.trim() || null,
          managing_org_logo_url: defaultLogoUrl.trim() || null,
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-managing-org-patients'] });
      Alert.alert('Done 完成', 'All patients updated with default org settings.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmApplyAll = useCallback(() => {
    Alert.alert(
      'Apply Default to All 套用預設至全部',
      'This will overwrite org settings for all patients. Continue?\n將覆蓋所有患者的機構設定，確定繼續？',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', style: 'destructive', onPress: () => applyDefaultMutation.mutate() },
      ]
    );
  }, [applyDefaultMutation]);

  const openEdit = useCallback((patient: PatientOrg) => {
    setEditingPatient(patient);
    setEditOrgEn(patient.managing_org_name_en || '');
    setEditOrgZh(patient.managing_org_name_zh || '');
    setEditLogoUrl(patient.managing_org_logo_url || '');
    setModalVisible(true);
  }, []);

  const savePatientMutation = useMutation({
    mutationFn: async () => {
      if (!editingPatient) throw new Error('No patient selected');
      const { error } = await supabase
        .from('patients')
        .update({
          managing_org_name_en: editOrgEn.trim() || null,
          managing_org_name_zh: editOrgZh.trim() || null,
          managing_org_logo_url: editLogoUrl.trim() || null,
        })
        .eq('id', editingPatient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-managing-org-patients'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const onRefresh = useCallback(() => {
    void configQuery.refetch();
    void patientsQuery.refetch();
  }, [configQuery, patientsQuery]);

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
            <Text style={styles.headerTitle}>Managing Org</Text>
            <Text style={styles.headerSubtitle}>管理機構</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={patientsQuery.isFetching || configQuery.isFetching} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Building size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Default Org Settings 預設機構設定</Text>
        </View>

        <View style={styles.defaultCard}>
          {configQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <>
              <Text style={styles.fieldLabel}>Org Name (EN) 機構名稱（英文）</Text>
              <TextInput style={styles.input} value={defaultOrgEn} onChangeText={setDefaultOrgEn} placeholder="Organisation name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Org Name (ZH) 機構名稱（中文）</Text>
              <TextInput style={styles.input} value={defaultOrgZh} onChangeText={setDefaultOrgZh} placeholder="機構名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Logo URL 標誌網址</Text>
              <TextInput style={styles.input} value={defaultLogoUrl} onChangeText={setDefaultLogoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              {defaultLogoUrl.trim().length > 0 && (
                <Image source={{ uri: defaultLogoUrl }} style={styles.logoPreview} resizeMode="contain" />
              )}

              <View style={styles.defaultActions}>
                <TouchableOpacity
                  style={styles.saveDefaultBtn}
                  onPress={() => saveConfigMutation.mutate()}
                  disabled={saveConfigMutation.isPending}
                  activeOpacity={0.7}
                >
                  {saveConfigMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Save size={16} color={Colors.white} />
                      <Text style={styles.saveDefaultText}>Save Defaults 儲存預設</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyAllBtn}
                  onPress={confirmApplyAll}
                  disabled={applyDefaultMutation.isPending}
                  activeOpacity={0.7}
                >
                  {applyDefaultMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <RefreshCw size={16} color={Colors.white} />
                      <Text style={styles.applyAllText}>Apply to All 套用至全部</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <User size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Per-Patient Overrides 個別患者設定</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
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

        {patientsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Building size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No patients found</Text>
            <Text style={styles.emptySubtext}>找不到患者</Text>
          </View>
        ) : (
          filtered.map(patient => (
            <TouchableOpacity key={patient.id} style={styles.card} onPress={() => openEdit(patient)} activeOpacity={0.7}>
              <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                  <Text style={styles.patientName} numberOfLines={1}>{patient.patient_name}</Text>
                  {patient.managing_org_name_en || patient.managing_org_name_zh ? (
                    <Text style={styles.orgName} numberOfLines={1}>
                      {patient.managing_org_name_en}{patient.managing_org_name_zh ? ` / ${patient.managing_org_name_zh}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.notSet}>Using default 使用預設</Text>
                  )}
                </View>
                {patient.managing_org_logo_url ? (
                  <Image source={{ uri: patient.managing_org_logo_url }} style={styles.cardLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.cardLogoPlaceholder}>
                    <ImageIcon size={18} color={Colors.textTertiary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Patient Org</Text>
              <TouchableOpacity onPress={() => savePatientMutation.mutate()} disabled={savePatientMutation.isPending}>
                {savePatientMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.patientBanner}>
                <User size={20} color={Colors.accent} />
                <Text style={styles.patientBannerText}>{editingPatient?.patient_name}</Text>
              </View>

              <Text style={styles.fieldLabel}>Org Name (EN) 機構名稱（英文）</Text>
              <TextInput style={styles.input} value={editOrgEn} onChangeText={setEditOrgEn} placeholder="Organisation name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Org Name (ZH) 機構名稱（中文）</Text>
              <TextInput style={styles.input} value={editOrgZh} onChangeText={setEditOrgZh} placeholder="機構名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Logo URL 標誌網址</Text>
              <TextInput style={styles.input} value={editLogoUrl} onChangeText={setEditLogoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              {editLogoUrl.trim().length > 0 && (
                <Image source={{ uri: editLogoUrl }} style={styles.logoPreview} resizeMode="contain" />
              )}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  defaultCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 8,
  },
  defaultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  saveDefaultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  saveDefaultText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white },
  applyAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.info,
    borderRadius: 10,
    paddingVertical: 12,
  },
  applyAllText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white },
  logoPreview: {
    width: '100%',
    height: 60,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  patientName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  orgName: { fontSize: 13, color: Colors.textSecondary },
  notSet: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' },
  cardLogo: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.surfaceSecondary },
  cardLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 6 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySubtext: { fontSize: 13, color: Colors.textTertiary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
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
  modalContent: { padding: 20, paddingBottom: 40 },
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  patientBannerText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accentDark },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
