import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Calendar,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { ExerciseReviewRequirement } from '@/types';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_ZH = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  programId: string;
  patientId: string;
  isAdmin: boolean;
}

export default function VideoReviewRequirements({ programId, patientId, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReq, setEditingReq] = useState<ExerciseReviewRequirement | null>(null);

  const requirementsQuery = useQuery({
    queryKey: ['video-review-requirements', programId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_review_requirements')
          .select('*')
          .eq('program_id', programId)
          .order('exercise_title_en', { ascending: true });
        if (error) {
          console.log('Video review requirements fetch error:', error);
          return [];
        }
        return (data || []) as ExerciseReviewRequirement[];
      } catch (e) {
        console.log('Video review requirements exception:', e);
        return [];
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase
        .from('exercise_review_requirements')
        .delete()
        .eq('id', reqId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-review-requirements', programId] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDelete = useCallback((req: ExerciseReviewRequirement) => {
    Alert.alert(
      'Delete Requirement 刪除要求',
      `Delete video review requirement for "${req.exercise_title_en}"?\n刪除「${req.exercise_title_en}」的影片審核要求？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteMutation.mutate(req.id) },
      ]
    );
  }, [deleteMutation]);

  const count = requirementsQuery.data?.length ?? 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Video size={14} color="#D97706" />
          <Text style={styles.headerTitle}>Video Review 影片審核</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setEditingReq(null); setShowFormModal(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={13} color={Colors.white} />
          </TouchableOpacity>
          {expanded ? (
            <ChevronUp size={15} color={Colors.textTertiary} />
          ) : (
            <ChevronDown size={15} color={Colors.textTertiary} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {requirementsQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 8 }} />
          ) : count === 0 ? (
            <Text style={styles.emptyText}>No video review requirements 尚無影片審核要求</Text>
          ) : (
            requirementsQuery.data?.map((req) => (
              <View key={req.id} style={[styles.reqRow, !req.is_active && { opacity: 0.5 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle} numberOfLines={1}>{req.exercise_title_en}</Text>
                  <View style={styles.reqMeta}>
                    <Text style={styles.reqMetaText}>
                      Max: {req.max_submissions}/day
                    </Text>
                    {req.allowed_days && req.allowed_days.length > 0 && req.allowed_days.length < 7 && (
                      <Text style={styles.reqMetaText}>
                        {req.allowed_days.map(d => DAY_SHORT[ALL_DAYS.indexOf(d)] || d).join(', ')}
                      </Text>
                    )}
                    {req.allowed_days && req.allowed_days.length === 7 && (
                      <Text style={styles.reqMetaText}>Every day 每天</Text>
                    )}
                  </View>
                  {req.notes ? (
                    <Text style={styles.reqNotes} numberOfLines={1}>{req.notes}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => { setEditingReq(req); setShowFormModal(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Pencil size={13} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(req)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={13} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <RequirementFormModal
        visible={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingReq(null); }}
        programId={programId}
        patientId={patientId}
        existing={editingReq}
      />
    </View>
  );
}

function RequirementFormModal({
  visible,
  onClose,
  programId,
  patientId,
  existing,
}: {
  visible: boolean;
  onClose: () => void;
  programId: string;
  patientId: string;
  existing: ExerciseReviewRequirement | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!existing;

  const [exerciseTitle, setExerciseTitle] = useState(existing?.exercise_title_en || '');
  const [maxSubmissions, setMaxSubmissions] = useState(String(existing?.max_submissions ?? 3));
  const [allowedDays, setAllowedDays] = useState<string[]>(existing?.allowed_days || [...ALL_DAYS]);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);

  React.useEffect(() => {
    if (visible) {
      setExerciseTitle(existing?.exercise_title_en || '');
      setMaxSubmissions(String(existing?.max_submissions ?? 3));
      setAllowedDays(existing?.allowed_days || [...ALL_DAYS]);
      setNotes(existing?.notes || '');
      setIsActive(existing?.is_active ?? true);
    }
  }, [visible, existing]);

  const toggleDay = useCallback((day: string) => {
    setAllowedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!exerciseTitle.trim()) throw new Error('Exercise title is required');

      const payload = {
        program_id: programId,
        patient_id: patientId,
        exercise_title_en: exerciseTitle.trim(),
        max_submissions: parseInt(maxSubmissions, 10) || 3,
        allowed_days: allowedDays,
        notes: notes.trim() || null,
        is_active: isActive,
      };

      if (isEditing && existing) {
        const { error } = await supabase
          .from('exercise_review_requirements')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exercise_review_requirements')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-review-requirements', programId] });
      onClose();
      Alert.alert('Saved 已儲存', isEditing ? 'Requirement updated.\n要求已更新。' : 'Requirement created.\n要求已建立。');
    },
    onError: (error: Error) => {
      console.log('Save video review requirement error:', error);
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
            <X size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Requirement 編輯要求' : 'New Requirement 新要求'}
          </Text>
          <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
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
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Exercise Title 運動名稱 *</Text>
            <TextInput
              style={styles.formInput}
              value={exerciseTitle}
              onChangeText={setExerciseTitle}
              placeholder="Exercise name in English"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Max Submissions/Day 每日最大提交數</Text>
            <TextInput
              style={styles.formInput}
              value={maxSubmissions}
              onChangeText={setMaxSubmissions}
              placeholder="3"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Allowed Days 允許日期</Text>
            <View style={styles.daysRow}>
              {ALL_DAYS.map((day, i) => {
                const selected = allowedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, selected && styles.dayChipActive]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>
                      {DAY_SHORT[i]}{'\n'}{DAY_ZH[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Notes 備註</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top' as const }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.formLabel}>Active 啟用</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    marginTop: -2,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  countBadge: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 5,
    minWidth: 16,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#FEFCE8',
    borderRadius: 8,
  },
  reqTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  reqMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  reqMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  reqNotes: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic' as const,
    marginTop: 2,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
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
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  dayChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },
  dayChipTextActive: {
    color: Colors.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
