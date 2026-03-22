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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronDown,
  UserCheck,
  UserX,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface ResearchPatient {
  id: string;
  patient_name: string;
  access_code: string;
  diagnosis: string | null;
  is_research_participant: boolean | null;
  research_cohort: string | null;
  research_participant_code: string | null;
  research_consent_date: string | null;
  research_baseline_date: string | null;
  research_endpoint_date: string | null;
}

interface EditForm {
  is_research_participant: boolean;
  research_cohort: string | null;
  research_participant_code: string;
  research_consent_date: string;
  research_baseline_date: string;
  research_endpoint_date: string;
}

const COHORTS = [
  { value: null, labelEn: 'None', labelZh: '無' },
  { value: 'stroke', labelEn: 'Stroke 中風', labelZh: 'Cohort A' },
  { value: 'npc_active', labelEn: 'NPC Active Treatment 鼻咽癌治療中', labelZh: 'Cohort B' },
  { value: 'npc_post', labelEn: 'NPC Post Treatment 鼻咽癌治療後', labelZh: 'Cohort C' },
] as const;

function getCohortLabel(cohort: string | null): string {
  if (!cohort) return '';
  const found = COHORTS.find(c => c.value === cohort);
  return found ? found.labelEn : cohort;
}

function getCohortColor(cohort: string | null): string {
  switch (cohort) {
    case 'stroke': return '#3B82F6';
    case 'npc_active': return '#F59E0B';
    case 'npc_post': return '#8B5CF6';
    default: return Colors.textTertiary;
  }
}

export default function ResearchParticipants() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<ResearchPatient | null>(null);
  const [form, setForm] = useState<EditForm>({
    is_research_participant: false,
    research_cohort: null,
    research_participant_code: '',
    research_consent_date: '',
    research_baseline_date: '',
    research_endpoint_date: '',
  });
  const [showCohortPicker, setShowCohortPicker] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['research-participants'],
    queryFn: async () => {
      console.log('Fetching research participants...');
      const { data, error } = await supabase
        .from('patients')
        .select('id, patient_name, access_code, diagnosis, is_research_participant, research_cohort, research_participant_code, research_consent_date, research_baseline_date, research_endpoint_date')
        .order('patient_name');
      if (error) {
        console.log('Error fetching research participants:', error);
        throw error;
      }
      console.log('Fetched research participants:', data?.length);
      return (data || []) as ResearchPatient[];
    },
  });

  const filtered = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!search.trim()) return patientsQuery.data;
    const s = search.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) ||
      p.access_code?.toLowerCase().includes(s) ||
      p.research_participant_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, search]);

  const researchCount = useMemo(() => {
    return patientsQuery.data?.filter(p => p.is_research_participant).length ?? 0;
  }, [patientsQuery.data]);

  const openEdit = useCallback((patient: ResearchPatient) => {
    setSelectedPatient(patient);
    setForm({
      is_research_participant: patient.is_research_participant ?? false,
      research_cohort: patient.research_cohort,
      research_participant_code: patient.research_participant_code ?? '',
      research_consent_date: patient.research_consent_date ?? '',
      research_baseline_date: patient.research_baseline_date ?? '',
      research_endpoint_date: patient.research_endpoint_date ?? '',
    });
    setEditModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error('No patient selected');
      console.log('Saving research data for patient:', selectedPatient.id);
      const { error } = await supabase
        .from('patients')
        .update({
          is_research_participant: form.is_research_participant,
          research_cohort: form.is_research_participant ? form.research_cohort : null,
          research_participant_code: form.is_research_participant ? form.research_participant_code || null : null,
          research_consent_date: form.research_consent_date || null,
          research_baseline_date: form.research_baseline_date || null,
          research_endpoint_date: form.research_endpoint_date || null,
        })
        .eq('id', selectedPatient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditModalVisible(false);
      void queryClient.invalidateQueries({ queryKey: ['research-participants'] });
      Alert.alert('Success 成功', 'Research data saved 研究資料已儲存');
    },
    onError: (error: Error) => {
      console.log('Error saving research data:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const onRefresh = useCallback(() => {
    void patientsQuery.refetch();
  }, [patientsQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients 搜尋患者..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            testID="research-search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{researchCount} enrolled</Text>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={patientsQuery.isFetching} onRefresh={onRefresh} tintColor="#1B6B4A" />
        }
        showsVerticalScrollIndicator={false}
      >
        {patientsQuery.isLoading ? (
          <ActivityIndicator size="large" color="#1B6B4A" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No patients found 未找到患者</Text>
        ) : (
          filtered.map(patient => (
            <TouchableOpacity
              key={patient.id}
              style={styles.card}
              onPress={() => openEdit(patient)}
              activeOpacity={0.7}
              testID={`research-patient-${patient.id}`}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{patient.patient_name}</Text>
                  <Text style={styles.accessCode}>{patient.access_code}</Text>
                  {patient.diagnosis ? (
                    <Text style={styles.diagnosis} numberOfLines={1}>{patient.diagnosis}</Text>
                  ) : null}
                </View>
                <View style={styles.cardRight}>
                  {patient.is_research_participant ? (
                    <View style={styles.enrolledBadge}>
                      <UserCheck size={12} color={Colors.white} />
                      <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                    </View>
                  ) : (
                    <View style={styles.notEnrolledBadge}>
                      <UserX size={12} color={Colors.textTertiary} />
                      <Text style={styles.notEnrolledText}>Not enrolled</Text>
                    </View>
                  )}
                </View>
              </View>

              {patient.is_research_participant && (
                <View style={styles.cardMeta}>
                  {patient.research_cohort && (
                    <View style={[styles.cohortBadge, { backgroundColor: getCohortColor(patient.research_cohort) + '18' }]}>
                      <View style={[styles.cohortDot, { backgroundColor: getCohortColor(patient.research_cohort) }]} />
                      <Text style={[styles.cohortBadgeText, { color: getCohortColor(patient.research_cohort) }]}>
                        {getCohortLabel(patient.research_cohort)}
                      </Text>
                    </View>
                  )}
                  {patient.research_participant_code ? (
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{patient.research_participant_code}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Research Settings 研究設定</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#1B6B4A" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedPatient && (
                <View style={styles.patientBanner}>
                  <Text style={styles.bannerName}>{selectedPatient.patient_name}</Text>
                  <Text style={styles.bannerCode}>{selectedPatient.access_code}</Text>
                </View>
              )}

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.fieldLabel}>Research Participant 研究參與者</Text>
                  <Text style={styles.fieldHint}>Toggle to enroll in research 切換以加入研究</Text>
                </View>
                <Switch
                  value={form.is_research_participant}
                  onValueChange={v => setForm(p => ({ ...p, is_research_participant: v }))}
                  trackColor={{ true: '#1B6B4A', false: Colors.border }}
                />
              </View>

              {form.is_research_participant && (
                <>
                  <Text style={styles.sectionLabel}>Cohort 組別</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCohortPicker(!showCohortPicker)}>
                    <Text style={[styles.pickerText, !form.research_cohort && { color: Colors.textTertiary }]}>
                      {form.research_cohort ? getCohortLabel(form.research_cohort) : 'Select cohort 選擇組別'}
                    </Text>
                    <ChevronDown size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  {showCohortPicker && (
                    <View style={styles.cohortOptions}>
                      {COHORTS.map(c => (
                        <TouchableOpacity
                          key={c.value ?? 'none'}
                          style={[styles.cohortOption, form.research_cohort === c.value && styles.cohortOptionActive]}
                          onPress={() => {
                            setForm(p => ({ ...p, research_cohort: c.value }));
                            setShowCohortPicker(false);
                          }}
                        >
                          <Text style={[styles.cohortOptionText, form.research_cohort === c.value && styles.cohortOptionTextActive]}>
                            {c.labelEn}
                          </Text>
                          <Text style={[styles.cohortOptionSub, form.research_cohort === c.value && styles.cohortOptionSubActive]}>
                            {c.labelZh}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.sectionLabel}>Participant Code 參與者代碼</Text>
                  <TextInput
                    style={styles.input}
                    value={form.research_participant_code}
                    onChangeText={v => setForm(p => ({ ...p, research_participant_code: v }))}
                    placeholder="e.g. S01, NPC-A03"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.sectionLabel}>Key Dates 重要日期</Text>

                  <Text style={styles.fieldLabel}>Consent Date 同意日期</Text>
                  <TextInput
                    style={styles.input}
                    value={form.research_consent_date}
                    onChangeText={v => setForm(p => ({ ...p, research_consent_date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Baseline Date 基線日期</Text>
                  <TextInput
                    style={styles.input}
                    value={form.research_baseline_date}
                    onChangeText={v => setForm(p => ({ ...p, research_baseline_date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Endpoint Date 終點日期</Text>
                  <TextInput
                    style={styles.input}
                    value={form.research_endpoint_date}
                    onChangeText={v => setForm(p => ({ ...p, research_endpoint_date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
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
  countBadge: {
    backgroundColor: '#1B6B4A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  accessCode: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagnosis: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B6B4A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  enrolledBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  notEnrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  notEnrolledText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cohortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  cohortDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cohortBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  codeBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 40,
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
  patientBanner: {
    backgroundColor: '#1B6B4A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bannerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  bannerCode: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
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
    marginBottom: 14,
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
    marginBottom: 8,
  },
  pickerText: {
    fontSize: 15,
    color: Colors.text,
  },
  cohortOptions: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cohortOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cohortOptionActive: {
    backgroundColor: '#1B6B4A12',
  },
  cohortOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  cohortOptionTextActive: {
    color: '#1B6B4A',
    fontWeight: '600' as const,
  },
  cohortOptionSub: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  cohortOptionSubActive: {
    color: '#1B6B4A',
  },
});
