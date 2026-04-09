import React, { useState, useCallback } from 'react';
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
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  ChevronUp,
  ChevronDown,
  X,
  Trash2,
  Eye,
  Star,
  ExternalLink,
  MessageSquare,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { ExerciseVideoSubmission } from '@/types';

interface Props {
  patientId: string;
  patientName: string;
}

const STATUS_CONFIG: Record<string, { label: string; labelZh: string; bg: string; color: string }> = {
  pending: { label: 'Pending', labelZh: '待審', bg: '#FFF8E1', color: '#F59E0B' },
  reviewed: { label: 'Reviewed', labelZh: '已審', bg: '#E8F5E9', color: '#22C55E' },
  redo_requested: { label: 'Redo', labelZh: '重做', bg: '#FFEBEE', color: '#EF4444' },
};

export default function VideoSubmissions({ patientId, patientName }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [reviewingSubmission, setReviewingSubmission] = useState<ExerciseVideoSubmission | null>(null);

  const submissionsQuery = useQuery({
    queryKey: ['video-submissions', patientId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_video_submissions')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Video submissions fetch error:', error);
          return [];
        }
        return (data || []) as ExerciseVideoSubmission[];
      } catch (e) {
        console.log('Video submissions exception:', e);
        return [];
      }
    },
    enabled: !!patientId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase
        .from('exercise_video_submissions')
        .delete()
        .eq('id', subId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-submissions', patientId] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDelete = useCallback((sub: ExerciseVideoSubmission) => {
    Alert.alert(
      'Delete Submission 刪除提交',
      `Delete video submission for "${sub.exercise_title_en}"?\n刪除「${sub.exercise_title_en}」的影片提交？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteMutation.mutate(sub.id) },
      ]
    );
  }, [deleteMutation]);

  const handleOpenVideo = useCallback((url: string) => {
    try {
      void Linking.openURL(url);
    } catch (e) {
      console.log('Open video URL error:', e);
      Alert.alert('Error 錯誤', 'Could not open video URL');
    }
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const count = submissionsQuery.data?.length ?? 0;

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <Video size={18} color="#D97706" />
          <Text style={styles.sectionTitle}>Video Submissions 影片提交</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={Colors.textTertiary} />
        ) : (
          <ChevronDown size={18} color={Colors.textTertiary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionBody}>
          {submissionsQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 16 }} />
          ) : count === 0 ? (
            <View style={styles.emptyContainer}>
              <Video size={32} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No video submissions yet 尚無影片提交</Text>
            </View>
          ) : (
            submissionsQuery.data?.map((sub) => {
              const statusConf = STATUS_CONFIG[sub.review_status] || STATUS_CONFIG.pending;
              return (
                <View key={sub.id} style={styles.submissionCard}>
                  <View style={styles.submissionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.submissionTitle} numberOfLines={1}>
                        {sub.exercise_title_en}
                      </Text>
                      <Text style={styles.submissionDate}>
                        {formatDate(sub.submission_date || sub.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                      <Text style={[styles.statusText, { color: statusConf.color }]}>
                        {statusConf.label} {statusConf.labelZh}
                      </Text>
                    </View>
                  </View>

                  {sub.rating != null && sub.rating > 0 && (
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          color={s <= (sub.rating ?? 0) ? '#F59E0B' : Colors.border}
                          fill={s <= (sub.rating ?? 0) ? '#F59E0B' : 'transparent'}
                        />
                      ))}
                      <Text style={styles.ratingText}>{sub.rating}/5</Text>
                    </View>
                  )}

                  {sub.reviewer_notes ? (
                    <View style={styles.notesRow}>
                      <MessageSquare size={12} color={Colors.textTertiary} />
                      <Text style={styles.notesText} numberOfLines={2}>{sub.reviewer_notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.submissionActions}>
                    {sub.video_url ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleOpenVideo(sub.video_url)}
                        activeOpacity={0.7}
                      >
                        <ExternalLink size={14} color={Colors.info} />
                        <Text style={[styles.actionBtnText, { color: Colors.info }]}>Watch 觀看</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setReviewingSubmission(sub)}
                      activeOpacity={0.7}
                    >
                      <Eye size={14} color="#7C3AED" />
                      <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>Review 審核</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDelete(sub)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                      <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Delete 刪除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      <ReviewModal
        visible={!!reviewingSubmission}
        onClose={() => setReviewingSubmission(null)}
        submission={reviewingSubmission}
        patientId={patientId}
      />
    </View>
  );
}

function ReviewModal({
  visible,
  onClose,
  submission,
  patientId,
}: {
  visible: boolean;
  onClose: () => void;
  submission: ExerciseVideoSubmission | null;
  patientId: string;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'reviewed' | 'redo_requested'>('reviewed');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (visible && submission) {
      setStatus(
        submission.review_status === 'redo_requested' ? 'redo_requested' : 'reviewed'
      );
      setRating(submission.rating ?? 0);
      setNotes(submission.reviewer_notes || '');
    }
  }, [visible, submission]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!submission) throw new Error('No submission selected');
      const { error } = await supabase
        .from('exercise_video_submissions')
        .update({
          review_status: status,
          rating: rating > 0 ? rating : null,
          reviewer_notes: notes.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-submissions', patientId] });
      onClose();
      Alert.alert('Saved 已儲存', 'Review saved.\n審核已儲存。');
    },
    onError: (error: Error) => {
      console.log('Save review error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  if (!submission) return null;

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
          <Text style={styles.modalTitle}>Review 審核</Text>
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
          <View style={styles.reviewInfoCard}>
            <Text style={styles.reviewInfoTitle}>{submission.exercise_title_en}</Text>
            <Text style={styles.reviewInfoDate}>
              Submitted: {submission.submission_date || submission.created_at?.split('T')[0] || '—'}
            </Text>
            {submission.video_url ? (
              <TouchableOpacity
                style={styles.watchBtn}
                onPress={() => {
                  try { void Linking.openURL(submission.video_url); } catch { /* */ }
                }}
                activeOpacity={0.7}
              >
                <ExternalLink size={16} color={Colors.white} />
                <Text style={styles.watchBtnText}>Watch Video 觀看影片</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Status 狀態</Text>
            <View style={styles.statusToggle}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'reviewed' && styles.statusOptionReviewed,
                ]}
                onPress={() => setStatus('reviewed')}
              >
                <Text style={[
                  styles.statusOptionText,
                  status === 'reviewed' && styles.statusOptionTextActive,
                ]}>
                  Reviewed 已審
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'redo_requested' && styles.statusOptionRedo,
                ]}
                onPress={() => setStatus('redo_requested')}
              >
                <Text style={[
                  styles.statusOptionText,
                  status === 'redo_requested' && styles.statusOptionRedoText,
                ]}>
                  Request Redo 要求重做
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Rating 評分 (1-5)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRating(s === rating ? 0 : s)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Star
                    size={32}
                    color={s <= rating ? '#F59E0B' : Colors.border}
                    fill={s <= rating ? '#F59E0B' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
              {rating > 0 && (
                <Text style={styles.ratingLabel}>{rating}/5</Text>
              )}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Reviewer Notes 審核備註</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 100, textAlignVertical: 'top' as const }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Feedback for the patient..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={5}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#FFFBEB',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  countBadge: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  sectionBody: {
    padding: 10,
    gap: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  submissionCard: {
    backgroundColor: '#FAFAF9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  submissionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  submissionDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400E',
    marginLeft: 4,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 2,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  submissionActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
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
    gap: 20,
    paddingBottom: 60,
  },
  reviewInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reviewInfoTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  reviewInfoDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  watchBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  formField: {
    gap: 8,
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
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
  },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusOptionReviewed: {
    backgroundColor: '#DCFCE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statusOptionRedo: {
    backgroundColor: '#FEE2E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  statusOptionTextActive: {
    color: '#16A34A',
    fontWeight: '600' as const,
  },
  statusOptionRedoText: {
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
    marginLeft: 8,
  },
});
