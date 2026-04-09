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
  Dices,
  Trophy,
  Star,
  Edit3,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type TabKey = 'types' | 'patient_flowers' | 'gacha_draws' | 'patient_prizes';

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

interface GachaDraw {
  id: string;
  patient_id: string;
  draw_type: string;
  prize_type: string;
  prize_name: string;
  prize_name_zh?: string;
  stars_spent: number;
  created_at: string;
  patients?: { patient_name: string };
}

interface PatientPrize {
  id: string;
  patient_id: string;
  prize_type: string;
  prize_id: string;
  prize_name: string;
  obtained_at: string;
  is_active: boolean;
  patients?: { patient_name: string };
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

function getDrawTypeColor(t: string) {
  switch (t) {
    case 'single': return Colors.info;
    case 'multi': return '#7C5CFC';
    case 'guaranteed': return Colors.accent;
    default: return Colors.textTertiary;
  }
}

function getPrizeTypeColor(t: string) {
  switch (t) {
    case 'flower': return Colors.success;
    case 'avatar': return Colors.info;
    case 'theme': return '#7C5CFC';
    case 'badge': return Colors.accent;
    case 'sticker': return '#D4A030';
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

  const [prizeModalVisible, setPrizeModalVisible] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [prizePatientId, setPrizePatientId] = useState('');
  const [prizeType, setPrizeType] = useState('');
  const [prizeIdField, setPrizeIdField] = useState('');
  const [prizeName, setPrizeName] = useState('');
  const [prizeIsActive, setPrizeIsActive] = useState(true);

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

  const gachaDrawsQuery = useQuery({
    queryKey: ['admin-gacha-draws'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('gacha_draws')
          .select('*, patients(patient_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        return (data || []) as GachaDraw[];
      } catch (e) {
        console.log('Error fetching gacha draws:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'gacha_draws',
  });

  const patientPrizesQuery = useQuery({
    queryKey: ['admin-patient-prizes'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patient_prizes')
          .select('*, patients(patient_name)')
          .order('obtained_at', { ascending: false });
        if (error) throw error;
        return (data || []) as PatientPrize[];
      } catch (e) {
        console.log('Error fetching patient prizes:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'patient_prizes',
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

  const filteredGachaDraws = useMemo(() => {
    if (!gachaDrawsQuery.data) return [];
    if (!search.trim()) return gachaDrawsQuery.data;
    const s = search.toLowerCase();
    return gachaDrawsQuery.data.filter(d =>
      d.patients?.patient_name?.toLowerCase().includes(s) ||
      d.prize_name?.toLowerCase().includes(s) ||
      d.draw_type?.toLowerCase().includes(s)
    );
  }, [gachaDrawsQuery.data, search]);

  const filteredPatientPrizes = useMemo(() => {
    if (!patientPrizesQuery.data) return [];
    if (!search.trim()) return patientPrizesQuery.data;
    const s = search.toLowerCase();
    return patientPrizesQuery.data.filter(p =>
      p.patients?.patient_name?.toLowerCase().includes(s) ||
      p.prize_name?.toLowerCase().includes(s) ||
      p.prize_type?.toLowerCase().includes(s)
    );
  }, [patientPrizesQuery.data, search]);

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

  const resetPrizeForm = useCallback(() => {
    setEditingPrizeId(null);
    setPrizePatientId('');
    setPrizeType('');
    setPrizeIdField('');
    setPrizeName('');
    setPrizeIsActive(true);
  }, []);

  const openNewPrize = useCallback(() => {
    resetPrizeForm();
    setPrizeModalVisible(true);
  }, [resetPrizeForm]);

  const openEditPrize = useCallback((p: PatientPrize) => {
    setEditingPrizeId(p.id);
    setPrizePatientId(p.patient_id || '');
    setPrizeType(p.prize_type || '');
    setPrizeIdField(p.prize_id || '');
    setPrizeName(p.prize_name || '');
    setPrizeIsActive(p.is_active ?? true);
    setPrizeModalVisible(true);
  }, []);

  const savePrizeMutation = useMutation({
    mutationFn: async () => {
      if (!prizePatientId.trim()) throw new Error('Patient ID is required');
      if (!prizeName.trim()) throw new Error('Prize name is required');
      const payload: Record<string, unknown> = {
        patient_id: prizePatientId.trim(),
        prize_type: prizeType.trim() || null,
        prize_id: prizeIdField.trim() || null,
        prize_name: prizeName.trim(),
        is_active: prizeIsActive,
      };
      if (editingPrizeId) {
        const { error } = await supabase.from('patient_prizes').update(payload).eq('id', editingPrizeId);
        if (error) throw error;
      } else {
        (payload as Record<string, unknown>).obtained_at = new Date().toISOString();
        const { error } = await supabase.from('patient_prizes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-patient-prizes'] });
      setPrizeModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deletePrizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_prizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-patient-prizes'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDeletePrize = useCallback((id: string) => {
    Alert.alert('Delete Prize 刪除獎品', 'Are you sure? 確定刪除？', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePrizeMutation.mutate(id) },
    ]);
  }, [deletePrizeMutation]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  const currentQuery = activeTab === 'types' ? typesQuery
    : activeTab === 'patient_flowers' ? patientFlowersQuery
    : activeTab === 'gacha_draws' ? gachaDrawsQuery
    : patientPrizesQuery;

  const searchPlaceholder = activeTab === 'types' ? 'Search flower types...'
    : activeTab === 'patient_flowers' ? 'Search by patient or flower...'
    : activeTab === 'gacha_draws' ? 'Search draws by patient or prize...'
    : 'Search prizes by patient or name...';

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBarScrollContent}>
        <View style={styles.tabBar}>
          {(['types', 'patient_flowers', 'gacha_draws', 'patient_prizes'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => { setActiveTab(tab); setSearch(''); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]} numberOfLines={1}>
                {tab === 'types' ? 'Flowers 花朵'
                  : tab === 'patient_flowers' ? 'Owned 擁有'
                  : tab === 'gacha_draws' ? 'Draws 抽獎'
                  : 'Prizes 獎品'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
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
        ) : activeTab === 'types' ? (
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
        ) : activeTab === 'patient_flowers' ? (
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
        ) : activeTab === 'gacha_draws' ? (
          filteredGachaDraws.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Dices size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No gacha draws found</Text>
              <Text style={styles.emptySubtext}>找不到抽獎記錄</Text>
            </View>
          ) : (
            filteredGachaDraws.map(d => (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.gachaIcon, { backgroundColor: getDrawTypeColor(d.draw_type) + '18' }]}>
                    <Dices size={24} color={getDrawTypeColor(d.draw_type)} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{d.patients?.patient_name || 'Unknown'}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {d.prize_name || '—'}{d.prize_name_zh ? ` ${d.prize_name_zh}` : ''}
                    </Text>
                    <View style={styles.cardMeta}>
                      <View style={[styles.rarityBadge, { backgroundColor: getDrawTypeColor(d.draw_type) + '18' }]}>
                        <Text style={[styles.rarityBadgeText, { color: getDrawTypeColor(d.draw_type) }]}>{d.draw_type || '—'}</Text>
                      </View>
                      {d.prize_type ? (
                        <View style={[styles.methodBadge, { backgroundColor: getPrizeTypeColor(d.prize_type) + '18' }]}>
                          <Text style={[styles.methodBadgeText, { color: getPrizeTypeColor(d.prize_type) }]}>{d.prize_type}</Text>
                        </View>
                      ) : null}
                      {d.stars_spent > 0 && (
                        <View style={styles.starsRow}>
                          <Star size={12} color={Colors.accent} />
                          <Text style={styles.starsText}>{d.stars_spent}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.dateText}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() + ' ' + new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : (
          filteredPatientPrizes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Trophy size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No patient prizes found</Text>
              <Text style={styles.emptySubtext}>找不到患者獎品</Text>
            </View>
          ) : (
            filteredPatientPrizes.map(p => (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => openEditPrize(p)} activeOpacity={0.7}>
                <View style={styles.cardRow}>
                  <View style={[styles.gachaIcon, { backgroundColor: getPrizeTypeColor(p.prize_type) + '18' }]}>
                    <Trophy size={24} color={getPrizeTypeColor(p.prize_type)} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{p.patients?.patient_name || 'Unknown'}</Text>
                      <TouchableOpacity onPress={() => confirmDeletePrize(p.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>{p.prize_name || '—'}</Text>
                    <View style={styles.cardMeta}>
                      {p.prize_type ? (
                        <View style={[styles.rarityBadge, { backgroundColor: getPrizeTypeColor(p.prize_type) + '18' }]}>
                          <Text style={[styles.rarityBadgeText, { color: getPrizeTypeColor(p.prize_type) }]}>{p.prize_type}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.statusDot, { backgroundColor: p.is_active ? Colors.success : Colors.frozen }]} />
                      <Text style={styles.statusLabel}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                    <Text style={styles.dateText}>
                      {p.obtained_at ? new Date(p.obtained_at).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      {(activeTab === 'types' || activeTab === 'patient_prizes') && (
        <TouchableOpacity style={styles.fab} onPress={activeTab === 'types' ? openNew : openNewPrize} activeOpacity={0.8}>
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
      <Modal visible={prizeModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPrizeModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingPrizeId ? 'Edit' : 'Add'} Prize 獎品</Text>
              <TouchableOpacity onPress={() => savePrizeMutation.mutate()} disabled={savePrizeMutation.isPending}>
                {savePrizeMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Patient ID 患者ID *</Text>
              <TextInput style={styles.input} value={prizePatientId} onChangeText={setPrizePatientId} placeholder="UUID" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Prize Name 獎品名稱 *</Text>
              <TextInput style={styles.input} value={prizeName} onChangeText={setPrizeName} placeholder="Golden Flower" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Prize Type 獎品類型</Text>
              <TextInput style={styles.input} value={prizeType} onChangeText={setPrizeType} placeholder="flower, avatar, theme, badge..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Prize ID 獎品ID</Text>
              <TextInput style={styles.input} value={prizeIdField} onChangeText={setPrizeIdField} placeholder="Optional identifier" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch value={prizeIsActive} onValueChange={setPrizeIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
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
  tabBarScroll: { maxHeight: 52, marginTop: 12 },
  tabBarScrollContent: { paddingHorizontal: 16 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  gachaIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
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

