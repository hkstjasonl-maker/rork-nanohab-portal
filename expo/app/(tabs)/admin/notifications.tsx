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
  Plus,
  Trash2,
  Shield,
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
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
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<string>('info');
  const [clinicianId, setClinicianId] = useState('');

  const notificationsQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as NotificationItem[];
      } catch (e) {
        console.log('Error fetching notifications:', e);
        return [];
      }
    },
    enabled: isAdmin,
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
    setClinicianId('');
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((n: NotificationItem) => {
    setEditingId(n.id);
    setTitle(n.title_en || '');
    setBody(n.body_en || '');
    setType(n.type || 'info');
    setClinicianId('');
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const payload = {
        title_en: title.trim(),
        body_en: body.trim(),
        type,
        is_active: true,
      };
      if (editingId) {
        const { error } = await supabase.from('notifications').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('notifications').insert(payload);
        if (error) throw error;
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
                  <Text style={styles.cardDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
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

              <Text style={styles.fieldLabel}>Target Type 目標類型</Text>
              <TextInput
                style={styles.input}
                value={clinicianId}
                onChangeText={setClinicianId}
                placeholder="all / clinician / patient"
                placeholderTextColor={Colors.textTertiary}
              />
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
});

