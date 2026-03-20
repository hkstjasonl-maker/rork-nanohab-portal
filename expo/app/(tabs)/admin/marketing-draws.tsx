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
  Gift,
  Calendar,
  Zap,
  Video,
  MousePointerClick,
  ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type TabKey = 'campaigns' | 'prizes';

interface Campaign {
  id: string;
  title_en: string;
  title_zh: string;
  description_en?: string;
  description_zh?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  trigger_on_app_open: boolean;
  trigger_on_exercise_count?: number | null;
  trigger_on_video_submit: boolean;
  max_draws_per_day: number;
  created_at: string;
}

interface Prize {
  id: string;
  campaign_id: string;
  prize_name_en: string;
  prize_name_zh: string;
  prize_type: string;
  quantity_total: number;
  quantity_remaining: number;
  probability_weight: number;
  expiry_date?: string;
  is_active: boolean;
  voucher_image_url?: string;
  congratulations_message_en?: string;
  congratulations_message_zh?: string;
  redeem_instructions_en?: string;
  redeem_instructions_zh?: string;
}

const PRIZE_TYPES = ['discount', 'voucher', 'gift', 'points'] as const;

function getPrizeTypeColor(t: string) {
  switch (t) {
    case 'discount': return Colors.success;
    case 'voucher': return Colors.info;
    case 'gift': return '#D4A030';
    case 'points': return '#7C5CFC';
    default: return Colors.textTertiary;
  }
}

export default function MarketingDrawsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('campaigns');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);

  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [triggerAppOpen, setTriggerAppOpen] = useState(false);
  const [triggerExerciseCount, setTriggerExerciseCount] = useState('0');
  const [triggerVideoSubmit, setTriggerVideoSubmit] = useState(false);
  const [maxDrawsPerDay, setMaxDrawsPerDay] = useState('1');

  const [prizeNameEn, setPrizeNameEn] = useState('');
  const [prizeNameZh, setPrizeNameZh] = useState('');
  const [prizeType, setPrizeType] = useState<string>('voucher');
  const [quantityTotal, setQuantityTotal] = useState('20');
  const [quantityRemaining, setQuantityRemaining] = useState('20');
  const [probabilityWeight, setProbabilityWeight] = useState('10');
  const [expiryDate, setExpiryDate] = useState('');
  const [voucherImageUrl, setVoucherImageUrl] = useState('');
  const [congratsEn, setCongratsEn] = useState('');
  const [congratsZh, setCongratsZh] = useState('');
  const [redeemEn, setRedeemEn] = useState('');
  const [redeemZh, setRedeemZh] = useState('');
  const [prizeIsActive, setPrizeIsActive] = useState(true);

  const campaignsQuery = useQuery({
    queryKey: ['admin-marketing-campaigns'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Campaign[];
      } catch (e) {
        console.log('Error fetching campaigns:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const prizesQuery = useQuery({
    queryKey: ['admin-marketing-prizes', selectedCampaignId],
    queryFn: async () => {
      try {
        let query = supabase
          .from('marketing_prizes')
          .select('*')
          .order('probability_weight', { ascending: false });
        if (selectedCampaignId) {
          query = query.eq('campaign_id', selectedCampaignId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as Prize[];
      } catch (e) {
        console.log('Error fetching prizes:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'prizes',
  });

  const filteredCampaigns = useMemo(() => {
    if (!campaignsQuery.data) return [];
    if (!search.trim()) return campaignsQuery.data;
    const s = search.toLowerCase();
    return campaignsQuery.data.filter(c =>
      c.title_en?.toLowerCase().includes(s) || c.title_zh?.includes(s)
    );
  }, [campaignsQuery.data, search]);

  const filteredPrizes = useMemo(() => {
    if (!prizesQuery.data) return [];
    if (!search.trim()) return prizesQuery.data;
    const s = search.toLowerCase();
    return prizesQuery.data.filter(p =>
      p.prize_name_en?.toLowerCase().includes(s) || p.prize_name_zh?.includes(s)
    );
  }, [prizesQuery.data, search]);

  const resetCampaignForm = useCallback(() => {
    setEditingId(null);
    setTitleEn('');
    setTitleZh('');
    setDescEn('');
    setDescZh('');
    setStartDate('');
    setEndDate('');
    setIsActive(true);
    setTriggerAppOpen(false);
    setTriggerExerciseCount('0');
    setTriggerVideoSubmit(false);
    setMaxDrawsPerDay('1');
  }, []);

  const resetPrizeForm = useCallback(() => {
    setEditingId(null);
    setPrizeNameEn('');
    setPrizeNameZh('');
    setPrizeType('voucher');
    setQuantityTotal('20');
    setQuantityRemaining('20');
    setProbabilityWeight('10');
    setExpiryDate('');
    setVoucherImageUrl('');
    setCongratsEn('');
    setCongratsZh('');
    setRedeemEn('');
    setRedeemZh('');
    setPrizeIsActive(true);
  }, []);

  const openNewCampaign = useCallback(() => {
    resetCampaignForm();
    setModalVisible(true);
  }, [resetCampaignForm]);

  const openEditCampaign = useCallback((c: Campaign) => {
    setEditingId(c.id);
    setTitleEn(c.title_en || '');
    setTitleZh(c.title_zh || '');
    setDescEn(c.description_en || '');
    setDescZh(c.description_zh || '');
    setStartDate(c.start_date || '');
    setEndDate(c.end_date || '');
    setIsActive(c.is_active ?? true);
    setTriggerAppOpen(c.trigger_on_app_open ?? false);
    setTriggerExerciseCount(String(c.trigger_on_exercise_count ?? 0));
    setTriggerVideoSubmit(c.trigger_on_video_submit ?? false);
    setMaxDrawsPerDay(String(c.max_draws_per_day ?? 1));
    setModalVisible(true);
  }, []);

  const openNewPrize = useCallback(() => {
    resetPrizeForm();
    setModalVisible(true);
  }, [resetPrizeForm]);

  const openEditPrize = useCallback((p: Prize) => {
    setEditingId(p.id);
    setPrizeNameEn(p.prize_name_en || '');
    setPrizeNameZh(p.prize_name_zh || '');
    setPrizeType(p.prize_type || 'voucher');
    setQuantityTotal(String(p.quantity_total ?? 20));
    setQuantityRemaining(String(p.quantity_remaining ?? 20));
    setProbabilityWeight(String(p.probability_weight ?? 10));
    setExpiryDate(p.expiry_date || '');
    setVoucherImageUrl(p.voucher_image_url || '');
    setCongratsEn(p.congratulations_message_en || '');
    setCongratsZh(p.congratulations_message_zh || '');
    setRedeemEn(p.redeem_instructions_en || '');
    setRedeemZh(p.redeem_instructions_zh || '');
    setPrizeIsActive(p.is_active ?? true);
    setModalVisible(true);
  }, []);

  const saveCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!titleEn.trim()) throw new Error('English title is required');
      const payload: Record<string, unknown> = {
        title_en: titleEn.trim(),
        title_zh: titleZh.trim() || null,
        description_en: descEn.trim() || null,
        description_zh: descZh.trim() || null,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        is_active: isActive,
        trigger_on_app_open: triggerAppOpen,
        trigger_on_exercise_count: parseInt(triggerExerciseCount, 10) || null,
        trigger_on_video_submit: triggerVideoSubmit,
        max_draws_per_day: parseInt(maxDrawsPerDay, 10) || 1,
      };
      if (editingId) {
        const { error } = await supabase.from('marketing_campaigns').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_campaigns').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-marketing-campaigns'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const savePrizeMutation = useMutation({
    mutationFn: async () => {
      if (!prizeNameEn.trim()) throw new Error('Prize name (EN) is required');
      if (!selectedCampaignId) throw new Error('Select a campaign first');
      const payload: Record<string, unknown> = {
        campaign_id: selectedCampaignId,
        prize_name_en: prizeNameEn.trim(),
        prize_name_zh: prizeNameZh.trim() || null,
        prize_type: prizeType,
        quantity_total: parseInt(quantityTotal, 10) || 0,
        quantity_remaining: parseInt(quantityRemaining, 10) || 0,
        probability_weight: parseInt(probabilityWeight, 10) || 10,
        expiry_date: expiryDate.trim() || null,
        voucher_image_url: voucherImageUrl.trim() || null,
        congratulations_message_en: congratsEn.trim() || null,
        congratulations_message_zh: congratsZh.trim() || null,
        redeem_instructions_en: redeemEn.trim() || null,
        redeem_instructions_zh: redeemZh.trim() || null,
        is_active: prizeIsActive,
      };
      if (editingId) {
        const { error } = await supabase.from('marketing_prizes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_prizes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-marketing-prizes'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-marketing-campaigns'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deletePrizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_prizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-marketing-prizes'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDeleteCampaign = useCallback((id: string) => {
    Alert.alert('Delete Campaign 刪除活動', 'Are you sure? This will also affect associated prizes. 確定刪除？', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCampaignMutation.mutate(id) },
    ]);
  }, [deleteCampaignMutation]);

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

  const isCampaignsTab = activeTab === 'campaigns';
  const currentQuery = isCampaignsTab ? campaignsQuery : prizesQuery;
  const selectedCampaignName = campaignsQuery.data?.find(c => c.id === selectedCampaignId)?.title_en || 'All Campaigns';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Marketing Draws</Text>
            <Text style={styles.headerSubtitle}>行銷抽獎</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, isCampaignsTab && styles.tabItemActive]}
          onPress={() => { setActiveTab('campaigns'); setSearch(''); }}
        >
          <Text style={[styles.tabText, isCampaignsTab && styles.tabTextActive]}>Campaigns 活動</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, !isCampaignsTab && styles.tabItemActive]}
          onPress={() => { setActiveTab('prizes'); setSearch(''); }}
        >
          <Text style={[styles.tabText, !isCampaignsTab && styles.tabTextActive]}>Prizes 獎品</Text>
        </TouchableOpacity>
      </View>

      {!isCampaignsTab && (
        <TouchableOpacity
          style={styles.campaignPicker}
          onPress={() => setCampaignPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Gift size={16} color={Colors.accent} />
          <Text style={styles.campaignPickerText} numberOfLines={1}>{selectedCampaignName}</Text>
          <ChevronDown size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isCampaignsTab ? 'Search campaigns...' : 'Search prizes...'}
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
        ) : isCampaignsTab ? (
          filteredCampaigns.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Gift size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No campaigns found</Text>
              <Text style={styles.emptySubtext}>找不到活動</Text>
            </View>
          ) : (
            filteredCampaigns.map(c => (
              <TouchableOpacity key={c.id} style={styles.card} onPress={() => openEditCampaign(c)} activeOpacity={0.7}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{c.title_en}</Text>
                    {c.title_zh ? <Text style={styles.cardSubtitle} numberOfLines={1}>{c.title_zh}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => confirmDeleteCampaign(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardDateRow}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.cardDateText}>{c.start_date || '—'} → {c.end_date || '—'}</Text>
                  <View style={[styles.statusDot, { backgroundColor: c.is_active ? Colors.success : Colors.frozen }]} />
                  <Text style={styles.statusLabel}>{c.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                <View style={styles.triggerRow}>
                  {c.trigger_on_app_open && (
                    <View style={[styles.triggerBadge, { backgroundColor: Colors.infoLight }]}>
                      <MousePointerClick size={10} color={Colors.info} />
                      <Text style={[styles.triggerBadgeText, { color: Colors.info }]}>App Open</Text>
                    </View>
                  )}
                  {(c.trigger_on_exercise_count ?? 0) > 0 && (
                    <View style={[styles.triggerBadge, { backgroundColor: Colors.successLight }]}>
                      <Zap size={10} color={Colors.success} />
                      <Text style={[styles.triggerBadgeText, { color: Colors.success }]}>×{c.trigger_on_exercise_count}</Text>
                    </View>
                  )}
                  {c.trigger_on_video_submit && (
                    <View style={[styles.triggerBadge, { backgroundColor: '#F3EEFF' }]}>
                      <Video size={10} color="#7C5CFC" />
                      <Text style={[styles.triggerBadgeText, { color: '#7C5CFC' }]}>Video</Text>
                    </View>
                  )}
                  <Text style={styles.drawsText}>Max {c.max_draws_per_day}/day</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          filteredPrizes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Gift size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No prizes found</Text>
              <Text style={styles.emptySubtext}>{selectedCampaignId ? '此活動沒有獎品' : '找不到獎品'}</Text>
            </View>
          ) : (
            filteredPrizes.map(p => (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => openEditPrize(p)} activeOpacity={0.7}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.prize_name_en}</Text>
                    {p.prize_name_zh ? <Text style={styles.cardSubtitle} numberOfLines={1}>{p.prize_name_zh}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => confirmDeletePrize(p.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardMeta}>
                  <View style={[styles.typeBadge, { backgroundColor: getPrizeTypeColor(p.prize_type) + '18' }]}>
                    <Text style={[styles.typeBadgeText, { color: getPrizeTypeColor(p.prize_type) }]}>{p.prize_type}</Text>
                  </View>
                  <Text style={styles.qtyText}>{p.quantity_remaining}/{p.quantity_total}</Text>
                  <Text style={styles.weightLabel}>P: {p.probability_weight}</Text>
                  <View style={[styles.statusDot, { backgroundColor: p.is_active ? Colors.success : Colors.frozen }]} />
                  <Text style={styles.statusLabel}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                {p.expiry_date ? (
                  <View style={styles.cardDateRow}>
                    <Calendar size={12} color={Colors.textTertiary} />
                    <Text style={styles.cardDateText}>Expires: {p.expiry_date}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={isCampaignsTab ? openNewCampaign : openNewPrize} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      {isCampaignsTab ? (
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Campaign</Text>
                <TouchableOpacity onPress={() => saveCampaignMutation.mutate()} disabled={saveCampaignMutation.isPending}>
                  {saveCampaignMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Title (EN) 英文標題 *</Text>
                <TextInput style={styles.input} value={titleEn} onChangeText={setTitleEn} placeholder="Campaign title" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Title (ZH) 中文標題</Text>
                <TextInput style={styles.input} value={titleZh} onChangeText={setTitleZh} placeholder="活動標題" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Description (EN) 英文描述</Text>
                <TextInput style={[styles.input, styles.multiline]} value={descEn} onChangeText={setDescEn} placeholder="Description..." placeholderTextColor={Colors.textTertiary} multiline />

                <Text style={styles.fieldLabel}>Description (ZH) 中文描述</Text>
                <TextInput style={[styles.input, styles.multiline]} value={descZh} onChangeText={setDescZh} placeholder="描述..." placeholderTextColor={Colors.textTertiary} multiline />

                <Text style={styles.fieldLabel}>Start Date 開始日期 (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2025-01-01" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>End Date 結束日期 (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2025-12-31" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Max Draws Per Day 每日最大抽獎次數</Text>
                <TextInput style={styles.input} value={maxDrawsPerDay} onChangeText={setMaxDrawsPerDay} placeholder="1" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Active 啟用</Text>
                  <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Trigger: App Open 觸發：打開應用</Text>
                  <Switch value={triggerAppOpen} onValueChange={setTriggerAppOpen} trackColor={{ true: Colors.info, false: Colors.border }} thumbColor={Colors.white} />
                </View>

                <Text style={styles.fieldLabel}>Trigger: Exercise Count 觸發：運動次數 (0=disabled)</Text>
                <TextInput style={styles.input} value={triggerExerciseCount} onChangeText={setTriggerExerciseCount} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Trigger: Video Submit 觸發：影片提交</Text>
                  <Switch value={triggerVideoSubmit} onValueChange={setTriggerVideoSubmit} trackColor={{ true: '#7C5CFC', false: Colors.border }} thumbColor={Colors.white} />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      ) : (
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Prize</Text>
                <TouchableOpacity onPress={() => savePrizeMutation.mutate()} disabled={savePrizeMutation.isPending}>
                  {savePrizeMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {!selectedCampaignId && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>Please select a campaign above before adding a prize.</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Prize Name (EN) 英文獎品名 *</Text>
                <TextInput style={styles.input} value={prizeNameEn} onChangeText={setPrizeNameEn} placeholder="$50 Voucher" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Prize Name (ZH) 中文獎品名</Text>
                <TextInput style={styles.input} value={prizeNameZh} onChangeText={setPrizeNameZh} placeholder="$50 優惠券" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Prize Type 獎品類型</Text>
                <View style={styles.typePicker}>
                  {PRIZE_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeOption, prizeType === t && { backgroundColor: getPrizeTypeColor(t), borderColor: getPrizeTypeColor(t) }]}
                      onPress={() => setPrizeType(t)}
                    >
                      <Text style={[styles.typeOptionText, prizeType === t && { color: Colors.white }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Quantity Total 總數量</Text>
                <TextInput style={styles.input} value={quantityTotal} onChangeText={setQuantityTotal} placeholder="20" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

                <Text style={styles.fieldLabel}>Quantity Remaining 剩餘數量</Text>
                <TextInput style={styles.input} value={quantityRemaining} onChangeText={setQuantityRemaining} placeholder="20" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

                <Text style={styles.fieldLabel}>Probability Weight 概率權重</Text>
                <TextInput style={styles.input} value={probabilityWeight} onChangeText={setProbabilityWeight} placeholder="10" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

                <Text style={styles.fieldLabel}>Expiry Date 到期日 (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={expiryDate} onChangeText={setExpiryDate} placeholder="2025-12-31" placeholderTextColor={Colors.textTertiary} />

                <Text style={styles.fieldLabel}>Voucher Image URL 優惠券圖片</Text>
                <TextInput style={styles.input} value={voucherImageUrl} onChangeText={setVoucherImageUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

                <Text style={styles.fieldLabel}>Congratulations (EN) 恭喜訊息</Text>
                <TextInput style={[styles.input, styles.multiline]} value={congratsEn} onChangeText={setCongratsEn} placeholder="Congratulations!" placeholderTextColor={Colors.textTertiary} multiline />

                <Text style={styles.fieldLabel}>Congratulations (ZH) 恭喜訊息</Text>
                <TextInput style={[styles.input, styles.multiline]} value={congratsZh} onChangeText={setCongratsZh} placeholder="恭喜你！" placeholderTextColor={Colors.textTertiary} multiline />

                <Text style={styles.fieldLabel}>Redeem Instructions (EN) 兌換說明</Text>
                <TextInput style={[styles.input, styles.multiline]} value={redeemEn} onChangeText={setRedeemEn} placeholder="Instructions..." placeholderTextColor={Colors.textTertiary} multiline />

                <Text style={styles.fieldLabel}>Redeem Instructions (ZH) 兌換說明</Text>
                <TextInput style={[styles.input, styles.multiline]} value={redeemZh} onChangeText={setRedeemZh} placeholder="說明..." placeholderTextColor={Colors.textTertiary} multiline />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Active 啟用</Text>
                  <Switch value={prizeIsActive} onValueChange={setPrizeIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}

      <Modal visible={campaignPickerOpen} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Campaign 選擇活動</Text>
              <TouchableOpacity onPress={() => setCampaignPickerOpen(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerItem, !selectedCampaignId && styles.pickerItemSelected]}
                onPress={() => { setSelectedCampaignId(null); setCampaignPickerOpen(false); }}
              >
                <Text style={[styles.pickerItemText, !selectedCampaignId && styles.pickerItemTextSelected]}>All Campaigns 所有活動</Text>
              </TouchableOpacity>
              {(campaignsQuery.data || []).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pickerItem, selectedCampaignId === c.id && styles.pickerItemSelected]}
                  onPress={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false); }}
                >
                  <Text style={[styles.pickerItemText, selectedCampaignId === c.id && styles.pickerItemTextSelected]} numberOfLines={1}>
                    {c.title_en}{c.title_zh ? ` ${c.title_zh}` : ''}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: c.is_active ? Colors.success : Colors.frozen }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
  tabItemActive: { backgroundColor: Colors.accent },
  tabText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  campaignPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  campaignPickerText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' as const },
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
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1, marginRight: 8 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardDateText: { fontSize: 11, color: Colors.textTertiary, flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: Colors.textSecondary },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  triggerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  triggerBadgeText: { fontSize: 11, fontWeight: '600' as const },
  drawsText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' as const, marginLeft: 'auto' as const },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  qtyText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  weightLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' as const },
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
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text, flex: 1, marginRight: 10 },
  warningBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  warningText: { fontSize: 13, color: Colors.warning, fontWeight: '500' as const },
  pickerOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  pickerList: { paddingHorizontal: 16 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  pickerItemSelected: { backgroundColor: Colors.accentLight },
  pickerItemText: { fontSize: 15, color: Colors.text, flex: 1, marginRight: 8 },
  pickerItemTextSelected: { color: Colors.accent, fontWeight: '600' as const },
});
