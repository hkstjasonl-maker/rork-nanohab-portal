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
  Flower2,
  User,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type TabKey = 'types' | 'patient_flowers';

interface FlowerType {
  id: string;
  name_en: string;
  name_zh: string;
  image_url?: string;
  rarity: string;
  rarity_weight: number;
  description_en?: string;
  description_zh?: string;
  is_active: boolean;
  created_at: string;
}

interface PatientFlower {
  id: string;
  patient_id: string;
  flower_type_id: string;
  acquired_at: string;
  acquired_method: string;
  is_stolen: boolean;
  stolen_at?: string;
  is_displayed: boolean;
  patients?: { patient_name: string };
  flower_types?: { name_en: string; name_zh: string; rarity: string; image_url?: string };
}

const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

function getRarityColor(r: string) {
  switch (r) {
    case 'common': return Colors.success;
    case 'rare': return Colors.info;
    case 'epic': return '#7C5CFC';
    case 'legendary': return Colors.accent;
    default: return Colors.textTertiary;
  }
}

function getMethodColor(m: string) {
  switch (m) {
    case 'earned': return Colors.success;
    case 'purchased': return Colors.info;
    case 'gift': return '#D4A030';
    default: return Colors.textTertiary;
  }
}

export default function FlowerGardenScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('types');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rarity, setRarity] = useState<string>('common');
  const [rarityWeight, setRarityWeight] = useState('10');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [isActive, setIsActive] = useState(true);

  const typesQuery = useQuery({
    queryKey: ['admin-flower-types'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('flower_types')
          .select('*')
          .order('rarity_weight', { ascending: false });
        if (error) throw error;
        return (data || []) as FlowerType[];
      } catch (e) {
        console.log('Error fetching flower types:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientFlowersQuery = useQuery({
    queryKey: ['admin-patient-flowers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patient_flowers')
          .select('*, patients(patient_name), flower_types(name_en, name_zh, rarity, image_url)')
          .order('acquired_at', { ascending: false });
        if (error) throw error;
        return (data || []) as PatientFlower[];
      } catch (e) {
        console.log('Error fetching patient flowers:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'patient_flowers',
  });

  const filteredTypes = useMemo(() => {
    if (!typesQuery.data) return [];
    if (!search.trim()) return typesQuery.data;
    const s = search.toLowerCase();
    return typesQuery.data.filter(t =>
      t.name_en?.toLowerCase().includes(s) || t.name_zh?.includes(s)
    );
  }, [typesQuery.data, search]);

  const filteredPatientFlowers = useMemo(() => {
    if (!patientFlowersQuery.data) return [];
    if (!search.trim()) return patientFlowersQuery.data;
    const s = search.toLowerCase();
    return patientFlowersQuery.data.filter(pf =>
      pf.patients?.patient_name?.toLowerCase().includes(s) ||
      pf.flower_types?.name_en?.toLowerCase().includes(s) ||
      pf.flower_types?.name_zh?.includes(s)
    );
  }, [patientFlowersQuery.data, search]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setNameEn('');
    setNameZh('');
    setImageUrl('');
    setRarity('common');
    setRarityWeight('10');
    setDescEn('');
    setDescZh('');
    setIsActive(true);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((ft: FlowerType) => {
    setEditingId(ft.id);
    setNameEn(ft.name_en || '');
    setNameZh(ft.name_zh || '');
    setImageUrl(ft.image_url || '');
    setRarity(ft.rarity || 'common');
    setRarityWeight(String(ft.rarity_weight ?? 10));
    setDescEn(ft.description_en || '');
    setDescZh(ft.description_zh || '');
    setIsActive(ft.is_active ?? true);
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim()) throw new Error('English name is required');
      const payload: Record<string, unknown> = {
        name_en: nameEn.trim(),
        name_zh: nameZh.trim() || null,
        image_url: imageUrl.trim() || null,
        rarity,
        rarity_weight: parseInt(rarityWeight, 10) || 10,
        description_en: descEn.trim() || null,
        description_zh: descZh.trim() || null,
        is_active: isActive,
      };
      if (editingId) {
        const { error } = await supabase.from('flower_types').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('flower_types').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-flower-types'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flower_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-flower-types'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Flower Type 刪除花朵', 'Are you sure? 確定刪除？', [
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

  const isTypesTab = activeTab === 'types';
  const currentQuery = isTypesTab ? typesQuery : patientFlowersQuery;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Flower Garden</Text>
            <Text style={styles.headerSubtitle}>花田管理</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, isTypesTab && styles.tabItemActive]}
          onPress={() => { setActiveTab('types'); setSearch(''); }}
        >
          <Text style={[styles.tabText, isTypesTab && styles.tabTextActive]}>Flower Types 花朵類型</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, !isTypesTab && styles.tabItemActive]}
          onPress={() => { setActiveTab('patient_flowers'); setSearch(''); }}
        >
          <Text style={[styles.tabText, !isTypesTab && styles.tabTextActive]}>Patient Flowers 患者花朵</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isTypesTab ? 'Search flower types...' : 'Search by patient or flower...'}
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
          <RefreshControl refreshing={currentQuery.isFetching} onRefresh={() => void currentQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : isTypesTab ? (
          filteredTypes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Flower2 size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No flower types found</Text>
              <Text style={styles.emptySubtext}>找不到花朵類型</Text>
            </View>
          ) : (
            filteredTypes.map(ft => (
              <TouchableOpacity key={ft.id} style={styles.card} onPress={() => openEdit(ft)} activeOpacity={0.7}>
                <View style={styles.cardRow}>
                  {ft.image_url ? (
                    <Image source={{ uri: ft.image_url }} style={styles.flowerImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.flowerImgPlaceholder}>
                      <Flower2 size={24} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{ft.name_en}</Text>
                      <TouchableOpacity onPress={() => confirmDelete(ft.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                    {ft.name_zh ? <Text style={styles.cardSubtitle} numberOfLines={1}>{ft.name_zh}</Text> : null}
                    <View style={styles.cardMeta}>
                      <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(ft.rarity) + '18' }]}>
                        <Text style={[styles.rarityBadgeText, { color: getRarityColor(ft.rarity) }]}>{ft.rarity}</Text>
                      </View>
                      <Text style={styles.weightText}>W: {ft.rarity_weight}</Text>
                      <View style={[styles.statusDot, { backgroundColor: ft.is_active ? Colors.success : Colors.frozen }]} />
                      <Text style={styles.statusLabel}>{ft.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          filteredPatientFlowers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <User size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No patient flowers found</Text>
              <Text style={styles.emptySubtext}>找不到患者花朵</Text>
            </View>
          ) : (
            filteredPatientFlowers.map(pf => (
              <View key={pf.id} style={styles.card}>
                <View style={styles.cardRow}>
                  {pf.flower_types?.image_url ? (
                    <Image source={{ uri: pf.flower_types.image_url }} style={styles.flowerImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.flowerImgPlaceholder}>
                      <Flower2 size={24} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{pf.patients?.patient_name || 'Unknown'}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {pf.flower_types?.name_en || '—'}{pf.flower_types?.name_zh ? ` ${pf.flower_types.name_zh}` : ''}
                    </Text>
                    <View style={styles.cardMeta}>
                      {pf.flower_types?.rarity ? (
                        <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(pf.flower_types.rarity) + '18' }]}>
                          <Text style={[styles.rarityBadgeText, { color: getRarityColor(pf.flower_types.rarity) }]}>{pf.flower_types.rarity}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.methodBadge, { backgroundColor: getMethodColor(pf.acquired_method) + '18' }]}>
                        <Text style={[styles.methodBadgeText, { color: getMethodColor(pf.acquired_method) }]}>{pf.acquired_method}</Text>
                      </View>
                      {pf.is_stolen && (
                        <View style={[styles.stolenBadge]}>
                          <Text style={styles.stolenBadgeText}>Stolen</Text>
                        </View>
                      )}
                      {pf.is_displayed && (
                        <View style={[styles.displayedBadge]}>
                          <Text style={styles.displayedBadgeText}>Displayed</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.dateText}>
                      {pf.acquired_at ? new Date(pf.acquired_at).toLocaleDateString() : '—'}
                      {pf.is_stolen && pf.stolen_at ? ` • Stolen ${new Date(pf.stolen_at).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {isTypesTab && (
        <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Flower Type</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Name (EN) 英文名稱 *</Text>
              <TextInput style={styles.input} value={nameEn} onChangeText={setNameEn} placeholder="Rose" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Name (ZH) 中文名稱</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="玫瑰" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Image URL 圖片網址</Text>
              <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
              {imageUrl.trim().length > 0 && (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
              )}

              <Text style={styles.fieldLabel}>Rarity 稀有度</Text>
              <View style={styles.typePicker}>
                {RARITIES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.typeOption, rarity === r && { backgroundColor: getRarityColor(r), borderColor: getRarityColor(r) }]}
                    onPress={() => setRarity(r)}
                  >
                    <Text style={[styles.typeOptionText, rarity === r && { color: Colors.white }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Rarity Weight 稀有權重</Text>
              <TextInput style={styles.input} value={rarityWeight} onChangeText={setRarityWeight} placeholder="10" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Description (EN) 英文描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descEn} onChangeText={setDescEn} placeholder="Description..." placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.fieldLabel}>Description (ZH) 中文描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descZh} onChangeText={setDescZh} placeholder="描述..." placeholderTextColor={Colors.textTertiary} multiline />

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: Colors.accent,
  },
  tabText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
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
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  flowerImg: { width: 60, height: 60, borderRadius: 14 },
  flowerImgPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1, marginRight: 8 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  rarityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  rarityBadgeText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  methodBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  methodBadgeText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  stolenBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: Colors.dangerLight },
  stolenBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.danger },
  displayedBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: Colors.infoLight },
  displayedBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  weightText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' as const },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: Colors.textSecondary },
  dateText: { fontSize: 11, color: Colors.textTertiary },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
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

