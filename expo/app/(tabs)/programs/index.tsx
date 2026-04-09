import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Calendar,
  Clock,
  Dumbbell,
  ClipboardList,
  Check,
  X,
  Trash2,
  Search,
  Target,
  Pencil,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Patient, ExerciseProgram, ProgramExercise, Exercise, ProgramObjective } from '@/types';
import ObjectiveFormModal from '@/components/ObjectiveFormModal';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getScheduleLabel(program: ExerciseProgram): string {
  if (program.schedule_type === 'daily') return 'Daily 每日';
  if (program.custom_days) {
    const days = program.custom_days
      .map((active, i) => (active ? DAY_LABELS[i] : null))
      .filter(Boolean);
    return days.join(', ');
  }
  return 'Custom 自訂';
}

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, clinician, clinicianTier, clinicianCan } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showNewProgramModal, setShowNewProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ExerciseProgram | null>(null);

  const canCreatePrograms = isAdmin || clinicianCan('create_programs');

  console.log('Programs screen - isAdmin:', isAdmin, 'canCreate:', canCreatePrograms,
    'override:', clinician?.override_can_create_programs,
    'tierLoaded:', !!clinicianTier);

  const patientsQuery = useQuery({
    queryKey: ['program-patients', isAdmin, clinician?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*');

        if (error) {
          console.log('Program patients fetch error:', error);
          return [];
        }

        let patients = data || [];

        if (!isAdmin && clinician?.id) {
          patients = patients.filter(p => p.clinician_id === clinician.id);
        }

        patients = patients.filter(p => p.is_frozen !== true);

        patients.sort((a, b) => (a.patient_name || '').localeCompare(b.patient_name || ''));

        console.log('Program patients fetched:', patients.length);
        return patients.map(p => ({
          id: p.id,
          patient_name: p.patient_name || 'Unknown',
          access_code: p.access_code || '',
          is_frozen: p.is_frozen || false,
        }));
      } catch (e) {
        console.log('Program patients exception:', e);
        return [];
      }
    },
    enabled: true,
  });

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId || !patientsQuery.data) return null;
    return patientsQuery.data.find((p) => p.id === selectedPatientId) || null;
  }, [selectedPatientId, patientsQuery.data]);

  const programsQuery = useQuery({
    queryKey: ['programs', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      console.log('Fetching programs for patient:', selectedPatientId);

      const { data, error } = await supabase
        .from('exercise_programs')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.log('Programs fetch error:', error);
        throw error;
      }
      return (data || []) as ExerciseProgram[];
    },
    enabled: !!selectedPatientId,
  });

  const programExercisesQuery = useQuery({
    queryKey: ['program-exercises', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId || !programsQuery.data?.length) return {};
      const programIds = programsQuery.data.map((p) => p.id);
      console.log('Fetching exercises for programs:', programIds);

      const { data, error } = await supabase
        .from('exercises')
        .select('*, exercise_library(*)')
        .in('program_id', programIds)
        .order('sort_order', { ascending: true });

      if (error) {
        console.log('Program exercises fetch error:', error);
        throw error;
      }

      const grouped: Record<string, ProgramExercise[]> = {};
      (data || []).forEach((ex: ProgramExercise) => {
        if (!grouped[ex.program_id]) grouped[ex.program_id] = [];
        grouped[ex.program_id].push(ex);
      });
      return grouped;
    },
    enabled: !!selectedPatientId && (programsQuery.data?.length ?? 0) > 0,
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (programId: string) => {
      const { error: exError } = await supabase
        .from('exercises')
        .delete()
        .eq('program_id', programId);
      if (exError) console.log('Delete program exercises error:', exError);

      const { error: schError } = await supabase
        .from('program_schedules')
        .delete()
        .eq('program_id', programId);
      if (schError) console.log('Delete program schedules error:', schError);

      const { error } = await supabase
        .from('exercise_programs')
        .delete()
        .eq('id', programId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs', selectedPatientId] });
      void queryClient.invalidateQueries({ queryKey: ['program-exercises', selectedPatientId] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteProgram = useCallback((program: ExerciseProgram) => {
    Alert.alert(
      'Delete Program 刪除計劃',
      `Are you sure you want to delete "${program.name_en}"?\n確定要刪除「${program.name_en}」嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        {
          text: 'Delete 刪除',
          style: 'destructive',
          onPress: () => deleteProgramMutation.mutate(program.id),
        },
      ]
    );
  }, [deleteProgramMutation]);

  const handleProgramSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['programs', selectedPatientId] });
    void queryClient.invalidateQueries({ queryKey: ['program-exercises', selectedPatientId] });
  }, [queryClient, selectedPatientId]);

  const renderProgram = useCallback(
    ({ item }: { item: ExerciseProgram }) => {
      const exercises = programExercisesQuery.data?.[item.id] || [];
      return (
        <ProgramCardWithObjectives
          program={item}
          exerciseCount={exercises.length}
          onPress={() => setEditingProgram(item)}
          onDelete={() => handleDeleteProgram(item)}
          patientId={selectedPatientId!}
          isAdmin={isAdmin}
        />
      );
    },
    [programExercisesQuery.data, handleDeleteProgram, selectedPatientId, isAdmin]
  );

  const keyExtractor = useCallback((item: ExerciseProgram) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Programs 計劃</Text>
        <Text style={styles.headerCount}>
          {programsQuery.data?.length ?? 0} program{(programsQuery.data?.length ?? 0) !== 1 ? 's' : ''}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.patientSelector}
        onPress={() => setShowPatientPicker(true)}
        activeOpacity={0.7}
        testID="patient-selector"
      >
        <View style={styles.patientSelectorLeft}>
          <View style={styles.patientSelectorIcon}>
            <ClipboardList size={18} color={Colors.accent} />
          </View>
          <View>
            <Text style={styles.patientSelectorLabel}>Select Patient 選擇患者</Text>
            {selectedPatient ? (
              <Text style={styles.patientSelectorValue} numberOfLines={1}>
                {selectedPatient.patient_name}
                <Text style={styles.patientSelectorCode}> ({selectedPatient.access_code})</Text>
              </Text>
            ) : (
              <Text style={styles.patientSelectorPlaceholder}>Tap to select a patient...</Text>
            )}
          </View>
        </View>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      {!selectedPatientId ? (
        <View style={styles.emptyContainer}>
          <ClipboardList size={48} color={Colors.borderLight} />
          <Text style={styles.emptyText}>Select a patient to view programs</Text>
          <Text style={styles.emptyTextZh}>請先選擇患者以查看計劃</Text>
        </View>
      ) : programsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading programs...</Text>
        </View>
      ) : programsQuery.isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load programs</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void programsQuery.refetch()}
          >
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={programsQuery.data}
          renderItem={renderProgram}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={programsQuery.isRefetching}
              onRefresh={() => {
                void programsQuery.refetch();
                void programExercisesQuery.refetch();
              }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ClipboardList size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No programs yet</Text>
              <Text style={styles.emptyTextZh}>尚無計劃</Text>
            </View>
          }
        />
      )}

      {(isAdmin || canCreatePrograms) && selectedPatientId && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 24 }]}
          onPress={() => {
            setEditingProgram(null);
            setShowNewProgramModal(true);
          }}
          activeOpacity={0.85}
          testID="add-program-button"
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}

      <PatientPickerModal
        visible={showPatientPicker}
        patients={patientsQuery.data || []}
        selectedId={selectedPatientId}
        onSelect={(id) => {
          setSelectedPatientId(id);
          setShowPatientPicker(false);
        }}
        onClose={() => setShowPatientPicker(false)}
      />

      {(showNewProgramModal || editingProgram) && (
        <ProgramFormModal
          visible={showNewProgramModal || !!editingProgram}
          onClose={() => {
            setShowNewProgramModal(false);
            setEditingProgram(null);
          }}
          patientId={selectedPatientId!}
          program={editingProgram}
          isAdmin={isAdmin}
          clinicianId={clinician?.id}
          onSaved={handleProgramSaved}
        />
      )}
    </View>
  );
}

function ProgramCardWithObjectives({
  program,
  exerciseCount,
  onPress,
  onDelete,
  patientId,
  isAdmin,
}: {
  program: ExerciseProgram;
  exerciseCount: number;
  onPress: () => void;
  onDelete: () => void;
  patientId: string;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<ProgramObjective | null>(null);

  const objectivesQuery = useQuery({
    queryKey: ['program-objectives', program.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('program_objectives')
          .select('*')
          .eq('program_id', program.id)
          .order('sort_order', { ascending: true });
        if (error) {
          console.log('Program objectives fetch error:', error);
          return [];
        }
        return (data || []) as ProgramObjective[];
      } catch (e) {
        console.log('Program objectives exception:', e);
        return [];
      }
    },
  });

  const saveObjectiveMutation = useMutation({
    mutationFn: async (formData: { id?: string; objective_en: string; objective_zh_hant: string; objective_zh_hans: string; sort_order: number; is_active: boolean }) => {
      const payload = {
        program_id: program.id,
        patient_id: patientId,
        objective_en: formData.objective_en,
        objective_zh_hant: formData.objective_zh_hant || null,
        objective_zh_hans: formData.objective_zh_hans || null,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      if (formData.id) {
        const { error } = await supabase.from('program_objectives').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('program_objectives').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setShowObjectiveModal(false);
      setEditingObjective(null);
      void queryClient.invalidateQueries({ queryKey: ['program-objectives', program.id] });
      Alert.alert('Saved \u5df2\u5132\u5b58', 'Objective saved.\n\u76ee\u6a19\u5df2\u5132\u5b58\u3002');
    },
    onError: (error: Error) => {
      console.log('Save program objective error:', error);
      Alert.alert('Error \u932f\u8aa4', error.message);
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: string) => {
      const { error } = await supabase.from('program_objectives').delete().eq('id', objectiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program-objectives', program.id] });
    },
    onError: (error: Error) => {
      Alert.alert('Error \u932f\u8aa4', error.message);
    },
  });

  const handleDeleteObjective = useCallback((obj: ProgramObjective) => {
    Alert.alert(
      'Delete Objective \u522a\u9664\u76ee\u6a19',
      `Delete "${obj.objective_en}"?\n\u522a\u9664\u300c${obj.objective_en}\u300d\uff1f`,
      [
        { text: 'Cancel \u53d6\u6d88', style: 'cancel' },
        { text: 'Delete \u522a\u9664', style: 'destructive', onPress: () => deleteObjectiveMutation.mutate(obj.id) },
      ]
    );
  }, [deleteObjectiveMutation]);

  const objCount = objectivesQuery.data?.length ?? 0;

  return (
    <View>
      <ProgramCard
        program={program}
        exerciseCount={exerciseCount}
        onPress={onPress}
        onDelete={onDelete}
      />

      <View style={styles.programObjectivesContainer}>
        <TouchableOpacity
          style={styles.programObjectivesHeader}
          onPress={() => setObjectivesExpanded(!objectivesExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.programObjectivesHeaderLeft}>
            <Target size={14} color="#6366F1" />
            <Text style={styles.programObjectivesTitle}>Objectives \u76ee\u6a19</Text>
            <View style={styles.programObjectivesCount}>
              <Text style={styles.programObjectivesCountText}>{objCount}</Text>
            </View>
          </View>
          <View style={styles.programObjectivesHeaderRight}>
            <TouchableOpacity
              style={styles.programObjectivesAddBtn}
              onPress={() => { setEditingObjective(null); setShowObjectiveModal(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Plus size={13} color={Colors.white} />
            </TouchableOpacity>
            {objectivesExpanded ? (
              <ChevronUp size={15} color={Colors.textTertiary} />
            ) : (
              <ChevronDown size={15} color={Colors.textTertiary} />
            )}
          </View>
        </TouchableOpacity>

        {objectivesExpanded && (
          <View style={styles.programObjectivesList}>
            {objectivesQuery.isLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 8 }} />
            ) : objCount === 0 ? (
              <Text style={styles.programObjectivesEmpty}>No objectives \u5c1a\u7121\u76ee\u6a19</Text>
            ) : (
              objectivesQuery.data?.map((obj, idx) => (
                <View key={obj.id} style={[styles.programObjectiveRow, !obj.is_active && { opacity: 0.5 }]}>
                  <View style={styles.programObjectiveOrderBadge}>
                    <Text style={styles.programObjectiveOrderText}>{obj.sort_order ?? idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.programObjectiveText} numberOfLines={2}>{obj.objective_en}</Text>
                    {obj.objective_zh_hant ? (
                      <Text style={styles.programObjectiveTextZh} numberOfLines={1}>{obj.objective_zh_hant}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setEditingObjective(obj); setShowObjectiveModal(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Pencil size={13} color={Colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteObjective(obj)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={13} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </View>

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
        title={editingObjective ? 'Edit Objective \u7de8\u8f2f\u76ee\u6a19' : 'New Objective \u65b0\u76ee\u6a19'}
      />
    </View>
  );
}

const ProgramCard = React.memo(function ProgramCard({
  program,
  exerciseCount,
  onPress,
  onDelete,
}: {
  program: ExerciseProgram;
  exerciseCount: number;
  onPress: () => void;
  onDelete: () => void;
}) {
  const scheduleLabel = getScheduleLabel(program);
  const isExpired = program.expiry_date ? new Date(program.expiry_date) < new Date() : false;
  const isActive = program.is_active !== false && !isExpired;

  return (
    <TouchableOpacity
      style={[styles.programCard, !isActive && styles.programCardInactive]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`program-card-${program.id}`}
    >
      <View style={styles.programCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.programName} numberOfLines={2}>
            {program.name_en}
            {program.name_zh_hant ? ` ${program.name_zh_hant}` : ''}
          </Text>
        </View>
        <View style={styles.programCardActions}>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <Trash2 size={15} color={Colors.danger} />
          </TouchableOpacity>
          <ChevronRight size={16} color={Colors.textTertiary} />
        </View>
      </View>

      <View style={styles.programBadges}>
        <View style={[styles.scheduleBadge, program.schedule_type === 'daily' ? styles.dailyBadge : styles.customBadge]}>
          <Calendar size={11} color={program.schedule_type === 'daily' ? Colors.info : Colors.accent} />
          <Text style={[styles.scheduleBadgeText, { color: program.schedule_type === 'daily' ? Colors.info : Colors.accent }]}>
            {scheduleLabel}
          </Text>
        </View>
        <View style={styles.exerciseCountBadge}>
          <Dumbbell size={11} color={Colors.textSecondary} />
          <Text style={styles.exerciseCountText}>
            {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {isExpired && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>Expired 已過期</Text>
          </View>
        )}
        {!isActive && !isExpired && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive 停用</Text>
          </View>
        )}
      </View>

      <View style={styles.programDates}>
        <View style={styles.dateItem}>
          <Clock size={12} color={Colors.textTertiary} />
          <Text style={styles.dateLabel}>Issue 發出:</Text>
          <Text style={styles.dateValue}>{formatDate(program.issue_date)}</Text>
        </View>
        <View style={styles.dateItem}>
          <Clock size={12} color={Colors.textTertiary} />
          <Text style={styles.dateLabel}>Expiry 到期:</Text>
          <Text style={styles.dateValue}>{formatDate(program.expiry_date)}</Text>
        </View>
      </View>

      {program.remarks && (
        <Text style={styles.programRemarks} numberOfLines={2}>
          {program.remarks}
        </Text>
      )}
    </TouchableOpacity>
  );
});

function PatientPickerModal({
  visible,
  patients,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  patients: Pick<Patient, 'id' | 'patient_name' | 'access_code' | 'is_frozen'>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const lower = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.patient_name?.toLowerCase().includes(lower) ||
        p.access_code?.toLowerCase().includes(lower)
    );
  }, [patients, search]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerModal}>
          <Text style={styles.pickerTitle}>Select Patient 選擇患者</Text>
          <View style={styles.pickerSearchBar}>
            <Search size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search..."
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
          <ScrollView style={styles.pickerList} bounces={false}>
            {filtered.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.pickerOption,
                  selectedId === patient.id && styles.pickerOptionSelected,
                ]}
                onPress={() => onSelect(patient.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedId === patient.id && styles.pickerOptionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {patient.patient_name}
                  </Text>
                  <Text style={styles.pickerOptionCode}>{patient.access_code}</Text>
                </View>
                {selectedId === patient.id && <Check size={16} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <Text style={styles.pickerEmpty}>No patients found</Text>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function ProgramFormModal({
  visible,
  onClose,
  patientId,
  program,
  isAdmin,
  clinicianId,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  patientId: string;
  program: ExerciseProgram | null;
  isAdmin: boolean;
  clinicianId?: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!program;

  const [name, setName] = useState(program?.name_en || '');
  const [nameZh, setNameZh] = useState(program?.name_zh_hant || '');
  const [nameZhCn, setNameZhCn] = useState(program?.name_zh_hans || '');
  const [issueDate, setIssueDate] = useState(program?.issue_date || new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(program?.expiry_date || '');
  const [scheduleType, setScheduleType] = useState<'daily' | 'custom'>(program?.schedule_type || 'daily');
  const [customDays, setCustomDays] = useState<boolean[]>(program?.custom_days || [false, true, true, true, true, true, false]);
  const [sortOrder, setSortOrder] = useState(String(program?.sort_order ?? 0));
  const [remarks, setRemarks] = useState(program?.remarks || '');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [programExercises, setProgramExercises] = useState<ProgramExerciseItem[]>([]);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);

  const existingExercisesQuery = useQuery({
    queryKey: ['edit-program-exercises', program?.id],
    queryFn: async () => {
      if (!program?.id) return [];
      const { data, error } = await supabase
        .from('exercises')
        .select('*, exercise_library(*)')
        .eq('program_id', program.id)
        .order('sort_order', { ascending: true });
      if (error) {
        console.log('Fetch program exercises error:', error);
        throw error;
      }
      return (data || []) as ProgramExercise[];
    },
    enabled: isEditing && !exercisesLoaded,
  });

  React.useEffect(() => {
    if (existingExercisesQuery.data && !exercisesLoaded) {
      const items: ProgramExerciseItem[] = existingExercisesQuery.data.map((pe) => ({
        id: pe.id,
        exercise_id: pe.exercise_library_id || '',
        title: pe.exercise_library?.title_en || pe.title_en || 'Unknown',
        title_zh: pe.exercise_library?.title_zh_hant || pe.title_zh_hant,
        duration_minutes: pe.exercise_library?.default_duration_minutes || pe.duration_minutes,
        sort_order: pe.sort_order,
        dosage: pe.dosage || '',
        dosage_zh_hant: pe.dosage_zh_hant || '',
        dosage_per_day: String(pe.dosage_per_day ?? ''),
        dosage_days_per_week: String(pe.dosage_days_per_week ?? ''),
        modifications: pe.modifications || '',
      }));
      setProgramExercises(items);
      setExercisesLoaded(true);
    }
  }, [existingExercisesQuery.data, exercisesLoaded]);

  React.useEffect(() => {
    if (!isEditing) {
      setExercisesLoaded(true);
    }
  }, [isEditing]);

  const toggleDay = useCallback((index: number) => {
    setCustomDays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const addExerciseToProgram = useCallback((exercise: Exercise) => {
    setProgramExercises((prev) => {
      if (prev.some((pe) => pe.exercise_id === exercise.id)) return prev;
      return [
        ...prev,
        {
          id: undefined,
          exercise_id: exercise.id,
          title: exercise.title_en,
          title_zh: exercise.title_zh_hant,
          duration_minutes: exercise.default_duration_minutes,
          sort_order: prev.length,
          dosage: '',
          dosage_zh_hant: '',
          dosage_per_day: '',
          dosage_days_per_week: '',
          modifications: '',
        },
      ];
    });
  }, []);

  const removeExercise = useCallback((exerciseId: string) => {
    setProgramExercises((prev) => prev.filter((pe) => pe.exercise_id !== exerciseId));
  }, []);

  const moveExercise = useCallback((index: number, direction: 'up' | 'down') => {
    setProgramExercises((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((pe, i) => ({ ...pe, sort_order: i }));
    });
  }, []);

  const updateExerciseField = useCallback((exerciseId: string, field: string, value: string) => {
    setProgramExercises((prev) =>
      prev.map((pe) =>
        pe.exercise_id === exerciseId ? { ...pe, [field]: value } : pe
      )
    );
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Program name is required');
      if (!expiryDate) throw new Error('Expiry date is required');

      const programData = {
        patient_id: patientId,
        name_en: name.trim(),
        name_zh_hant: nameZh.trim() || null,
        name_zh_hans: nameZhCn.trim() || null,
        schedule_type: scheduleType,
        custom_days: scheduleType === 'custom' ? customDays : null,
        issue_date: issueDate,
        expiry_date: expiryDate,
        sort_order: parseInt(sortOrder, 10) || 0,
        remarks: remarks.trim() || null,
        is_active: true,
        clinician_id: clinicianId || null,
      };

      let programId: string;

      if (isEditing && program) {
        const { error } = await supabase
          .from('exercise_programs')
          .update(programData)
          .eq('id', program.id);
        if (error) throw error;
        programId = program.id;

        const { error: delExError } = await supabase
          .from('exercises')
          .delete()
          .eq('program_id', programId);
        if (delExError) console.log('Delete old exercises error:', delExError);
      } else {
        const { data: inserted, error } = await supabase
          .from('exercise_programs')
          .insert(programData)
          .select()
          .single();
        if (error) throw error;
        programId = inserted.id;
      }

      if (programExercises.length > 0) {
        const exerciseRows = programExercises.map((pe, idx) => ({
          program_id: programId,
          exercise_library_id: pe.exercise_id,
          title_en: pe.title || null,
          title_zh_hant: pe.title_zh || null,
          duration_minutes: pe.duration_minutes || null,
          sort_order: idx,
          dosage: pe.dosage.trim() || null,
          dosage_zh_hant: pe.dosage_zh_hant.trim() || null,
          dosage_per_day: pe.dosage_per_day ? parseInt(pe.dosage_per_day, 10) : null,
          dosage_days_per_week: pe.dosage_days_per_week ? parseInt(pe.dosage_days_per_week, 10) : null,
          modifications: pe.modifications.trim() || null,
          category: null,
        }));

        const { error: exInsertError } = await supabase
          .from('exercises')
          .insert(exerciseRows);
        if (exInsertError) {
          console.log('Insert exercises error:', exInsertError);
          throw exInsertError;
        }
      }

      if (scheduleType === 'custom') {
        if (isEditing && program) {
          await supabase.from('program_schedules').delete().eq('program_id', programId);
        }
        const scheduleRows = customDays.map((active, i) => ({
          program_id: programId,
          day_of_week: i,
          is_active: active,
        }));
        const { error: schError } = await supabase
          .from('program_schedules')
          .insert(scheduleRows);
        if (schError) console.log('Insert schedules error:', schError);
      }

      return programId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['program-exercises'] });
      onSaved();
      onClose();
      Alert.alert(
        'Success 成功',
        isEditing ? 'Program updated.\n計劃已更新。' : 'Program created.\n計劃已建立。'
      );
    },
    onError: (error: Error) => {
      console.log('Save program error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Name 名稱不完整', 'Please enter program name.\n請輸入計劃名稱。');
      return;
    }
    if (!expiryDate) {
      Alert.alert('Missing Expiry 缺少到期日', 'Please set an expiry date.\n請設定到期日。');
      return;
    }
    saveMutation.mutate();
  }, [name, expiryDate, saveMutation]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel 取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Program 編輯計劃' : 'New Program 新計劃'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.modalSave}>Save 儲存</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <FormField label="Program Name 計劃名稱 *" value={name} onChangeText={setName} placeholder="Program name" />
          <FormField label="Chinese Name 中文名稱 (繁)" value={nameZh} onChangeText={setNameZh} placeholder="計劃名稱" />
          <FormField label="Chinese Name 中文名称 (简)" value={nameZhCn} onChangeText={setNameZhCn} placeholder="计划名称" />

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.formLabel}>Issue Date 發出日期 *</Text>
              <TextInput
                style={styles.formInput}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.formLabel}>Expiry Date 到期日 *</Text>
              <TextInput
                style={styles.formInput}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Schedule Type 排程類型</Text>
            <View style={styles.scheduleToggle}>
              <TouchableOpacity
                style={[styles.scheduleOption, scheduleType === 'daily' && styles.scheduleOptionActive]}
                onPress={() => setScheduleType('daily')}
              >
                <Text style={[styles.scheduleOptionText, scheduleType === 'daily' && styles.scheduleOptionTextActive]}>
                  Daily 每日
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scheduleOption, scheduleType === 'custom' && styles.scheduleOptionActive]}
                onPress={() => setScheduleType('custom')}
              >
                <Text style={[styles.scheduleOptionText, scheduleType === 'custom' && styles.scheduleOptionTextActive]}>
                  Custom 自訂
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {scheduleType === 'custom' && (
            <View style={styles.dayCheckboxes}>
              {DAY_LABELS.map((day, i) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, customDays[i] && styles.dayChipActive]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[styles.dayChipText, customDays[i] && styles.dayChipTextActive]}>
                    {day}{'\n'}{DAY_LABELS_ZH[i]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <FormField label="Sort Order 排序" value={sortOrder} onChangeText={setSortOrder} placeholder="0" keyboardType="phone-pad" />
          <FormField label="Remarks 備註" value={remarks} onChangeText={setRemarks} placeholder="Notes about this program" multiline />

          <View style={styles.exercisesSection}>
            <View style={styles.exercisesSectionHeader}>
              <Text style={styles.exercisesSectionTitle}>
                Exercises 運動 ({programExercises.length})
              </Text>
              <TouchableOpacity
                style={styles.addExerciseBtn}
                onPress={() => setShowExercisePicker(true)}
              >
                <Plus size={16} color={Colors.white} />
                <Text style={styles.addExerciseBtnText}>Add 新增</Text>
              </TouchableOpacity>
            </View>

            {programExercises.length === 0 ? (
              <View style={styles.noExercises}>
                <Dumbbell size={32} color={Colors.borderLight} />
                <Text style={styles.noExercisesText}>No exercises added</Text>
              </View>
            ) : (
              programExercises.map((pe, idx) => (
                <ProgramExerciseRow
                  key={pe.exercise_id}
                  item={pe}
                  index={idx}
                  total={programExercises.length}
                  onRemove={() => removeExercise(pe.exercise_id)}
                  onMoveUp={() => moveExercise(idx, 'up')}
                  onMoveDown={() => moveExercise(idx, 'down')}
                  onUpdateField={(field, value) => updateExerciseField(pe.exercise_id, field, value)}
                />
              ))
            )}
          </View>
        </ScrollView>

        <ExercisePickerModal
          visible={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onAdd={addExerciseToProgram}
          addedIds={programExercises.map((pe) => pe.exercise_id)}
          isAdmin={isAdmin}
          clinicianId={clinicianId}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ProgramExerciseItem {
  id?: string;
  exercise_id: string;
  title: string;
  title_zh?: string;
  duration_minutes?: number;
  sort_order: number;
  dosage: string;
  dosage_zh_hant: string;
  dosage_per_day: string;
  dosage_days_per_week: string;
  modifications: string;
}

const ProgramExerciseRow = React.memo(function ProgramExerciseRow({
  item,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateField,
}: {
  item: ProgramExerciseItem;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateField: (field: string, value: string) => void;
}) {
  return (
    <View style={styles.peRow}>
      <View style={styles.peRowHeader}>
        <View style={styles.peReorder}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={index === 0}
            style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
          >
            <Text style={styles.reorderBtnText}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={index === total - 1}
            style={[styles.reorderBtn, index === total - 1 && styles.reorderBtnDisabled]}
          >
            <Text style={styles.reorderBtnText}>▼</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.peTitle} numberOfLines={2}>
            {index + 1}. {item.title}
            {item.title_zh ? ` ${item.title_zh}` : ''}
          </Text>
          {item.duration_minutes && (
            <Text style={styles.peDuration}>
              {item.duration_minutes} min
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.peDosageRow}>
        <View style={[styles.peDosageField, { flex: 2 }]}>
          <Text style={styles.peDosageLabel}>Dosage 劑量</Text>
          <TextInput
            style={styles.peDosageInput}
            value={item.dosage}
            onChangeText={(v) => onUpdateField('dosage', v)}
            placeholder="—"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        <View style={styles.peDosageField}>
          <Text style={styles.peDosageLabel}>Per Day 每日</Text>
          <TextInput
            style={styles.peDosageInput}
            value={item.dosage_per_day}
            onChangeText={(v) => onUpdateField('dosage_per_day', v)}
            placeholder="—"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.peDosageField}>
          <Text style={styles.peDosageLabel}>Days/Wk 週</Text>
          <TextInput
            style={styles.peDosageInput}
            value={item.dosage_days_per_week}
            onChangeText={(v) => onUpdateField('dosage_days_per_week', v)}
            placeholder="—"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <TextInput
        style={styles.peNotesInput}
        value={item.modifications}
        onChangeText={(v) => onUpdateField('modifications', v)}
        placeholder="Modifications 調整..."
        placeholderTextColor={Colors.textTertiary}
        multiline
        numberOfLines={1}
      />
    </View>
  );
});

function ExercisePickerModal({
  visible,
  onClose,
  onAdd,
  addedIds,
  isAdmin,
  clinicianId,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  addedIds: string[];
  isAdmin: boolean;
  clinicianId?: string;
}) {
  const [search, setSearch] = useState('');

  const exercisesQuery = useQuery({
    queryKey: ['picker-exercises', isAdmin, clinicianId],
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from('exercise_library')
          .select('*')
          .eq('is_active', true)
          .order('title_en', { ascending: true });
        if (error) throw error;
        return (data || []) as Exercise[];
      }

      if (!clinicianId) return [];

      const [sharedRes, ownRes] = await Promise.all([
        supabase
          .from('shared_exercises')
          .select('exercise_library_id, exercise_library(*)')
          .eq('clinician_id', clinicianId),
        supabase
          .from('exercise_library')
          .select('*')
          .eq('created_by_clinician_id', clinicianId)
          .eq('is_active', true)
          .order('title_en', { ascending: true }),
      ]);

      const shared: Exercise[] = (sharedRes.data || [])
        .map((se: { exercise_library_id: string; exercise_library: unknown }) => se.exercise_library as Exercise | null)
        .filter(Boolean) as Exercise[];

      const own: Exercise[] = (ownRes.data || []) as Exercise[];
      const map = new Map<string, Exercise>();
      own.forEach((e) => map.set(e.id, e));
      shared.forEach((e) => { if (!map.has(e.id)) map.set(e.id, e); });
      return Array.from(map.values());
    },
    enabled: visible,
  });

  const filtered = useMemo(() => {
    if (!exercisesQuery.data) return [];
    if (!search.trim()) return exercisesQuery.data;
    const lower = search.toLowerCase();
    return exercisesQuery.data.filter(
      (e) =>
        e.title_en?.toLowerCase().includes(lower) ||
        e.title_zh_hant?.toLowerCase().includes(lower)
    );
  }, [exercisesQuery.data, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Done 完成</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Exercises 新增運動</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.pickerSearchContainer}>
          <View style={styles.pickerSearchBarFull}>
            <Search size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search exercises 搜尋運動..."
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
        </View>

        {exercisesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isAdded = addedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.exercisePickerItem, isAdded && styles.exercisePickerItemAdded]}
                  onPress={() => { if (!isAdded) onAdd(item); }}
                  activeOpacity={isAdded ? 1 : 0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exercisePickerTitle} numberOfLines={1}>
                      {item.title_en}
                      {item.title_zh_hant ? ` ${item.title_zh_hant}` : ''}
                    </Text>
                    <View style={styles.exercisePickerMeta}>
                      {item.category && (
                        <Text style={styles.exercisePickerCategory}>{item.category}</Text>
                      )}
                      {item.default_duration_minutes && (
                        <Text style={styles.exercisePickerDuration}>
                          {item.default_duration_minutes} min
                        </Text>
                      )}
                    </View>
                  </View>
                  {isAdded ? (
                    <View style={styles.addedBadge}>
                      <Check size={14} color={Colors.success} />
                    </View>
                  ) : (
                    <View style={styles.addBtn}>
                      <Plus size={16} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No exercises found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function FormField({
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
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="sentences"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  patientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  patientSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  patientSelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientSelectorLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  patientSelectorValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 1,
  },
  patientSelectorCode: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  patientSelectorPlaceholder: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  emptyTextZh: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  programCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  programCardInactive: {
    opacity: 0.65,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  programCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteBtn: {
    padding: 4,
  },
  programName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  programBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dailyBadge: {
    backgroundColor: Colors.infoLight,
  },
  customBadge: {
    backgroundColor: Colors.accentLight + '50',
  },
  scheduleBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  exerciseCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9E3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  exerciseCountText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  expiredBadge: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expiredBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  inactiveBadge: {
    backgroundColor: Colors.frozenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.frozen,
  },
  programDates: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  programRemarks: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  programObjectivesContainer: {
    backgroundColor: Colors.white,
    marginTop: -2,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  programObjectivesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F3FF',
  },
  programObjectivesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  programObjectivesTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4338CA',
  },
  programObjectivesCount: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 0,
    minWidth: 16,
    alignItems: 'center',
  },
  programObjectivesCountText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  programObjectivesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programObjectivesAddBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programObjectivesList: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  programObjectivesEmpty: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  programObjectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  programObjectiveOrderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programObjectiveOrderText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  programObjectiveText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 17,
  },
  programObjectiveTextZh: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  pickerModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: 480,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  pickerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  pickerList: {
    maxHeight: 360,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.accentLight + '40',
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  pickerOptionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  pickerOptionCode: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  pickerEmpty: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  modalCancel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalSave: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  formInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  scheduleToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
  },
  scheduleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  scheduleOptionActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  scheduleOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  scheduleOptionTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  dayCheckboxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  dayChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  dayChipTextActive: {
    color: Colors.white,
  },
  exercisesSection: {
    marginTop: 8,
    gap: 10,
  },
  exercisesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exercisesSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addExerciseBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  noExercises: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
  },
  noExercisesText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  peRow: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  peRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  peReorder: {
    gap: 2,
  },
  reorderBtn: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.25,
  },
  reorderBtnText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  peTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  peDuration: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  peDosageRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  peDosageField: {
    flex: 1,
    gap: 3,
  },
  peDosageLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
  },
  peDosageInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  peNotesInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
    marginTop: 8,
  },
  pickerSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerSearchBarFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  exercisePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  exercisePickerItemAdded: {
    backgroundColor: Colors.successLight + '40',
    borderColor: Colors.success + '30',
  },
  exercisePickerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  exercisePickerMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  exercisePickerCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  exercisePickerDuration: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  addedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
