import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Plus,
  Trash2,
  Shield,
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Users,
  Check,
  Square,
  CheckSquare,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface NotificationItem {
  id: string;
  title_en: string;
  title_zh?: string;
  body_en: string;
  body_zh?: string;
  type: string;
  target_type?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  created_at: string;
  recipient_count?: number;
}

interface PatientOption {
  id: string;
  patient_name: string;
}

interface RecipientRow {
  id: string;
  notification_id: string;
  patient_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  patients?: { patient_name: string } | null;
}

type TargetType = 'all' | 'specific';

const TYPES = ['info', 'warning', 'success', 'alert'] as const;

function getTypeColor(type: string) {
  switch (type) {
    case 'warning': return Colors.warning;
    case 'success': return Colors.success;
    case 'alert': return Colors.danger;
    default: return Colors.info;
  }
}

function getTypeIcon(type: string, size: number) {
  const color = getTypeColor(type);
  switch (type) {
    case 'warning': return <AlertTriangle size={size} color={color} />;
    case 'success': return <CheckCircle size={size} color={color} />;
    case 'alert': return <AlertCircle size={size} color={color} />;
    default: return <Info size={size} color={color} />;
  }
}

export default function NotificationsManagementScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [recipientsModalVisible, setRecipientsModalVisible] = useState(false);
  const [viewingNotifId, setViewingNotifId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<string>('info');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  const patientsQuery = useQuery({
    queryKey: ['notif-patients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name')
          .eq('is_frozen', false)
          .order('patient_name');
        if (error) throw error;
        return (data || []) as PatientOption[];
      } catch (e) {
        console.log('Error fetching patients for notifications:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const notificationsQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const notifs = (data || []) as NotificationItem[];

        const counts = await Promise.all(
          notifs.map(async (n) => {
            try {
              const { count, error: cErr } = await supabase
                .from('notification_recipients')
                .select('id', { count: 'exact', head: true })
                .eq('notification_id', n.id);
              if (cErr) return { id: n.id, count: 0 };
              return { id: n.id, count: count || 0 };
            } catch {
              return { id: n.id, count: 0 };
            }
          })
        );

        const countMap = new Map(counts.map(c => [c.id, c.count]));
        return notifs.map(n => ({ ...n, recipient_count: countMap.get(n.id) || 0 }));
      } catch (e) {
        console.log('Error fetching notifications:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const recipientsQuery = useQuery({
    queryKey: ['notification-recipients', viewingNotifId],
    queryFn: async () => {
      if (!viewingNotifId) return [];
      try {
        const { data, error } = await supabase
          .from('notification_recipients')
          .select('*, patients(patient_name)')
          .eq('notification_id', viewingNotifId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as RecipientRow[];
      } catch (e) {
        console.log('Error fetching recipients:', e);
        return [];
      }
    },
    enabled: !!viewingNotifId,
  });

  const filtered = useMemo(() => {
    if (!notificationsQuery.data) return [];
    if (!search.trim()) return notificationsQuery.data;
    const s = search.toLowerCase();
    return notificationsQuery.data.filter(n =>
      n.title_en?.toLowerCase().includes(s) || n.body_en?.toLowerCase().includes(s) || n.title_zh?.toLowerCase().includes(s)
    );
  }, [notificationsQuery.data, search]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setType('info');
    setTargetType('all');
    setSelectedPatientIds([]);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((n: NotificationItem) => {
    setEditingId(n.id);
    setTitle(n.title_en || '');
    setBody(n.body_en || '');
    setType(n.type || 'info');
    setTargetType('all');
    setSelectedPatientIds([]);
    setModalVisible(true);
  }, []);

  const openRecipients = useCallback((notifId: string) => {
    setViewingNotifId(notifId);
    setRecipientsModalVisible(true);
  }, []);

  const togglePatient = useCallback((patientId: string) => {
    setSelectedPatientIds(prev =>
      prev.includes(patientId) ? prev.filter(id => id !== patientId) : [...prev, patientId]
    );
  }, []);

  const selectAllPatients = useCallback(() => {
    const all = patientsQuery.data || [];
    setSelectedPatientIds(all.map(p => p.id));
  }, [patientsQuery.data]);

  const deselectAllPatients = useCallback(() => {
    setSelectedPatientIds([]);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      if (targetType === 'specific' && selectedPatientIds.length === 0) {
        throw new Error('Please select at least one patient');
      }
      const payload = {
        title_en: title.trim(),
        body_en: body.trim(),
        type,
        is_active: true,
      };

      let notificationId = editingId;

      if (editingId) {
        const { error } = await supabase.from('notifications').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('notifications').insert(payload).select('id').single();
        if (error) throw error;
        notificationId = data.id;
      }

      if (notificationId) {
        if (!editingId) {
          const patientIds = targetType === 'all'
            ? (patientsQuery.data || []).map(p => p.id)
            : selectedPatientIds;

          if (patientIds.length > 0) {
            const rows = patientIds.map(pid => ({
              notification_id: notificationId as string,
              patient_id: pid,
              is_read: false,
            }));
            const { error: rErr } = await supabase.from('notification_recipients').insert(rows);
            if (rErr) console.log('Error inserting recipients:', rErr);
          }
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const removeRecipientMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase.from('notification_recipients').delete().eq('id', recipientId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-recipients', viewingNotifId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Notification 刪除通知', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }, [deleteMutation]);

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
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>通知管理</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notifications..."
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
          <RefreshControl refreshing={notificationsQuery.isFetching} onRefresh={() => void notificationsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {notificationsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No notifications found</Text>
        ) : (
          filtered.map(n => (
            <TouchableOpacity key={n.id} style={styles.card} onPress={() => openEdit(n)} activeOpacity={0.7}>
              <View style={styles.cardRow}>
                <View style={styles.typeIconWrap}>
                  {getTypeIcon(n.type, 20)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{n.title_en}</Text>
                  <Text style={styles.cardBody} numberOfLines={2}>{n.body_en}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
                    <TouchableOpacity
                      style={styles.recipientBadge}
                      onPress={() => openRecipients(n.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Users size={12} color={Colors.accent} />
                      <Text style={styles.recipientBadgeText}>
                        {n.recipient_count || 0} recipient{(n.recipient_count || 0) !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeColor(n.type) + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: getTypeColor(n.type) }]}>{n.type}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(n.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={recipientsModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setRecipientsModalVisible(false); setViewingNotifId(null); }}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Recipients 收件人</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {recipientsQuery.isLoading ? (
              <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 30 }} />
            ) : (recipientsQuery.data || []).length === 0 ? (
              <Text style={styles.emptyText}>No recipients 無收件人</Text>
            ) : (
              (recipientsQuery.data || []).map(r => (
                <View key={r.id} style={styles.recipientCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientName}>{r.patients?.patient_name || 'Unknown'}</Text>
                    <View style={styles.recipientMeta}>
                      <View style={[styles.readBadge, r.is_read ? styles.readBadgeRead : styles.readBadgeUnread]}>
                        <Text style={[styles.readBadgeText, r.is_read ? styles.readBadgeTextRead : styles.readBadgeTextUnread]}>
                          {r.is_read ? 'Read 已讀' : 'Unread 未讀'}
                        </Text>
                      </View>
                      {r.read_at && (
                        <Text style={styles.readAtText}>{new Date(r.read_at).toLocaleString()}</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Remove Recipient 移除收件人', 'Are you sure? 確定嗎?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeRecipientMutation.mutate(r.id) },
                      ]);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Notification</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Title 標題</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Notification title" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Body 內容</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                value={body}
                onChangeText={setBody}
                placeholder="Notification body"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>Type 類型</Text>
              <View style={styles.typePicker}>
                {TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOption, type === t && { backgroundColor: getTypeColor(t), borderColor: getTypeColor(t) }]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.typeOptionText, type === t && { color: Colors.white }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Recipients 收件人</Text>
              {editingId ? (
                <View style={styles.editRecipientNote}>
                  <Info size={14} color={Colors.textTertiary} />
                  <Text style={styles.editRecipientNoteText}>Tap the recipient badge on the card to manage recipients for existing notifications.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.targetPicker}>
                    <TouchableOpacity
                      style={[styles.targetOption, targetType === 'all' && styles.targetOptionActive]}
                      onPress={() => setTargetType('all')}
                    >
                      <Text style={[styles.targetOptionText, targetType === 'all' && styles.targetOptionTextActive]}>All Patients 全部患者</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.targetOption, targetType === 'specific' && styles.targetOptionActive]}
                      onPress={() => setTargetType('specific')}
                    >
                      <Text style={[styles.targetOptionText, targetType === 'specific' && styles.targetOptionTextActive]}>Specific 指定患者</Text>
                    </TouchableOpacity>
                  </View>

                  {targetType === 'specific' && (
                    <View style={styles.patientSelectionSection}>
                      <View style={styles.selectionActions}>
                        <TouchableOpacity onPress={selectAllPatients} style={styles.selAllBtn}>
                          <Text style={styles.selAllBtnText}>Select All 全選</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={deselectAllPatients} style={styles.selAllBtn}>
                          <Text style={styles.selAllBtnText}>Deselect 取消</Text>
                        </TouchableOpacity>
                        <Text style={styles.selectedCount}>{selectedPatientIds.length} selected</Text>
                      </View>
                      <View style={styles.patientCheckboxList}>
                        {patientsQuery.isLoading ? (
                          <ActivityIndicator size="small" color={Colors.accent} />
                        ) : (patientsQuery.data || []).length === 0 ? (
                          <Text style={styles.emptySmall}>No patients found</Text>
                        ) : (
                          (patientsQuery.data || []).map(p => {
                            const isSelected = selectedPatientIds.includes(p.id);
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={[styles.patientCheckRow, isSelected && styles.patientCheckRowActive]}
                                onPress={() => togglePatient(p.id)}
                                activeOpacity={0.7}
                              >
                                {isSelected ? (
                                  <CheckSquare size={18} color={Colors.accent} />
                                ) : (
                                  <Square size={18} color={Colors.textTertiary} />
                                )}
                                <Text style={[styles.patientCheckName, isSelected && { color: Colors.text }]}>{p.patient_name}</Text>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </View>
                  )}
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
    margin: 16,
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
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
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
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  cardBody: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  cardDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  cardActions: { alignItems: 'flex-end', gap: 10 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' as const },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
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
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
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
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const, textTransform: 'capitalize' as const },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recipientBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent },
  targetPicker: { flexDirection: 'row', gap: 8 },
  targetOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  targetOptionActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  targetOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  targetOptionTextActive: { color: Colors.white },
  patientSelectionSection: { marginTop: 12 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  selAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  selAllBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  selectedCount: { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' as const },
  patientCheckboxList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 260,
    overflow: 'hidden',
  },
  patientCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  patientCheckRowActive: { backgroundColor: Colors.accentLight + '30' },
  patientCheckName: { fontSize: 14, color: Colors.textSecondary },
  emptySmall: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', padding: 20 },
  editRecipientNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 10,
  },
  editRecipientNoteText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recipientName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  recipientMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  readBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  readBadgeRead: { backgroundColor: Colors.successLight },
  readBadgeUnread: { backgroundColor: Colors.warningLight },
  readBadgeText: { fontSize: 11, fontWeight: '600' as const },
  readBadgeTextRead: { color: Colors.success },
  readBadgeTextUnread: { color: Colors.warning },
  readAtText: { fontSize: 11, color: Colors.textTertiary },
});

