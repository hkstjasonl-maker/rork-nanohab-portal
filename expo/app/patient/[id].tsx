import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Snowflake,
  Sun,
  BarChart3,
  ClipboardCheck,
  Utensils,
  X,
  Search,
  Check,
  ChevronDown,
  Target,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Patient, HolisticObjective } from '@/types';
import ObjectiveFormModal from '@/components/ObjectiveFormModal';
import VideoSubmissions from '@/components/VideoSubmissions';

interface AssessmentLibraryItem {
  id: string;
  name_en: string;
  name_zh?: string;
  category?: string;
}

interface FeedingSkillVideo {
  id: string;
  title_en: string;
  title_zh?: string;
  category?: string;
  youtube_video_id?: string;
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, clinicianCan } = useAuth();

  const [name, setName] = useState('');
  const [_nameZh, setNameZh] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diagnosisZh, setDiagnosisZh] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isFormDirty, setIsFormDirty] = useState(false);

  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showFeedingSkillsModal, setShowFeedingSkillsModal] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<HolisticObjective | null>(null);
  const [objectivesExpanded, setObjectivesExpanded] = useState(true);

  const canAssignAssessments = isAdmin || clinicianCan('assign_assessments');
  const canPushFeedingSkills = isAdmin || clinicianCan('push_feeding_skills');

  const holisticObjectivesQuery = useQuery({
    queryKey: ['holistic-objectives', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('holistic_objectives')
          .select('*')
          .eq('patient_id', id)
          .order('sort_order', { ascending: true });
        if (error) {
          console.log('Holistic objectives fetch error:', error);
          return [];
        }
        return (data || []) as HolisticObjective[];
      } catch (e) {
        console.log('Holistic objectives exception:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const saveObjectiveMutation = useMutation({
    mutationFn: async (formData: { id?: string; objective_en: string; objective_zh_hant: string; objective_zh_hans: string; sort_order: number; is_active: boolean }) => {
      const payload = {
        patient_id: id,
        objective_en: formData.objective_en,
        objective_zh_hant: formData.objective_zh_hant || null,
        objective_zh_hans: formData.objective_zh_hans || null,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      if (formData.id) {
        const { error } = await supabase.from('holistic_objectives').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('holistic_objectives').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setShowObjectiveModal(false);
      setEditingObjective(null);
      void queryClient.invalidateQueries({ queryKey: ['holistic-objectives', id] });
      Alert.alert('Saved 已儲存', 'Objective saved.\n目標已儲存。');
    },
    onError: (error: Error) => {
      console.log('Save holistic objective error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: string) => {
      const { error } = await supabase.from('holistic_objectives').delete().eq('id', objectiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holistic-objectives', id] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteObjective = useCallback((obj: HolisticObjective) => {
    Alert.alert(
      'Delete Objective 刪除目標',
      `Delete "${obj.objective_en}"?\n刪除「${obj.objective_en}」？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteObjectiveMutation.mutate(obj.id) },
      ]
    );
  }, [deleteObjectiveMutation]);

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      const p = data as Patient;
      setName(p.patient_name || '');
      setNameZh('');
      setDiagnosis(p.diagnosis || '');
      setDiagnosisZh(p.diagnosis_zh || '');
      setGender(p.gender || '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setEmergencyContact(p.emergency_contact || '');
      setEmergencyPhone(p.emergency_phone || '');
      setNotes(p.notes || '');
      return p;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patients')
        .update({
          patient_name: name.trim(),
          diagnosis: diagnosis.trim() || null,
          diagnosis_zh: diagnosisZh.trim() || null,
          gender: gender.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          emergency_phone: emergencyPhone.trim() || null,
          notes: notes.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setIsFormDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['patient', id] });
      Alert.alert('Saved 已儲存', 'Patient details updated.\n患者資料已更新。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const freezeMutation = useMutation({
    mutationFn: async (isFrozen: boolean) => {
      const { error } = await supabase
        .from('patients')
        .update({ is_frozen: isFrozen })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['patient', id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-patients'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Name 姓名不完整', 'Patient name is required.\n患者姓名為必填。');
      return;
    }
    updateMutation.mutate();
  }, [name, updateMutation]);

  const handleFreeze = useCallback(() => {
    if (!patientQuery.data) return;
    const isFrozen = patientQuery.data.is_frozen;
    const action = isFrozen ? 'unfreeze' : 'freeze';
    const actionZh = isFrozen ? '解凍' : '凍結';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Patient ${actionZh}患者`,
      `Are you sure?\n確定嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        {
          text: `Confirm 確認`,
          style: isFrozen ? 'default' : 'destructive',
          onPress: () => freezeMutation.mutate(!isFrozen),
        },
      ]
    );
  }, [patientQuery.data, freezeMutation]);

  const handleFieldChange = useCallback((setter: (v: string) => void) => {
    return (text: string) => {
      setter(text);
      setIsFormDirty(true);
    };
  }, []);

  const patient = patientQuery.data;

  if (patientQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Patient', headerShown: true }} />
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (patientQuery.isError || !patient) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Error', headerShown: true }} />
        <Text style={styles.errorText}>Failed to load patient</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: patient.patient_name || 'Patient',
          headerShown: true,
          headerStyle: { backgroundColor: '#F2F0ED' },
          headerTintColor: Colors.text,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateMutation.isPending || !isFormDirty}
              style={{ opacity: isFormDirty ? 1 : 0.4 }}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Save size={22} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {(patient.patient_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.accessCode}>{patient.access_code}</Text>
          <View style={[styles.statusBadgeLarge, patient.is_frozen ? styles.frozenBadge : styles.activeBadge]}>
            <Text style={[styles.statusTextLarge, patient.is_frozen ? styles.frozenText : styles.activeText]}>
              {patient.is_frozen ? 'Frozen 凍結' : 'Active 活躍'}
            </Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Basic Info 基本資料</Text>
          <EditField label="Name 姓名 *" value={name} onChangeText={handleFieldChange(setName)} placeholder="Patient name" />
          <EditField label="Gender 性別" value={gender} onChangeText={handleFieldChange(setGender)} placeholder="M / F / Other" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Medical 醫療</Text>
          <EditField label="Diagnosis 診斷" value={diagnosis} onChangeText={handleFieldChange(setDiagnosis)} placeholder="Primary diagnosis" />
          <EditField label="Diagnosis (Chinese) 診斷中文" value={diagnosisZh} onChangeText={handleFieldChange(setDiagnosisZh)} placeholder="診斷中文" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Contact 聯絡</Text>
          <EditField label="Phone 電話" value={phone} onChangeText={handleFieldChange(setPhone)} placeholder="Phone number" keyboardType="phone-pad" />
          <EditField label="Email 電郵" value={email} onChangeText={handleFieldChange(setEmail)} placeholder="Email" keyboardType="email-address" />
          <EditField label="Emergency Contact 緊急聯絡人" value={emergencyContact} onChangeText={handleFieldChange(setEmergencyContact)} placeholder="Contact name" />
          <EditField label="Emergency Phone 緊急電話" value={emergencyPhone} onChangeText={handleFieldChange(setEmergencyPhone)} placeholder="Contact phone" keyboardType="phone-pad" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Notes 備註</Text>
          <EditField label="Notes 備註" value={notes} onChangeText={handleFieldChange(setNotes)} placeholder="Additional notes" multiline />
        </View>

        <View style={styles.objectivesSection}>
          <TouchableOpacity
            style={styles.objectivesSectionHeader}
            onPress={() => setObjectivesExpanded(!objectivesExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.objectivesSectionLeft}>
              <Target size={18} color="#6366F1" />
              <Text style={styles.objectivesSectionTitle}>Holistic Objectives 整體目標</Text>
              <View style={styles.objectivesCountBadge}>
                <Text style={styles.objectivesCountText}>{holisticObjectivesQuery.data?.length ?? 0}</Text>
              </View>
            </View>
            <View style={styles.objectivesSectionRight}>
              <TouchableOpacity
                style={styles.addObjectiveBtn}
                onPress={() => { setEditingObjective(null); setShowObjectiveModal(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Plus size={16} color={Colors.white} />
              </TouchableOpacity>
              {objectivesExpanded ? (
                <ChevronUp size={18} color={Colors.textTertiary} />
              ) : (
                <ChevronDown size={18} color={Colors.textTertiary} />
              )}
            </View>
          </TouchableOpacity>

          {objectivesExpanded && (
            <View style={styles.objectivesList}>
              {holisticObjectivesQuery.isLoading ? (
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 12 }} />
              ) : (holisticObjectivesQuery.data?.length ?? 0) === 0 ? (
                <View style={styles.objectivesEmpty}>
                  <Target size={28} color={Colors.borderLight} />
                  <Text style={styles.objectivesEmptyText}>No objectives yet 尚無目標</Text>
                </View>
              ) : (
                holisticObjectivesQuery.data?.map((obj, idx) => (
                  <View key={obj.id} style={[styles.objectiveCard, !obj.is_active && styles.objectiveCardInactive]}>
                    <View style={styles.objectiveCardLeft}>
                      <View style={styles.objectiveOrderBadge}>
                        <Text style={styles.objectiveOrderText}>{obj.sort_order ?? idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.objectiveTextEn} numberOfLines={3}>{obj.objective_en}</Text>
                        {obj.objective_zh_hant ? (
                          <Text style={styles.objectiveTextZh} numberOfLines={2}>{obj.objective_zh_hant}</Text>
                        ) : null}
                        {!obj.is_active && (
                          <View style={styles.objectiveInactiveBadge}>
                            <Text style={styles.objectiveInactiveBadgeText}>Inactive 停用</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.objectiveCardActions}>
                      <TouchableOpacity
                        onPress={() => { setEditingObjective(obj); setShowObjectiveModal(true); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={15} color={Colors.info} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteObjective(obj)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={15} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <VideoSubmissions
          patientId={id!}
          patientName={patient.patient_name}
        />

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => router.push(`/patient-dashboard/${patient.id}`)}
            activeOpacity={0.7}
          >
            <BarChart3 size={18} color="#1B6B4A" />
            <Text style={[styles.actionButtonText, { color: '#1B6B4A' }]}>View Dashboard 查看儀表板</Text>
          </TouchableOpacity>

          {canAssignAssessments && (
            <TouchableOpacity
              style={styles.assessmentButton}
              onPress={() => setShowAssessmentModal(true)}
              activeOpacity={0.7}
            >
              <ClipboardCheck size={18} color={Colors.info} />
              <Text style={[styles.actionButtonText, { color: Colors.info }]}>Assign Assessment 分配評估</Text>
            </TouchableOpacity>
          )}

          {canPushFeedingSkills && (
            <TouchableOpacity
              style={styles.feedingSkillsButton}
              onPress={() => setShowFeedingSkillsModal(true)}
              activeOpacity={0.7}
            >
              <Utensils size={18} color={Colors.accent} />
              <Text style={[styles.actionButtonText, { color: Colors.accent }]}>Push Feeding Skills 推送餵食技巧</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, patient.is_frozen ? styles.unfreezeButton : styles.freezeActionButton]}
            onPress={handleFreeze}
            disabled={freezeMutation.isPending}
            activeOpacity={0.7}
          >
            {freezeMutation.isPending ? (
              <ActivityIndicator size="small" color={patient.is_frozen ? Colors.warning : Colors.info} />
            ) : patient.is_frozen ? (
              <>
                <Sun size={18} color={Colors.warning} />
                <Text style={[styles.actionButtonText, { color: Colors.warning }]}>Unfreeze Patient 解凍患者</Text>
              </>
            ) : (
              <>
                <Snowflake size={18} color={Colors.info} />
                <Text style={[styles.actionButtonText, { color: Colors.info }]}>Freeze Patient 凍結患者</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AssignAssessmentModal
        visible={showAssessmentModal}
        onClose={() => setShowAssessmentModal(false)}
        patientId={id!}
        patientName={patient.patient_name}
      />

      <PushFeedingSkillsModal
        visible={showFeedingSkillsModal}
        onClose={() => setShowFeedingSkillsModal(false)}
        patientId={id!}
        patientName={patient.patient_name}
      />

      <ObjectiveFormModal
        visible={showObjectiveModal}
        onClose={() => { setShowObjectiveModal(false); setEditingObjective(null); }}
        onSave={(data) => saveObjectiveMutation.mutate(data)}
        isSaving={saveObjectiveMutation.isPending}
        initialData={editingObjective ? {
          id: editingObjective.id,
          objective_en: editingObjective.objective_en,
          objective_zh_hant: editingObjective.objective_zh_hant || '',
          objective_zh_hans: editingObjective.objective_zh_hans || '',
          sort_order: editingObjective.sort_order,
          is_active: editingObjective.is_active,
        } : null}
        title={editingObjective ? 'Edit Objective 編輯目標' : 'New Objective 新目標'}
      />
    </KeyboardAvoidingView>
  );
}

function AssignAssessmentModal({
  visible,
  onClose,
  patientId,
  patientName,
}: {
  visible: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}) {
  const queryClient = useQueryClient();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [assignNotes, setAssignNotes] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const assessmentsQuery = useQuery({
    queryKey: ['assessment-library-for-assign'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('id, name_en, name_zh, category')
          .order('name_en');
        if (error) {
          console.log('Assessment library fetch error:', error);
          return [];
        }
        return (data || []) as AssessmentLibraryItem[];
      } catch (e) {
        console.log('Assessment library exception:', e);
        return [];
      }
    },
    enabled: visible,
  });

  const selectedAssessment = useMemo(() => {
    return assessmentsQuery.data?.find(a => a.id === selectedAssessmentId) || null;
  }, [assessmentsQuery.data, selectedAssessmentId]);

  const filteredAssessments = useMemo(() => {
    if (!assessmentsQuery.data) return [];
    if (!pickerSearch.trim()) return assessmentsQuery.data;
    const s = pickerSearch.toLowerCase();
    return assessmentsQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s)
    );
  }, [assessmentsQuery.data, pickerSearch]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssessmentId) throw new Error('Please select an assessment');
      const assessmentName = selectedAssessment?.name_en || selectedAssessmentId;
      const { error } = await supabase.from('assessment_submissions').insert({
        patient_id: patientId,
        assessment_id: assessmentName,
        assigned_at: new Date().toISOString(),
        status: 'pending',
        notes: assignNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onClose();
      setSelectedAssessmentId(null);
      setAssignNotes('');
      Alert.alert('Assigned 已指派', 'Assessment assigned successfully.\n評估已成功分配。');
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Assign assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Assign Assessment 分配評估</Text>
          <TouchableOpacity onPress={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
            {assignMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.modalSave}>Assign</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
          <View style={styles.patientBanner}>
            <Text style={styles.patientBannerLabel}>Patient 患者</Text>
            <Text style={styles.patientBannerName}>{patientName}</Text>
          </View>

          <Text style={styles.fieldLabel}>Assessment 評估 *</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pickerBtnText, !selectedAssessment && { color: Colors.textTertiary }]}>
              {selectedAssessment ? `${selectedAssessment.name_en}${selectedAssessment.name_zh ? ` ${selectedAssessment.name_zh}` : ''}` : 'Select assessment...'}
            </Text>
            <ChevronDown size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Notes 備註</Text>
          <TextInput
            style={[styles.fieldInput, { height: 80, textAlignVertical: 'top' as const }]}
            value={assignNotes}
            onChangeText={setAssignNotes}
            placeholder="Optional notes..."
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Select Assessment 選擇評估</Text>
            <View style={styles.pickerSearchRow}>
              <Search size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.pickerSearchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor={Colors.textTertiary}
                autoCorrect={false}
              />
            </View>
            {assessmentsQuery.isLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredAssessments}
                keyExtractor={a => a.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, selectedAssessmentId === item.id && styles.pickerItemSelected]}
                    onPress={() => { setSelectedAssessmentId(item.id); setShowPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.name_en}</Text>
                      {item.name_zh ? <Text style={styles.pickerItemSub}>{item.name_zh}</Text> : null}
                    </View>
                    {selectedAssessmentId === item.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No assessments found</Text>}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function PushFeedingSkillsModal({
  visible,
  onClose,
  patientId,
  patientName,
}: {
  visible: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}) {
  const queryClient = useQueryClient();
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const videosQuery = useQuery({
    queryKey: ['feeding-skills-for-push'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('feeding_skill_videos')
          .select('id, title_en, title_zh, category, youtube_video_id')
          .eq('is_active', true)
          .order('title_en');
        if (error) {
          console.log('Feeding skills fetch error:', error);
          return [];
        }
        return (data || []) as FeedingSkillVideo[];
      } catch (e) {
        console.log('Feeding skills exception:', e);
        return [];
      }
    },
    enabled: visible,
  });

  const filtered = useMemo(() => {
    if (!videosQuery.data) return [];
    if (!search.trim()) return videosQuery.data;
    const s = search.toLowerCase();
    return videosQuery.data.filter(v =>
      v.title_en?.toLowerCase().includes(s) ||
      v.title_zh?.toLowerCase().includes(s) ||
      v.category?.toLowerCase().includes(s)
    );
  }, [videosQuery.data, search]);

  const toggleVideo = useCallback((videoId: string) => {
    setSelectedVideoIds(prev =>
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
  }, []);

  const pushMutation = useMutation({
    mutationFn: async () => {
      if (selectedVideoIds.length === 0) throw new Error('Please select at least one video');
      for (const videoId of selectedVideoIds) {
        const { error } = await supabase.from('feeding_skill_assignments').insert({
          video_id: videoId,
          patient_id: patientId,
          target_type: 'individual',
          start_date: new Date().toISOString().split('T')[0],
          is_active: true,
        });
        if (error) {
          console.log('Push feeding skill error for video', videoId, ':', error);
        }
      }
    },
    onSuccess: () => {
      onClose();
      setSelectedVideoIds([]);
      setSearch('');
      Alert.alert('Pushed 已推送', `${selectedVideoIds.length} feeding skill(s) pushed to ${patientName}.\n已推送 ${selectedVideoIds.length} 個餵食技巧。`);
      void queryClient.invalidateQueries({ queryKey: ['feeding-skill-assignments'] });
    },
    onError: (error: Error) => {
      console.log('Push feeding skills error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { onClose(); setSelectedVideoIds([]); setSearch(''); }}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Push Feeding Skills 推送餵食技巧</Text>
          <TouchableOpacity onPress={() => pushMutation.mutate()} disabled={pushMutation.isPending || selectedVideoIds.length === 0}>
            {pushMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={[styles.modalSave, selectedVideoIds.length === 0 && { opacity: 0.4 }]}>
                Push ({selectedVideoIds.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.patientBanner}>
          <Text style={styles.patientBannerLabel}>Patient 患者</Text>
          <Text style={styles.patientBannerName}>{patientName}</Text>
        </View>

        <View style={styles.feedingSearchContainer}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.feedingSearchInput}
            placeholder="Search feeding skills..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {videosQuery.isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={v => v.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isSelected = selectedVideoIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.feedingVideoItem, isSelected && styles.feedingVideoItemSelected]}
                  onPress={() => toggleVideo(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.feedingCheckbox, isSelected && styles.feedingCheckboxActive]}>
                    {isSelected && <Check size={14} color={Colors.white} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feedingVideoTitle} numberOfLines={1}>{item.title_en}</Text>
                    {item.title_zh ? <Text style={styles.feedingVideoTitleZh} numberOfLines={1}>{item.title_zh}</Text> : null}
                    {item.category ? (
                      <View style={styles.feedingCatBadge}>
                        <Text style={styles.feedingCatText}>{item.category}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40, gap: 6 }}>
                <Utensils size={36} color={Colors.textTertiary} />
                <Text style={{ fontSize: 14, color: Colors.textTertiary }}>No feeding skill videos found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F0ED',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: Colors.danger,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLargeText: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  accessCode: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
  },
  frozenBadge: {
    backgroundColor: Colors.frozenLight,
  },
  statusTextLarge: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  activeText: {
    color: Colors.success,
  },
  frozenText: {
    color: Colors.frozen,
  },
  formSection: {
    marginBottom: 24,
    gap: 12,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 2,
  },
  editField: {
    gap: 5,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  editInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  editInputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  objectivesSection: {
    marginBottom: 24,
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  objectivesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F0EDFF',
  },
  objectivesSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  objectivesSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#4338CA',
  },
  objectivesCountBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  objectivesCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  objectivesSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addObjectiveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectivesList: {
    padding: 10,
    gap: 8,
  },
  objectivesEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  objectivesEmptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  objectiveCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  objectiveCardInactive: {
    opacity: 0.55,
  },
  objectiveCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  objectiveOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  objectiveOrderText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  objectiveTextEn: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  objectiveTextZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  objectiveInactiveBadge: {
    backgroundColor: Colors.frozenLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  objectiveInactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.frozen,
  },
  objectiveCardActions: {
    gap: 10,
    paddingLeft: 8,
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1B6B4A12',
  },
  assessmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.infoLight,
  },
  feedingSkillsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFF0E6',
  },
  freezeActionButton: {
    backgroundColor: Colors.infoLight,
  },
  unfreezeButton: {
    backgroundColor: Colors.warningLight,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    gap: 4,
  },
  patientBanner: {
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  patientBannerLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accentDark,
    textTransform: 'uppercase' as const,
  },
  patientBannerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnText: {
    fontSize: 15,
    color: Colors.text,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  pickerModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: 500,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  pickerList: {
    maxHeight: 340,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  pickerItemSelected: {
    backgroundColor: Colors.accentLight + '40',
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  pickerItemSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  pickerEmpty: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 20,
  },
  feedingSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
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
  feedingSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  feedingVideoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  feedingVideoItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: '#FFF8F4',
  },
  feedingCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedingCheckboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  feedingVideoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  feedingVideoTitleZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  feedingCatBadge: {
    backgroundColor: '#FFF0E6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  feedingCatText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accentDark,
  },
});
