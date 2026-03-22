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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  X,
  ChevronDown,
  ClipboardCheck,
  Calendar,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface ResearchAssessment {
  id: string;
  patient_id: string;
  assessment_name: string;
  timepoint: string | null;
  total_score: number | null;
  administered_date: string | null;
  completion_method: string | null;
  notes: string | null;
  created_at: string;
  patients: {
    patient_name: string;
    research_participant_code: string | null;
    research_cohort: string | null;
  };
}

interface ResearchParticipant {
  id: string;
  patient_name: string;
  research_participant_code: string | null;
}

interface AddForm {
  patient_id: string;
  assessment_name: string;
  timepoint: string;
  total_score: string;
  administered_date: string;
  completion_method: string;
  notes: string;
}

const ASSESSMENT_NAMES = [
  'EAT-10', 'FOIS', 'SWAL-QOL', 'FDA-2', 'DHI', 'D-TOMs', 'COAST', 'SUS', 'Other',
];

const TIMEPOINTS = [
  { value: 'baseline', labelEn: 'Baseline', labelZh: '基線', color: '#22C55E' },
  { value: 'week4', labelEn: 'Week 4', labelZh: '第4週', color: '#F59E0B' },
  { value: 'endpoint', labelEn: 'Endpoint', labelZh: '終點', color: '#EF4444' },
];

const COMPLETION_METHODS = [
  { value: 'app_wizard', label: 'App Wizard' },
  { value: 'app_checklist', label: 'App Checklist' },
  { value: 'paper', label: 'Paper' },
  { value: 'interview', label: 'Interview' },
];

function getTimepointInfo(tp: string | null) {
  return TIMEPOINTS.find(t => t.value === tp) ?? { labelEn: tp ?? '—', labelZh: '', color: Colors.textTertiary };
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyForm: AddForm = {
  patient_id: '',
  assessment_name: '',
  timepoint: 'baseline',
  total_score: '',
  administered_date: getTodayString(),
  completion_method: 'app_wizard',
  notes: '',
};

export default function ResearchAssessments() {
  const queryClient = useQueryClient();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form, setForm] = useState<AddForm>({ ...emptyForm });
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);
  const [showTimepointPicker, setShowTimepointPicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  const assessmentsQuery = useQuery({
    queryKey: ['research-assessments'],
    queryFn: async () => {
      console.log('Fetching research assessments...');
      const { data, error } = await supabase
        .from('research_assessments')
        .select('*, patients!inner(patient_name, research_participant_code, research_cohort)')
        .order('administered_date', { ascending: false });
      if (error) {
        console.log('Error fetching assessments:', error);
        throw error;
      }
      console.log('Fetched assessments:', data?.length);
      return (data || []) as ResearchAssessment[];
    },
  });

  const participantsQuery = useQuery({
    queryKey: ['research-assessment-participants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, patient_name, research_participant_code')
        .eq('is_research_participant', true)
        .order('patient_name');
      if (error) throw error;
      return (data || []) as ResearchParticipant[];
    },
  });

  const selectedParticipant = useMemo(() => {
    if (!form.patient_id || !participantsQuery.data) return null;
    return participantsQuery.data.find(p => p.id === form.patient_id) ?? null;
  }, [form.patient_id, participantsQuery.data]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.patient_id) throw new Error('Select a patient');
      if (!form.assessment_name) throw new Error('Select an assessment');
      console.log('Adding research assessment:', form);
      const { error } = await supabase.from('research_assessments').insert({
        patient_id: form.patient_id,
        assessment_name: form.assessment_name,
        timepoint: form.timepoint || null,
        total_score: form.total_score ? parseFloat(form.total_score) : null,
        administered_date: form.administered_date || null,
        completion_method: form.completion_method || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAddModalVisible(false);
      setForm({ ...emptyForm });
      void queryClient.invalidateQueries({ queryKey: ['research-assessments'] });
      Alert.alert('Success 成功', 'Assessment added 評估已新增');
    },
    onError: (error: Error) => {
      console.log('Error adding assessment:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const onRefresh = useCallback(() => {
    void assessmentsQuery.refetch();
  }, [assessmentsQuery]);

  const openAdd = useCallback(() => {
    setForm({ ...emptyForm, administered_date: getTodayString() });
    setAddModalVisible(true);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={assessmentsQuery.isFetching} onRefresh={onRefresh} tintColor="#1B6B4A" />
        }
        showsVerticalScrollIndicator={false}
      >
        {assessmentsQuery.isLoading ? (
          <ActivityIndicator size="large" color="#1B6B4A" style={{ marginTop: 40 }} />
        ) : (assessmentsQuery.data?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>No assessments found 未找到評估</Text>
        ) : (
          assessmentsQuery.data?.map(a => {
            const tp = getTimepointInfo(a.timepoint);
            const dateStr = a.administered_date
              ? new Date(a.administered_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
              : '—';
            return (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeRow}>
                      <Text style={styles.participantCode}>
                        {a.patients?.research_participant_code || '—'}
                      </Text>
                      <View style={[styles.timepointBadge, { backgroundColor: tp.color + '18' }]}>
                        <View style={[styles.timepointDot, { backgroundColor: tp.color }]} />
                        <Text style={[styles.timepointText, { color: tp.color }]}>{tp.labelEn}</Text>
                      </View>
                    </View>
                    <Text style={styles.patientName}>{a.patients?.patient_name}</Text>
                  </View>
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreValue}>{a.total_score ?? '—'}</Text>
                    <Text style={styles.scoreLabel}>Score</Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.assessmentBadge}>
                    <ClipboardCheck size={11} color="#1B6B4A" />
                    <Text style={styles.assessmentBadgeText}>{a.assessment_name}</Text>
                  </View>
                  <View style={styles.dateRow}>
                    <Calendar size={11} color={Colors.textTertiary} />
                    <Text style={styles.dateText}>{dateStr}</Text>
                  </View>
                  {a.completion_method && (
                    <View style={styles.methodBadge}>
                      <Text style={styles.methodText}>{a.completion_method.replace('_', ' ')}</Text>
                    </View>
                  )}
                </View>
                {a.notes ? (
                  <Text style={styles.notesText} numberOfLines={2}>{a.notes}</Text>
                ) : null}
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.8} testID="add-assessment-btn">
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Assessment 新增評估</Text>
              <TouchableOpacity onPress={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <ActivityIndicator size="small" color="#1B6B4A" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Patient 患者 *</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPatientPicker(!showPatientPicker)}>
                <Text style={[styles.pickerText, !form.patient_id && { color: Colors.textTertiary }]}>
                  {selectedParticipant
                    ? `${selectedParticipant.research_participant_code ? selectedParticipant.research_participant_code + ' — ' : ''}${selectedParticipant.patient_name}`
                    : 'Select patient 選擇患者'}
                </Text>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showPatientPicker && (
                <View style={styles.dropdown}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {participantsQuery.data?.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.dropdownItem, form.patient_id === p.id && styles.dropdownItemActive]}
                        onPress={() => { setForm(f => ({ ...f, patient_id: p.id })); setShowPatientPicker(false); }}
                      >
                        <Text style={[styles.dropdownItemText, form.patient_id === p.id && styles.dropdownItemTextActive]}>
                          {p.research_participant_code ? `${p.research_participant_code} — ` : ''}{p.patient_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.fieldLabel}>Assessment Name 評估名稱 *</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowAssessmentPicker(!showAssessmentPicker)}>
                <Text style={[styles.pickerText, !form.assessment_name && { color: Colors.textTertiary }]}>
                  {form.assessment_name || 'Select assessment 選擇評估'}
                </Text>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showAssessmentPicker && (
                <View style={styles.dropdown}>
                  {ASSESSMENT_NAMES.map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.dropdownItem, form.assessment_name === name && styles.dropdownItemActive]}
                      onPress={() => { setForm(f => ({ ...f, assessment_name: name })); setShowAssessmentPicker(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.assessment_name === name && styles.dropdownItemTextActive]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Timepoint 時間點</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimepointPicker(!showTimepointPicker)}>
                <Text style={styles.pickerText}>
                  {TIMEPOINTS.find(t => t.value === form.timepoint)?.labelEn ?? 'Select'}
                </Text>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showTimepointPicker && (
                <View style={styles.dropdown}>
                  {TIMEPOINTS.map(tp => (
                    <TouchableOpacity
                      key={tp.value}
                      style={[styles.dropdownItem, form.timepoint === tp.value && styles.dropdownItemActive]}
                      onPress={() => { setForm(f => ({ ...f, timepoint: tp.value })); setShowTimepointPicker(false); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tp.color }} />
                        <Text style={[styles.dropdownItemText, form.timepoint === tp.value && styles.dropdownItemTextActive]}>
                          {tp.labelEn} {tp.labelZh}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Total Score 總分</Text>
              <TextInput
                style={styles.input}
                value={form.total_score}
                onChangeText={v => setForm(f => ({ ...f, total_score: v }))}
                placeholder="Enter score"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Date 日期</Text>
              <TextInput
                style={styles.input}
                value={form.administered_date}
                onChangeText={v => setForm(f => ({ ...f, administered_date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Completion Method 完成方式</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMethodPicker(!showMethodPicker)}>
                <Text style={styles.pickerText}>
                  {COMPLETION_METHODS.find(m => m.value === form.completion_method)?.label ?? 'Select'}
                </Text>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showMethodPicker && (
                <View style={styles.dropdown}>
                  {COMPLETION_METHODS.map(m => (
                    <TouchableOpacity
                      key={m.value}
                      style={[styles.dropdownItem, form.completion_method === m.value && styles.dropdownItemActive]}
                      onPress={() => { setForm(f => ({ ...f, completion_method: m.value })); setShowMethodPicker(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.completion_method === m.value && styles.dropdownItemTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes 備註（選填）"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

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
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  participantCode: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1B6B4A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  patientName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timepointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  timepointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timepointText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  scoreBox: {
    backgroundColor: '#1B6B4A10',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 56,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#1B6B4A',
  },
  scoreLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    marginTop: 1,
    textTransform: 'uppercase' as const,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  cardBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  assessmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B6B4A12',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  assessmentBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1B6B4A',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  methodBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  methodText: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'capitalize' as const,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B6B4A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B6B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
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
  saveText: { fontSize: 16, fontWeight: '600' as const, color: '#1B6B4A' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
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
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerText: {
    fontSize: 15,
    color: Colors.text,
  },
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: '#1B6B4A10',
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.text,
  },
  dropdownItemTextActive: {
    color: '#1B6B4A',
    fontWeight: '600' as const,
  },
});
