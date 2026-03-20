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
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Shield,
  CheckCircle,
  XCircle,
  Video,
  Headphones,
  Subtitles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface MediaRequest {
  id: string;
  exercise_library_id: string;
  clinician_id: string;
  video_url?: string;
  request_video: boolean;
  request_audio: boolean;
  request_subtitle: boolean;
  request_live_subtitles: boolean;
  declaration_accepted?: boolean;
  notes?: string;
  status: string;
  rejection_reason?: string;
  reviewed_at?: string;
  created_at: string;
  exercise_library?: { title_en: string; title_zh_hant?: string };
  clinicians?: { full_name: string; full_name_zh?: string };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved': return { color: Colors.success, bg: Colors.successLight, label: 'Approved 已批准' };
    case 'rejected': return { color: Colors.danger, bg: Colors.dangerLight, label: 'Rejected 已拒絕' };
    default: return { color: Colors.warning, bg: Colors.warningLight, label: 'Pending 待審核' };
  }
}

export default function MediaRequestsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingExerciseId, setRejectingExerciseId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['admin-media-requests'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_media_requests')
          .select('*, exercise_library(title_en, title_zh_hant), clinicians(full_name, full_name_zh)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as MediaRequest[];
      } catch (e) {
        console.log('Error fetching media requests:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!requestsQuery.data) return [];
    if (!search.trim()) return requestsQuery.data;
    const s = search.toLowerCase();
    return requestsQuery.data.filter(r =>
      r.exercise_library?.title_en?.toLowerCase().includes(s) ||
      r.clinicians?.full_name?.toLowerCase().includes(s) ||
      r.notes?.toLowerCase().includes(s)
    );
  }, [requestsQuery.data, search]);

  const approveMutation = useMutation({
    mutationFn: async ({ id, exerciseId }: { id: string; exerciseId: string }) => {
      const { error: reqError } = await supabase
        .from('exercise_media_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (reqError) throw reqError;
      const { error: exError } = await supabase
        .from('exercise_library')
        .update({ media_status: 'active' })
        .eq('id', exerciseId);
      if (exError) throw exError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-media-requests'] });
      Alert.alert('Approved', 'Media request approved and exercise activated');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectingId || !rejectingExerciseId) throw new Error('Invalid state');
      const { error: reqError } = await supabase
        .from('exercise_media_requests')
        .update({ status: 'rejected', rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() })
        .eq('id', rejectingId);
      if (reqError) throw reqError;
      const { error: exError } = await supabase
        .from('exercise_library')
        .update({ media_status: 'rejected' })
        .eq('id', rejectingExerciseId);
      if (exError) throw exError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-media-requests'] });
      setRejectModalVisible(false);
      setRejectionReason('');
      Alert.alert('Rejected', 'Media request rejected');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleApprove = useCallback((id: string, exerciseId: string) => {
    Alert.alert('Approve Request 批准申請', 'Approve this media request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMutation.mutate({ id, exerciseId }) },
    ]);
  }, [approveMutation]);

  const handleRejectOpen = useCallback((id: string, exerciseId: string) => {
    setRejectingId(id);
    setRejectingExerciseId(exerciseId);
    setRejectionReason('');
    setRejectModalVisible(true);
  }, []);

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
            <Text style={styles.headerTitle}>Media Requests</Text>
            <Text style={styles.headerSubtitle}>媒體申請</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search requests..."
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
          <RefreshControl refreshing={requestsQuery.isFetching} onRefresh={() => void requestsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {requestsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No media requests found</Text>
        ) : (
          filtered.map(r => {
            const badge = getStatusBadge(r.status);
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.exercise_library?.title_en || 'Unknown Exercise'}</Text>
                    <Text style={styles.cardClinician}>by {r.clinicians?.full_name || 'Unknown'}{r.clinicians?.full_name_zh ? ` ${r.clinicians.full_name_zh}` : ''}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.mediaTags}>
                  {r.request_video && (
                    <View style={styles.mediaTag}>
                      <Video size={12} color={Colors.info} />
                      <Text style={styles.mediaTagText}>Video</Text>
                    </View>
                  )}
                  {r.request_audio && (
                    <View style={styles.mediaTag}>
                      <Headphones size={12} color={Colors.accent} />
                      <Text style={styles.mediaTagText}>Audio</Text>
                    </View>
                  )}
                  {r.request_subtitle && (
                    <View style={styles.mediaTag}>
                      <Subtitles size={12} color={Colors.success} />
                      <Text style={styles.mediaTagText}>Subtitles</Text>
                    </View>
                  )}
                  {r.request_live_subtitles && (
                    <View style={styles.mediaTag}>
                      <Subtitles size={12} color={Colors.warning} />
                      <Text style={styles.mediaTagText}>Live Subs</Text>
                    </View>
                  )}
                </View>

                {r.video_url ? (
                  <Text style={styles.urlText} numberOfLines={1}>URL: {r.video_url}</Text>
                ) : null}

                {r.notes ? (
                  <Text style={styles.notesText} numberOfLines={2}>Notes: {r.notes}</Text>
                ) : null}

                {r.rejection_reason ? (
                  <Text style={styles.rejectionText}>Rejection: {r.rejection_reason}</Text>
                ) : null}

                {r.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(r.id, r.exercise_library_id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle size={16} color={Colors.white} />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectOpen(r.id, r.exercise_library_id)}
                    >
                      <XCircle size={16} color={Colors.white} />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.dateText}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.rejectModal}>
              <Text style={styles.rejectModalTitle}>Reject Request 拒絕申請</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Reason for rejection..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <View style={styles.rejectModalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmRejectBtn}
                  onPress={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.confirmRejectBtnText}>Reject</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardClinician: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' as const },
  mediaTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  mediaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaTagText: { fontSize: 11, color: Colors.textSecondary },
  urlText: { fontSize: 12, color: Colors.info, marginBottom: 4 },
  notesText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  rejectionText: { fontSize: 12, color: Colors.danger, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white },
  dateText: { fontSize: 11, color: Colors.textTertiary, marginTop: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  rejectModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
  },
  rejectModalTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginBottom: 16 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rejectModalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  confirmRejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmRejectBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
});
