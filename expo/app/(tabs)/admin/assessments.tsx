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
  Info,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const DEBUG_MODE = true;

interface Assessment {
  id: string;
  name_en: string;
  name_zh?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

interface AssignedAssessment {
  id: string;
  patient_id: string;
  assessment_id: string;
  assigned_by?: string | null;
  assigned_at?: string;
  scheduled_date?: string | null;
  status?: string;
  language?: string | null;
  total_score?: number | null;
  notes?: string | null;
  created_at?: string;
  patients?: {
    patient_name: string;
  } | null;
  assessment_library?: {
    name_en: string;
    name_zh?: string;
  } | null;
}

interface PatientPick {
  id: string;
  patient_name: string;
  access_code: string;
}

type TabType = 'library' | 'assigned';


export default function AssessmentsScreen() {
  const { isAdmin, clinicianCan, clinician } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningAssessment, setAssigningAssessment] = useState<Assessment | null>(null);
  const [assignFromTab, setAssignFromTab] = useState(false);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [assignPatientId, setAssignPatientId] = useState<string | null>(null);


  const [assignNotes, setAssignNotes] = useState('');
  const [assignAssessmentId, setAssignAssessmentId] = useState<string | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);
  const [assessmentSearch, setAssessmentSearch] = useState('');

  const canAccessAssessments = isAdmin || clinicianCan('assign_assessments');

  React.useEffect(() => {
    if (!isAdmin) {
      setActiveTab('assigned');
    }
  }, [isAdmin]);

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
    enabled: canAccessAssessments,
  });

  const assignedQuery = useQuery({
    queryKey: ['admin-assigned-assessments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_submissions')
          .select('*, patients(patient_name), assessment_library(name_en, name_zh)')
          .order('assigned_at', { ascending: false });
        if (error) {
          console.log('Assigned assessments error:', error);
          return [];
        }
        return (data || []) as AssignedAssessment[];
      } catch (e) {
        console.log('Assigned assessments exception:', e);
        return [];
      }
    },
    enabled: canAccessAssessments && activeTab === 'assigned',
  });

  const assessmentLibraryQuery = useQuery({
    queryKey: ['assessment-library-options'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('id, name_en, name_zh, category')
          .eq('is_active', true)
          .order('name_en');
        if (error) {
          console.log('Error fetching assessment library:', error);
          return [];
        }
        return (data || []) as Assessment[];
      } catch (e) {
        console.log('Assessment library options exception:', e);
        return [];
      }
    },
    enabled: canAccessAssessments,
  });

  const patientsQuery = useQuery({
    queryKey: ['assign-patients'],
    queryFn: async () => {
      try {
        let patientQuery = supabase
          .from('patients')
          .select('id, patient_name, access_code')
          .eq('is_frozen', false)
          .order('patient_name', { ascending: true });

        if (!isAdmin && clinician?.id) {
          patientQuery = patientQuery.eq('clinician_id', clinician.id);
        }
        const { data, error } = await patientQuery;
        if (error) throw error;
        return (data || []) as PatientPick[];
      } catch (e) {
        console.log('Error fetching patients for assign:', e);
        return [];
      }
    },
    enabled: canAccessAssessments && assignModalVisible,
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

  const filteredLibrary = useMemo(() => {
    if (!assessmentsQuery.data) return [];
    if (!search.trim()) return assessmentsQuery.data;
    const s = search.toLowerCase();
    return assessmentsQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s) ||
      a.category?.toLowerCase().includes(s)
    );
  }, [assessmentsQuery.data, search]);

  const filteredAssigned = useMemo(() => {
    if (!assignedQuery.data) return [];
    if (!search.trim()) return assignedQuery.data;
    const s = search.toLowerCase();
    return assignedQuery.data.filter(a =>
      a.assessment_library?.name_en?.toLowerCase().includes(s) ||
      a.assessment_library?.name_zh?.toLowerCase().includes(s) ||
      a.patients?.patient_name?.toLowerCase().includes(s) ||
      a.status?.toLowerCase().includes(s)
    );
  }, [assignedQuery.data, search]);

  const filteredAssessmentOptions = useMemo(() => {
    if (!assessmentLibraryQuery.data) return [];
    if (!assessmentSearch.trim()) return assessmentLibraryQuery.data;
    const s = assessmentSearch.toLowerCase();
    return assessmentLibraryQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s)
    );
  }, [assessmentLibraryQuery.data, assessmentSearch]);

  const selectedAssessmentOption = useMemo(() => {
    return assessmentLibraryQuery.data?.find(a => a.id === assignAssessmentId) || null;
  }, [assessmentLibraryQuery.data, assignAssessmentId]);

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

  const openAssignFromLibrary = useCallback((a: Assessment) => {
    setAssigningAssessment(a);
    setAssignFromTab(false);
    setAssignPatientId(null);
    setAssignNotes('');
    setAssignAssessmentId(a.id);
    setPatientSearch('');
    setAssessmentSearch('');
    setAssignModalVisible(true);
  }, []);

  const openAssignNew = useCallback(() => {
    setAssigningAssessment(null);
    setAssignFromTab(true);
    setAssignPatientId(null);
    setAssignNotes('');
    setAssignAssessmentId(null);
    setPatientSearch('');
    setAssessmentSearch('');
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
      if (!assignPatientId) throw new Error('Please select a patient 請選擇患者');
      const assessmentId = assignFromTab ? assignAssessmentId : (assigningAssessment?.id || assignAssessmentId);
      if (!assessmentId) throw new Error('Please select an assessment 請選擇評估');

      console.log('Assigning assessment, patient:', assignPatientId, 'assessment_id (UUID):', assessmentId);
      const { error } = await supabase.from('assessment_submissions').insert({
        patient_id: assignPatientId,
        assessment_id: assessmentId,
        assigned_by: null,
        assigned_at: new Date().toISOString(),
        status: 'pending',
        notes: assignNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAssignModalVisible(false);
      Alert.alert('Assigned 已指派', 'Assessment assigned to patient successfully.\n已成功指派評估給患者。');
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['research-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Assign assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteAssignedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['research-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Delete assigned assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteAssigned = useCallback((item: AssignedAssessment) => {
    const displayName = item.assessment_library?.name_en || item.assessment_id || 'Assessment';
    Alert.alert(
      'Delete Assessment 刪除評估',
      `Remove "${displayName}" for ${item.patients?.patient_name || 'this patient'}?\n確定要刪除此評估嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteAssignedMutation.mutate(item.id) },
      ]
    );
  }, [deleteAssignedMutation]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleDeleteLibrary = useCallback((a: Assessment) => {
    Alert.alert(
      'Delete Assessment 刪除評估',
      `Delete "${a.name_en}"?\n確定要刪除 "${a.name_en}" 嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteMutation.mutate(a.id) },
      ]
    );
  }, [deleteMutation]);

  if (!canAccessAssessments) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Access required{'\n'}請聯繫管理員獲取評估權限</Text>
      </View>
    );
  }

  const isLibraryTab = activeTab === 'library';
  const isAssignedTab = activeTab === 'assigned';
  const showLibraryPlaceholder = !tableExists && isLibraryTab;
  const currentLoading = isLibraryTab ? assessmentsQuery.isLoading : assignedQuery.isLoading;
  const currentFetching = isLibraryTab ? assessmentsQuery.isFetching : assignedQuery.isFetching;
  const handleRefresh = isLibraryTab
    ? () => void assessmentsQuery.refetch()
    : () => void assignedQuery.refetch();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Assessments</Text>
            <Text style={styles.headerSubtitle}>評估</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.tabItem, isLibraryTab && styles.tabItemActive]}
            onPress={() => { setActiveTab('library'); setSearch(''); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isLibraryTab && styles.tabTextActive]}>Library 評估庫</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tabItem, isAssignedTab && styles.tabItemActive]}
          onPress={() => { setActiveTab('assigned'); setSearch(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, isAssignedTab && styles.tabTextActive]}>Assigned 已分配</Text>
        </TouchableOpacity>
      </View>

      {DEBUG_MODE && (
        <View style={{ backgroundColor: 'red', padding: 6 }}>
          <Text style={{ color: 'white', fontSize: 11 }}>
            [DEBUG] isAdmin: {String(isAdmin)} | canAssignAssessments: {String(clinicianCan('assign_assessments'))} | activeTab: {activeTab}
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isLibraryTab ? "Search assessments..." : "Search by patient, assessment..."}
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

      {isAssignedTab && (
        <View style={styles.infoBanner}>
          <Info size={16} color={Colors.info} />
          <Text style={styles.infoBannerText}>
            Assessments assigned here will be visible to patients. Research assessments remain in the Research tab.{'\n'}此處分配的評估將對患者可見。研究評估仍在研究標籤中。
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={currentFetching} onRefresh={handleRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : showLibraryPlaceholder ? (
          <View style={styles.placeholderCenter}>
            <ClipboardCheck size={56} color={Colors.textTertiary} />
            <Text style={styles.placeholderTitle}>Assessment Library Not Configured</Text>
            <Text style={styles.placeholderSubtitle}>評估庫尚未配置</Text>
            <Text style={styles.placeholderDesc}>
              You can still add assessments via the Research tab.{'\n'}您仍可透過研究分頁新增評估。
            </Text>
            <TouchableOpacity
              style={styles.goResearchBtn}
              onPress={() => router.push('/(tabs)/research')}
              activeOpacity={0.7}
            >
              <Text style={styles.goResearchText}>Go to Research 前往研究</Text>
            </TouchableOpacity>
          </View>
        ) : isLibraryTab ? (
          filteredLibrary.length === 0 ? (
            <Text style={styles.emptyText}>No assessments found</Text>
          ) : (
            filteredLibrary.map(a => (
              <View key={a.id} style={styles.card}>
                <TouchableOpacity onPress={() => openEdit(a)} activeOpacity={0.7} style={styles.cardTouchable}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{a.name_en}</Text>
                      {a.name_zh && <Text style={styles.cardNameZh}>{a.name_zh}</Text>}
                    </View>
                    <View style={styles.cardActions}>
                      {a.category && (
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{a.category}</Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteLibrary(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {a.description && <Text style={styles.cardDesc} numberOfLines={2}>{a.description}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => openAssignFromLibrary(a)}
                  activeOpacity={0.7}
                >
                  <UserPlus size={14} color={Colors.accent} />
                  <Text style={styles.assignBtnText}>Assign 指派</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : (
          filteredAssigned.length === 0 ? (
            <Text style={styles.emptyText}>No assigned assessments found{'\n'}尚無已分配的評估</Text>
          ) : (
            filteredAssigned.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTouchable}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{item.patients?.patient_name || 'Unknown Patient'}</Text>

                    </View>
                    <TouchableOpacity onPress={() => handleDeleteAssigned(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Trash2 size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.assignedMeta}>
                    <View style={styles.assessmentNameBadge}>
                      <Text style={styles.assessmentNameText}>
                        {item.assessment_library?.name_en || item.assessment_id || 'Unknown'}
                      </Text>
                    </View>
                    <View style={[styles.timepointBadge, { backgroundColor: item.status === 'completed' ? Colors.successLight : item.status === 'pending' ? Colors.warningLight : Colors.surfaceSecondary }]}>
                      <View style={[styles.timepointDotSmall, { backgroundColor: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary }]} />
                      <Text style={[styles.timepointBadgeText, { color: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary }]}>
                        {item.status || 'unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.assignedDetails}>
                    {item.total_score != null && (
                      <Text style={styles.scoreText}>Score: {item.total_score}</Text>
                    )}
                    {item.assigned_at && (
                      <Text style={styles.dateText}>{item.assigned_at.split('T')[0]}</Text>
                    )}
                  </View>

                  {item.notes && <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>}
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={isLibraryTab ? openNew : openAssignNew}
        activeOpacity={0.8}
      >
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
              {assigningAssessment && !assignFromTab && (
                <View style={styles.assignBanner}>
                  <ClipboardCheck size={18} color={Colors.accent} />
                  <Text style={styles.assignBannerText}>{assigningAssessment.name_en}</Text>
                </View>
              )}

              {assignFromTab && (
                <>
                  <Text style={styles.fieldLabel}>Assessment 評估 *</Text>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => setShowAssessmentPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerBtnText, !selectedAssessmentOption && { color: Colors.textTertiary }]}>
                      {selectedAssessmentOption
                        ? `${selectedAssessmentOption.name_en}${selectedAssessmentOption.name_zh ? ` ${selectedAssessmentOption.name_zh}` : ''}`
                        : 'Select assessment...'}
                    </Text>
                    <ChevronDown size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </>
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

        <Modal visible={showAssessmentPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowAssessmentPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Assessment 選擇評估</Text>
              <View style={styles.pickerSearchRow}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={assessmentSearch}
                  onChangeText={setAssessmentSearch}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={filteredAssessmentOptions}
                keyExtractor={a => a.id}
                style={styles.pickerList}
                renderItem={({ item: a }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, assignAssessmentId === a.id && styles.pickerItemSelected]}
                    onPress={() => { setAssignAssessmentId(a.id); setShowAssessmentPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{a.name_en}</Text>
                      {a.name_zh ? <Text style={styles.pickerItemCode}>{a.name_zh}</Text> : null}
                    </View>
                    {assignAssessmentId === a.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No assessments found</Text>}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.infoLight,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.info,
    lineHeight: 17,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10, overflow: 'hidden' as const,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardTouchable: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardNameZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  participantCode: { fontSize: 12, fontWeight: '500' as const, color: Colors.accent, marginTop: 2 },
  catBadge: { backgroundColor: Colors.infoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
  assignedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  assessmentNameBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assessmentNameText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accentDark },
  timepointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timepointDotSmall: { width: 6, height: 6, borderRadius: 3 },
  timepointBadgeText: { fontSize: 11, fontWeight: '600' as const },
  assignedDetails: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  scoreText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  dateText: { fontSize: 13, color: Colors.textSecondary },
  methodBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  methodBadgeText: { fontSize: 11, color: Colors.textSecondary },
  notesText: { fontSize: 12, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' as const },
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
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40, lineHeight: 22 },
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
