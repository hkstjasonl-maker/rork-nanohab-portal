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
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
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
  ClipboardCheck,
  UserPlus,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Assessment {
  id: string;
  name_en: string;
  name_zh?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

interface PatientPick {
  id: string;
  patient_name: string;
  access_code: string;
}

const TIMEPOINTS = ['baseline', 'week4', 'endpoint'] as const;
const _ASSESSMENT_NAMES = ['EAT-10', 'FOIS', 'SWAL-QOL', 'FDA-2', 'DHI', 'D-TOMs', 'COAST', 'SUS', 'Other'];

export default function AssessmentsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningAssessment, setAssigningAssessment] = useState<Assessment | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [assignPatientId, setAssignPatientId] = useState<string | null>(null);
  const [assignTimepoint, setAssignTimepoint] = useState<string>('baseline');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignNotes, setAssignNotes] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  const assessmentsQuery = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          if (error.message?.includes('does not exist') || error.code === '42P01') {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data || []) as Assessment[];
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string };
        console.log('Error fetching assessments:', e);
        if (err?.message?.includes('does not exist') || err?.code === '42P01') {
          setTableExists(false);
        }
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientsQuery = useQuery({
    queryKey: ['assign-patients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, access_code')
          .eq('is_frozen', false)
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientPick[];
      } catch (e) {
        console.log('Error fetching patients for assign:', e);
        return [];
      }
    },
    enabled: isAdmin && assignModalVisible,
  });

  const filteredPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!patientSearch.trim()) return patientsQuery.data;
    const s = patientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, patientSearch]);

  const selectedPatient = useMemo(() => {
    return patientsQuery.data?.find(p => p.id === assignPatientId) || null;
  }, [patientsQuery.data, assignPatientId]);

  const filtered = useMemo(() => {
    if (!assessmentsQuery.data) return [];
    if (!search.trim()) return assessmentsQuery.data;
    const s = search.toLowerCase();
    return assessmentsQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s) ||
      a.category?.toLowerCase().includes(s)
    );
  }, [assessmentsQuery.data, search]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setNameEn(''); setNameZh(''); setCategory(''); setDescription('');
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((a: Assessment) => {
    setEditingId(a.id);
    setNameEn(a.name_en || ''); setNameZh(a.name_zh || '');
    setCategory(a.category || ''); setDescription(a.description || '');
    setModalVisible(true);
  }, []);

  const openAssign = useCallback((a: Assessment) => {
    setAssigningAssessment(a);
    setAssignPatientId(null);
    setAssignTimepoint('baseline');
    setAssignDate(new Date().toISOString().split('T')[0]);
    setAssignNotes('');
    setPatientSearch('');
    setAssignModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim()) throw new Error('English name is required');
      const payload = {
        name_en: nameEn.trim(),
        name_zh: nameZh.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('assessment_library').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assessment_library').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      setModalVisible(false);
    },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignPatientId) throw new Error('Please select a patient');
      if (!assigningAssessment) throw new Error('No assessment selected');

      const { error } = await supabase.from('research_assessments').insert({
        patient_id: assignPatientId,
        assessment_name: assigningAssessment.name_en,
        timepoint: assignTimepoint,
        administered_date: assignDate,
        completion_method: 'paper',
        notes: assignNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAssignModalVisible(false);
      Alert.alert('Assigned 已指派', 'Assessment assigned to patient successfully.\n已成功指派評估給患者。');
      void queryClient.invalidateQueries({ queryKey: ['research-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Assign assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  if (!tableExists) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft size={24} color={Colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Assessments</Text>
              <Text style={styles.headerSubtitle}>評估庫</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.placeholderCenter}>
          <ClipboardCheck size={56} color={Colors.textTertiary} />
          <Text style={styles.placeholderTitle}>Assessment Library Not Configured</Text>
          <Text style={styles.placeholderSubtitle}>評估庫尚未配置</Text>
          <Text style={styles.placeholderDesc}>
            You can still add assessments via the Research tab.
            {'\n'}您仍可透過研究分頁新增評估。
          </Text>
          <TouchableOpacity
            style={styles.goResearchBtn}
            onPress={() => router.push('/(tabs)/research')}
            activeOpacity={0.7}
          >
            <Text style={styles.goResearchText}>Go to Research 前往研究</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.headerTitle}>Assessments</Text>
            <Text style={styles.headerSubtitle}>評估庫</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assessments..."
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
          <RefreshControl refreshing={assessmentsQuery.isFetching} onRefresh={() => void assessmentsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {assessmentsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No assessments found</Text>
        ) : (
          filtered.map(a => (
            <View key={a.id} style={styles.card}>
              <TouchableOpacity onPress={() => openEdit(a)} activeOpacity={0.7} style={styles.cardTouchable}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{a.name_en}</Text>
                    {a.name_zh && <Text style={styles.cardNameZh}>{a.name_zh}</Text>}
                  </View>
                  {a.category && (
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{a.category}</Text>
                    </View>
                  )}
                </View>
                {a.description && <Text style={styles.cardDesc} numberOfLines={2}>{a.description}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => openAssign(a)}
                activeOpacity={0.7}
              >
                <UserPlus size={14} color={Colors.accent} />
                <Text style={styles.assignBtnText}>Assign 指派</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Assessment</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Name (English)</Text>
              <TextInput style={styles.input} value={nameEn} onChangeText={setNameEn} placeholder="Assessment name" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Name (Chinese) 中文名稱</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="評估名稱" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Category 類別</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Description 描述</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' as const }]}
                value={description} onChangeText={setDescription}
                placeholder="Description" placeholderTextColor={Colors.textTertiary} multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={assignModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Assign Assessment 指派評估</Text>
              <TouchableOpacity onPress={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                {assignMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {assigningAssessment && (
                <View style={styles.assignBanner}>
                  <ClipboardCheck size={18} color={Colors.accent} />
                  <Text style={styles.assignBannerText}>{assigningAssessment.name_en}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Patient 患者 *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowPatientPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !selectedPatient && { color: Colors.textTertiary }]}>
                  {selectedPatient ? `${selectedPatient.patient_name} (${selectedPatient.access_code})` : 'Select patient...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Timepoint 時間點 *</Text>
              <View style={styles.timepointRow}>
                {TIMEPOINTS.map(tp => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.timepointChip, assignTimepoint === tp && styles.timepointChipActive]}
                    onPress={() => setAssignTimepoint(tp)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.timepointDot, {
                      backgroundColor: tp === 'baseline' ? Colors.success : tp === 'week4' ? Colors.warning : Colors.danger,
                    }]} />
                    <Text style={[styles.timepointText, assignTimepoint === tp && styles.timepointTextActive]}>
                      {tp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Date 日期</Text>
              <TextInput
                style={styles.input}
                value={assignDate}
                onChangeText={setAssignDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' as const }]}
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showPatientPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPatientPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Patient 選擇患者</Text>
              <View style={styles.pickerSearchRow}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={filteredPatients}
                keyExtractor={p => p.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, assignPatientId === item.id && styles.pickerItemSelected]}
                    onPress={() => { setAssignPatientId(item.id); setShowPatientPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.patient_name}</Text>
                      <Text style={styles.pickerItemCode}>{item.access_code}</Text>
                    </View>
                    {assignPatientId === item.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No patients found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>
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
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10, overflow: 'hidden' as const,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardTouchable: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardNameZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  catBadge: { backgroundColor: Colors.infoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight,
    backgroundColor: Colors.accentLight + '30',
  },
  assignBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
  placeholderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  placeholderTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginTop: 12, textAlign: 'center' },
  placeholderSubtitle: { fontSize: 16, color: Colors.textSecondary },
  placeholderDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  goResearchBtn: {
    backgroundColor: '#1B6B4A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
  },
  goResearchText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  saveText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  assignBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accentLight,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  assignBannerText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accentDark },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerBtnText: { fontSize: 15, color: Colors.text },
  timepointRow: { flexDirection: 'row', gap: 8 },
  timepointChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  timepointChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight + '40' },
  timepointDot: { width: 8, height: 8, borderRadius: 4 },
  timepointText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  timepointTextActive: { color: Colors.accent, fontWeight: '600' as const },
  pickerOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 30 },
  pickerModal: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, width: '100%', maxHeight: 500 },
  pickerModalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  pickerSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  pickerList: { maxHeight: 340 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 2,
  },
  pickerItemSelected: { backgroundColor: Colors.accentLight + '40' },
  pickerItemName: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  pickerItemCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  pickerEmpty: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: 20 },
});
