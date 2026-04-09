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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface FeedbackItem {
  id: string;
  message: string;
  category?: string;
  subject?: string;
  device_info?: string;
  app_version?: string;
  status: string;
  admin_notes?: string;
  patient_id?: string;
  created_at: string;
  patients?: { patient_name?: string };
}

const STATUSES = ['all', 'new', 'read', 'resolved', 'archived'] as const;

function getStatusColor(status: string) {
  switch (status) {
    case 'read': return Colors.info;
    case 'resolved': return Colors.success;
    case 'archived': return Colors.frozen;
    default: return Colors.warning;
  }
}

export default function UserFeedbackScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [editStatus, setEditStatus] = useState('new');

  const feedbackQuery = useQuery({
    queryKey: ['admin-user-feedback'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('user_feedback')
          .select('*, patients(patient_name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as FeedbackItem[];
      } catch (e) {
        console.log('Error fetching user feedback:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!feedbackQuery.data) return [];
    let list = feedbackQuery.data;
    if (statusFilter !== 'all') {
      list = list.filter(f => f.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f =>
        f.message?.toLowerCase().includes(s) ||
        f.patients?.patient_name?.toLowerCase().includes(s) ||
        f.subject?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [feedbackQuery.data, search, statusFilter]);

  const openDetail = useCallback((f: FeedbackItem) => {
    setSelectedFeedback(f);
    setAdminNotes(f.admin_notes || '');
    setEditStatus(f.status || 'new');
    setDetailModal(true);
  }, []);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeedback) return;
      const { error } = await supabase
        .from('user_feedback')
        .update({ status: editStatus, admin_notes: adminNotes })
        .eq('id', selectedFeedback.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-user-feedback'] });
      setDetailModal(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>User Feedback</Text>
            <Text style={styles.headerSubtitle}>用戶反饋</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search feedback..."
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'all' ? 'All 全部' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={feedbackQuery.isFetching} onRefresh={() => void feedbackQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {feedbackQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No feedback found</Text>
        ) : (
          filtered.map(f => {
            const patientName = f.patients?.patient_name || 'Unknown';
            return (
              <TouchableOpacity key={f.id} style={styles.card} onPress={() => openDetail(f)} activeOpacity={0.7}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardPatient}>{patientName}</Text>
                    <Text style={styles.cardText} numberOfLines={2}>{f.message}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(f.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(f.status) }]}>{f.status}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  {f.category && <View style={[styles.statusBadge, { backgroundColor: Colors.infoLight }]}><Text style={[styles.statusBadgeText, { color: Colors.info }]}>{f.category}</Text></View>}
                  <Text style={styles.cardDate}>{new Date(f.created_at).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Feedback Detail</Text>
              <TouchableOpacity onPress={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {selectedFeedback && (
                <>
                  <Text style={styles.fieldLabel}>Patient 患者</Text>
                  <Text style={styles.detailText}>
                    {selectedFeedback.patients?.patient_name || 'Unknown'}
                  </Text>

                  {selectedFeedback.category && (
                    <>
                      <Text style={styles.fieldLabel}>Category 類別</Text>
                      <Text style={styles.detailText}>{selectedFeedback.category}</Text>
                    </>
                  )}

                  {selectedFeedback.subject && (
                    <>
                      <Text style={styles.fieldLabel}>Subject 主題</Text>
                      <Text style={styles.detailText}>{selectedFeedback.subject}</Text>
                    </>
                  )}

                  <Text style={styles.fieldLabel}>Feedback 反饋</Text>
                  <Text style={styles.feedbackFullText}>{selectedFeedback.message}</Text>

                  <Text style={styles.fieldLabel}>Status 狀態</Text>
                  <View style={styles.statusPicker}>
                    {(['new', 'read', 'resolved', 'archived'] as const).map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusOption, editStatus === s && { backgroundColor: getStatusColor(s), borderColor: getStatusColor(s) }]}
                        onPress={() => setEditStatus(s)}
                      >
                        <Text style={[styles.statusOptionText, editStatus === s && { color: Colors.white }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Admin Notes 管理員備註</Text>
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                    placeholder="Add notes..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                  />

                  <Text style={styles.dateLabel}>Created: {new Date(selectedFeedback.created_at).toLocaleString()}</Text>
                </>
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
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  filterRow: { maxHeight: 48, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  filterChipTextActive: { color: Colors.white },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardPatient: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  cardText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 11, color: Colors.textTertiary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
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
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 16 },
  detailText: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  feedbackFullText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  statusPicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const, textTransform: 'capitalize' as const },
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
  dateLabel: { fontSize: 12, color: Colors.textTertiary, marginTop: 20 },
});

