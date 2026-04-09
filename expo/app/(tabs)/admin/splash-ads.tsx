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
  Image,
  Switch,
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
  Megaphone,
  ImageIcon,
  Calendar,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface SplashAd {
  id: string;
  title: string;
  image_url: string;
  link_url?: string;
  display_duration_seconds: number;
  target_type: string;
  start_date?: string;
  end_date?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const TARGET_TYPES = ['all', 'new_user', 'returning'] as const;

function getTargetColor(t: string) {
  switch (t) {
    case 'new_user': return Colors.info;
    case 'returning': return '#7C5CFC';
    default: return Colors.success;
  }
}

export default function SplashAdsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [displayDuration, setDisplayDuration] = useState('5');
  const [targetType, setTargetType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const adsQuery = useQuery({
    queryKey: ['admin-splash-ads'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('splash_ads')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as SplashAd[];
      } catch (e) {
        console.log('Error fetching splash ads:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!adsQuery.data) return [];
    if (!search.trim()) return adsQuery.data;
    const s = search.toLowerCase();
    return adsQuery.data.filter(a => a.title?.toLowerCase().includes(s));
  }, [adsQuery.data, search]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle('');
    setImageUrl('');
    setLinkUrl('');
    setDisplayDuration('5');
    setTargetType('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('0');
    setIsActive(true);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((ad: SplashAd) => {
    setEditingId(ad.id);
    setTitle(ad.title || '');
    setImageUrl(ad.image_url || '');
    setLinkUrl(ad.link_url || '');
    setDisplayDuration(String(ad.display_duration_seconds ?? 5));
    setTargetType(ad.target_type || 'all');
    setStartDate(ad.start_date || '');
    setEndDate(ad.end_date || '');
    setSortOrder(String(ad.sort_order ?? 0));
    setIsActive(ad.is_active ?? true);
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const payload: Record<string, unknown> = {
        title: title.trim(),
        image_url: imageUrl.trim(),
        link_url: linkUrl.trim() || null,
        display_duration_seconds: parseInt(displayDuration, 10) || 5,
        target_type: targetType,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: isActive,
      };
      if (editingId) {
        const { error } = await supabase.from('splash_ads').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('splash_ads').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-splash-ads'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('splash_ads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-splash-ads'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Ad 刪除廣告', 'Are you sure? 確定刪除？', [
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
            <Text style={styles.headerTitle}>Splash Ads</Text>
            <Text style={styles.headerSubtitle}>啟動廣告</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ads..."
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
          <RefreshControl refreshing={adsQuery.isFetching} onRefresh={() => void adsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {adsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Megaphone size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No splash ads found</Text>
            <Text style={styles.emptySubtext}>找不到啟動廣告</Text>
          </View>
        ) : (
          filtered.map(ad => (
            <TouchableOpacity key={ad.id} style={styles.card} onPress={() => openEdit(ad)} activeOpacity={0.7}>
              {ad.image_url ? (
                <Image source={{ uri: ad.image_url }} style={styles.cardThumb} resizeMode="cover" />
              ) : (
                <View style={styles.cardThumbPlaceholder}>
                  <ImageIcon size={28} color={Colors.textTertiary} />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{ad.title}</Text>
                  <TouchableOpacity onPress={() => confirmDelete(ad.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardMeta}>
                  <View style={[styles.targetBadge, { backgroundColor: getTargetColor(ad.target_type) + '18' }]}>
                    <Text style={[styles.targetBadgeText, { color: getTargetColor(ad.target_type) }]}>{ad.target_type}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: ad.is_active ? Colors.success : Colors.frozen }]} />
                  <Text style={styles.statusLabel}>{ad.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                <View style={styles.cardDateRow}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.cardDateText}>
                    {ad.start_date || '—'} → {ad.end_date || '—'}
                  </Text>
                  <Text style={styles.sortLabel}>#{ad.sort_order}</Text>
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Splash Ad</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title 標題 *</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ad title" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Image URL 圖片網址</Text>
              <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              {imageUrl.trim().length > 0 && (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
              )}

              <Text style={styles.fieldLabel}>Link URL 連結網址</Text>
              <TextInput style={styles.input} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <Text style={styles.fieldLabel}>Display Duration (seconds) 顯示時間</Text>
              <TextInput style={styles.input} value={displayDuration} onChangeText={setDisplayDuration} placeholder="5" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Target Type 目標類型</Text>
              <View style={styles.typePicker}>
                {TARGET_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOption, targetType === t && { backgroundColor: getTargetColor(t), borderColor: getTargetColor(t) }]}
                    onPress={() => setTargetType(t)}
                  >
                    <Text style={[styles.typeOptionText, targetType === t && { color: Colors.white }]}>{t.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Start Date 開始日期 (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2025-01-01" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>End Date 結束日期 (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2025-12-31" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Sort Order 排序</Text>
              <TextInput style={styles.input} value={sortOrder} onChangeText={setSortOrder} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
              </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
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
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardThumb: {
    width: '100%',
    height: 80,
  },
  cardThumbPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1, marginRight: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  targetBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  targetBadgeText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: Colors.textSecondary },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDateText: { fontSize: 11, color: Colors.textTertiary, flex: 1 },
  sortLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.textTertiary },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 6 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySubtext: { fontSize: 13, color: Colors.textTertiary },
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
  modalContent: { padding: 20, paddingBottom: 40 },
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
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
});

