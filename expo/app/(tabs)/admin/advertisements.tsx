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
  Users,
  Check,
  Square,
  CheckSquare,
  BarChart3,
  Eye,
  MousePointerClick,
  TrendingUp,
  Filter,
  UserX,
  Crown,
  Building2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type TabKey = 'library' | 'analytics' | 'adfree';

interface AppAd {
  id: string;
  title: string;
  title_zh?: string;
  image_url: string;
  image_url_zh?: string;
  link_url?: string;
  placement: string;
  duration_seconds: number;
  skip_delay_seconds: number;
  advertiser_name?: string;
  advertiser_name_zh?: string;
  advertiser_logo_url?: string;
  target_type: string;
  start_date: string;
  end_date: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface PatientOption {
  id: string;
  patient_name: string;
  is_ad_free?: boolean;
  clinician_id?: string;
  clinicians?: {
    full_name: string;
    is_ad_free_for_patients?: boolean;
    tier_id?: string;
    clinician_tiers?: { name: string; is_ad_free?: boolean } | null;
  } | null;
}

interface ClinicianOption {
  id: string;
  full_name: string;
  is_ad_free_for_patients?: boolean;
  tier_id?: string;
}

interface TierOption {
  id: string;
  name: string;
  is_ad_free?: boolean;
}

interface ImpressionRow {
  ad_id: string;
  placement?: string;
  viewed_at: string;
}

interface ClickRow {
  ad_id: string;
  placement?: string;
  clicked_at: string;
}

const PLACEMENTS = [
  { value: 'splash', label: 'Splash 啟動頁' },
  { value: 'mahjong', label: 'Mahjong 麻雀' },
  { value: 'flower_garden', label: 'Flower Garden 花園' },
  { value: 'gacha_bonus', label: 'Gacha Bonus 扭蛋獎勵' },
] as const;

const PLACEMENT_LABELS: Record<string, string> = {
  splash: 'Splash',
  mahjong: 'Mahjong',
  flower_garden: 'Flower Garden',
  gacha_bonus: 'Gacha Bonus',
};

const STATUS_FILTERS = ['all', 'active', 'inactive', 'expired'] as const;
const DATE_FILTERS = ['7d', '30d', '90d', 'all'] as const;

function getPlacementColor(p: string): string {
  switch (p) {
    case 'splash': return '#E05C8A';
    case 'mahjong': return '#7C5CFC';
    case 'flower_garden': return '#34C759';
    case 'gacha_bonus': return '#FF9500';
    default: return Colors.info;
  }
}

function isExpired(endDate: string): boolean {
  if (!endDate) return false;
  return new Date(endDate) < new Date(new Date().toISOString().split('T')[0]);
}

function getAdFreeSource(patient: PatientOption): string {
  if (patient.is_ad_free) return 'patient';
  if (patient.clinicians?.is_ad_free_for_patients) return 'clinician';
  if (patient.clinicians?.clinician_tiers?.is_ad_free) return 'tier';
  return 'none';
}

function getAdFreeLabel(source: string): string {
  switch (source) {
    case 'patient': return 'Patient 患者';
    case 'clinician': return 'Clinician 治療師';
    case 'tier': return 'Tier 級別';
    default: return 'None 無';
  }
}

function getAdFreeColor(source: string): string {
  switch (source) {
    case 'patient': return Colors.info;
    case 'clinician': return '#7C5CFC';
    case 'tier': return '#D4A030';
    default: return Colors.frozen;
  }
}

export default function AdvertisementsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('library');
  const [search, setSearch] = useState('');
  const [placementFilter, setPlacementFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [placement, setPlacement] = useState('splash');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlZh, setImageUrlZh] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserNameZh, setAdvertiserNameZh] = useState('');
  const [advertiserLogoUrl, setAdvertiserLogoUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('5');
  const [skipDelaySeconds, setSkipDelaySeconds] = useState('2');
  const [targetType, setTargetType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  const [analyticsDateFilter, setAnalyticsDateFilter] = useState<string>('30d');

  const [adFreeSearch, setAdFreeSearch] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [showClinicians, setShowClinicians] = useState(false);
  const [showTiers, setShowTiers] = useState(false);

  const adsQuery = useQuery({
    queryKey: ['admin-app-ads'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_ads')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AppAd[];
      } catch (e) {
        console.log('Error fetching app ads:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientsQuery = useQuery({
    queryKey: ['admin-patients-list'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name')
          .order('patient_name');
        if (error) throw error;
        return (data || []) as PatientOption[];
      } catch (e) {
        console.log('Error fetching patients:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientsAdFreeQuery = useQuery({
    queryKey: ['admin-patients-adfree'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, is_ad_free, clinician_id, clinicians(full_name, is_ad_free_for_patients, tier_id, clinician_tiers(name, is_ad_free))')
          .order('patient_name');
        if (error) throw error;
        return (data || []) as PatientOption[];
      } catch (e) {
        console.log('Error fetching patients ad-free:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'adfree',
  });

  const cliniciansQuery = useQuery({
    queryKey: ['admin-clinicians-adfree'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clinicians')
          .select('id, full_name, is_ad_free_for_patients, tier_id')
          .order('full_name');
        if (error) throw error;
        return (data || []) as ClinicianOption[];
      } catch (e) {
        console.log('Error fetching clinicians:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'adfree',
  });

  const tiersQuery = useQuery({
    queryKey: ['admin-tiers-adfree'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clinician_tiers')
          .select('id, name, is_ad_free')
          .order('name');
        if (error) throw error;
        return (data || []) as TierOption[];
      } catch (e) {
        console.log('Error fetching tiers:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'adfree',
  });

  const targetCountsQuery = useQuery({
    queryKey: ['admin-app-ad-target-counts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_ad_targets')
          .select('ad_id:splash_ad_id');
        if (error) {
          const { data: data2, error: error2 } = await supabase
            .from('app_ad_targets')
            .select('ad_id');
          if (error2) throw error2;
          const counts: Record<string, number> = {};
          (data2 || []).forEach((row: Record<string, string>) => {
            const id = row.ad_id;
            if (id) counts[id] = (counts[id] || 0) + 1;
          });
          return counts;
        }
        const counts: Record<string, number> = {};
        (data || []).forEach((row: Record<string, string>) => {
          const id = row.ad_id;
          if (id) counts[id] = (counts[id] || 0) + 1;
        });
        return counts;
      } catch (e) {
        console.log('Error fetching ad target counts:', e);
        return {} as Record<string, number>;
      }
    },
    enabled: isAdmin,
  });

  const existingTargetsQuery = useQuery({
    queryKey: ['admin-app-ad-targets', editingId],
    queryFn: async () => {
      if (!editingId) return [];
      try {
        const { data, error } = await supabase
          .from('app_ad_targets')
          .select('*')
          .eq('ad_id', editingId);
        if (error) throw error;
        return (data || []) as { id: string; ad_id: string; patient_id: string }[];
      } catch (e) {
        console.log('Error fetching existing targets:', e);
        return [];
      }
    },
    enabled: !!editingId && modalVisible,
  });

  useEffect(() => {
    if (editingId && existingTargetsQuery.data) {
      setSelectedPatientIds(existingTargetsQuery.data.map(t => t.patient_id));
    }
  }, [editingId, existingTargetsQuery.data]);

  const analyticsDateStr = useMemo(() => {
    if (analyticsDateFilter === 'all') return null;
    const now = new Date();
    const days = analyticsDateFilter === '7d' ? 7 : analyticsDateFilter === '30d' ? 30 : 90;
    now.setDate(now.getDate() - days);
    return now.toISOString();
  }, [analyticsDateFilter]);

  const impressionsQuery = useQuery({
    queryKey: ['admin-ad-impressions', analyticsDateStr],
    queryFn: async () => {
      try {
        let query = supabase.from('app_ad_impressions').select('ad_id, placement, viewed_at');
        if (analyticsDateStr) {
          query = query.gte('viewed_at', analyticsDateStr);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as ImpressionRow[];
      } catch (e) {
        console.log('Error fetching impressions:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'analytics',
  });

  const clicksQuery = useQuery({
    queryKey: ['admin-ad-clicks', analyticsDateStr],
    queryFn: async () => {
      try {
        let query = supabase.from('app_ad_clicks').select('ad_id, placement, clicked_at');
        if (analyticsDateStr) {
          query = query.gte('clicked_at', analyticsDateStr);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as ClickRow[];
      } catch (e) {
        console.log('Error fetching clicks:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'analytics',
  });

  const filtered = useMemo(() => {
    if (!adsQuery.data) return [];
    let list = adsQuery.data;
    if (placementFilter !== 'all') {
      list = list.filter(a => a.placement === placementFilter);
    }
    if (statusFilter === 'active') {
      list = list.filter(a => a.is_active && !isExpired(a.end_date));
    } else if (statusFilter === 'inactive') {
      list = list.filter(a => !a.is_active);
    } else if (statusFilter === 'expired') {
      list = list.filter(a => isExpired(a.end_date));
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(a =>
        a.title?.toLowerCase().includes(s) ||
        a.advertiser_name?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [adsQuery.data, placementFilter, statusFilter, search]);

  const analyticsData = useMemo(() => {
    const impressions = impressionsQuery.data || [];
    const clicks = clicksQuery.data || [];
    const ads = adsQuery.data || [];

    const impByAd: Record<string, number> = {};
    const clickByAd: Record<string, number> = {};

    impressions.forEach(i => {
      impByAd[i.ad_id] = (impByAd[i.ad_id] || 0) + 1;
    });
    clicks.forEach(c => {
      clickByAd[c.ad_id] = (clickByAd[c.ad_id] || 0) + 1;
    });

    const totalImpressions = impressions.length;
    const totalClicks = clicks.length;
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
    const activeAds = ads.filter(a => a.is_active && !isExpired(a.end_date)).length;

    const perAd = ads.map(ad => {
      const imp = impByAd[ad.id] || 0;
      const clk = clickByAd[ad.id] || 0;
      const ctr = imp > 0 ? ((clk / imp) * 100) : 0;
      return { ...ad, impressions: imp, clicks: clk, ctr };
    }).filter(a => a.impressions > 0 || a.clicks > 0)
      .sort((a, b) => b.impressions - a.impressions);

    return { totalImpressions, totalClicks, avgCtr, activeAds, perAd };
  }, [impressionsQuery.data, clicksQuery.data, adsQuery.data]);

  const filteredAdFreePatients = useMemo(() => {
    if (!patientsAdFreeQuery.data) return [];
    if (!adFreeSearch.trim()) return patientsAdFreeQuery.data;
    const s = adFreeSearch.toLowerCase();
    return patientsAdFreeQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) ||
      p.clinicians?.full_name?.toLowerCase().includes(s)
    );
  }, [patientsAdFreeQuery.data, adFreeSearch]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle('');
    setTitleZh('');
    setPlacement('splash');
    setImageUrl('');
    setImageUrlZh('');
    setLinkUrl('');
    setAdvertiserName('');
    setAdvertiserNameZh('');
    setAdvertiserLogoUrl('');
    setDurationSeconds('5');
    setSkipDelaySeconds('2');
    setTargetType('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('0');
    setIsActive(true);
    setSelectedPatientIds([]);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((ad: AppAd) => {
    setEditingId(ad.id);
    setTitle(ad.title || '');
    setTitleZh(ad.title_zh || '');
    setPlacement(ad.placement || 'splash');
    setImageUrl(ad.image_url || '');
    setImageUrlZh(ad.image_url_zh || '');
    setLinkUrl(ad.link_url || '');
    setAdvertiserName(ad.advertiser_name || '');
    setAdvertiserNameZh(ad.advertiser_name_zh || '');
    setAdvertiserLogoUrl(ad.advertiser_logo_url || '');
    setDurationSeconds(String(ad.duration_seconds ?? 5));
    setSkipDelaySeconds(String(ad.skip_delay_seconds ?? 2));
    setTargetType(ad.target_type || 'all');
    setStartDate(ad.start_date || '');
    setEndDate(ad.end_date || '');
    setSortOrder(String(ad.sort_order ?? 0));
    setIsActive(ad.is_active ?? true);
    setSelectedPatientIds([]);
    setModalVisible(true);
  }, []);

  const togglePatient = useCallback((pid: string) => {
    setSelectedPatientIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  }, []);

  const selectAllPatients = useCallback(() => {
    if (!patientsQuery.data) return;
    setSelectedPatientIds(patientsQuery.data.map(p => p.id));
  }, [patientsQuery.data]);

  const deselectAllPatients = useCallback(() => {
    setSelectedPatientIds([]);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      if (!imageUrl.trim()) throw new Error('Image URL is required');
      if (!startDate.trim()) throw new Error('Start date is required');
      if (!endDate.trim()) throw new Error('End date is required');
      if (targetType === 'specific' && selectedPatientIds.length === 0) {
        throw new Error('Please select at least one patient');
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        title_zh: titleZh.trim() || null,
        image_url: imageUrl.trim(),
        image_url_zh: imageUrlZh.trim() || null,
        link_url: linkUrl.trim() || null,
        placement,
        duration_seconds: parseInt(durationSeconds, 10) || 5,
        skip_delay_seconds: parseInt(skipDelaySeconds, 10) || 2,
        advertiser_name: advertiserName.trim() || null,
        advertiser_name_zh: advertiserNameZh.trim() || null,
        advertiser_logo_url: advertiserLogoUrl.trim() || null,
        target_type: targetType,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: isActive,
      };

      let adId = editingId;

      if (editingId) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase.from('app_ads').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('app_ads').insert(payload).select('id').single();
        if (error) throw error;
        adId = data.id;
      }

      if (targetType === 'specific' && adId) {
        await supabase.from('app_ad_targets').delete().eq('ad_id', adId);
        const rows = selectedPatientIds.map(pid => ({
          ad_id: adId as string,
          patient_id: pid,
        }));
        const { error: insError } = await supabase.from('app_ad_targets').insert(rows);
        if (insError) throw insError;
      } else if (targetType !== 'specific' && adId) {
        await supabase.from('app_ad_targets').delete().eq('ad_id', adId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ad-target-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ad-targets'] });
      setModalVisible(false);
      Alert.alert('Success 成功', 'Ad saved successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('app_ad_targets').delete().eq('ad_id', id);
      const { error } = await supabase.from('app_ads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ad-target-counts'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('app_ads').update({ is_active: value, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-app-ads'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updatePatientAdFreeMutation = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: boolean }) => {
      const { error } = await supabase.from('patients').update({ is_ad_free: value }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-patients-adfree'] });
      setSelectedBatchIds([]);
      Alert.alert('Success 成功', 'Patient ad-free status updated');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateClinicianAdFreeMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('clinicians').update({ is_ad_free_for_patients: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-clinicians-adfree'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-patients-adfree'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateTierAdFreeMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('clinician_tiers').update({ is_ad_free: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tiers-adfree'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-patients-adfree'] });
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

  const toggleBatchPatient = useCallback((pid: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  }, []);

  const handleBatchAdFree = useCallback((value: boolean) => {
    if (selectedBatchIds.length === 0) {
      Alert.alert('No Selection', 'Please select patients first');
      return;
    }
    Alert.alert(
      value ? 'Set Ad-Free 設為免廣告' : 'Remove Ad-Free 移除免廣告',
      `Apply to ${selectedBatchIds.length} patients?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updatePatientAdFreeMutation.mutate({ ids: selectedBatchIds, value }) },
      ]
    );
  }, [selectedBatchIds, updatePatientAdFreeMutation]);

  const onRefresh = useCallback(() => {
    if (activeTab === 'library') {
      void adsQuery.refetch();
      void targetCountsQuery.refetch();
    } else if (activeTab === 'analytics') {
      void impressionsQuery.refetch();
      void clicksQuery.refetch();
      void adsQuery.refetch();
    } else {
      void patientsAdFreeQuery.refetch();
      void cliniciansQuery.refetch();
      void tiersQuery.refetch();
    }
  }, [activeTab, adsQuery, targetCountsQuery, impressionsQuery, clicksQuery, patientsAdFreeQuery, cliniciansQuery, tiersQuery]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  const targetCounts = targetCountsQuery.data || {};
  const isRefreshing = activeTab === 'library' ? adsQuery.isFetching : activeTab === 'analytics' ? (impressionsQuery.isFetching || clicksQuery.isFetching) : patientsAdFreeQuery.isFetching;

  const renderLibraryTab = () => (
    <>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, placementFilter === 'all' && styles.filterChipActive]}
            onPress={() => setPlacementFilter('all')}
          >
            <Text style={[styles.filterChipText, placementFilter === 'all' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {PLACEMENTS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.filterChip, placementFilter === p.value && { backgroundColor: getPlacementColor(p.value), borderColor: getPlacementColor(p.value) }]}
              onPress={() => setPlacementFilter(placementFilter === p.value ? 'all' : p.value)}
            >
              <Text style={[styles.filterChipText, placementFilter === p.value && styles.filterChipTextActive]}>{p.label.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.statusRow}>
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.statusChip, statusFilter === s && styles.statusChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.statusChipText, statusFilter === s && styles.statusChipTextActive]}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {adsQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Megaphone size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No ads found</Text>
          <Text style={styles.emptySubtext}>找不到廣告</Text>
        </View>
      ) : (
        filtered.map(ad => {
          const expired = isExpired(ad.end_date);
          return (
            <TouchableOpacity
              key={ad.id}
              style={[styles.card, expired && styles.cardExpired]}
              onPress={() => openEdit(ad)}
              activeOpacity={0.7}
            >
              {ad.image_url ? (
                <Image source={{ uri: ad.image_url }} style={styles.cardThumb} resizeMode="cover" />
              ) : (
                <View style={styles.cardThumbPlaceholder}>
                  <ImageIcon size={28} color={Colors.textTertiary} />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.cardTitle, expired && { color: Colors.textTertiary }]} numberOfLines={1}>{ad.title}</Text>
                    {ad.advertiser_name ? (
                      <Text style={styles.cardAdvertiser} numberOfLines={1}>{ad.advertiser_name}</Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => toggleActiveMutation.mutate({ id: ad.id, value: !ad.is_active })}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginRight: 8 }}
                    >
                      {ad.is_active ? (
                        <ToggleRight size={20} color={Colors.success} />
                      ) : (
                        <ToggleLeft size={20} color={Colors.frozen} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(ad.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Trash2 size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <View style={[styles.placementBadge, { backgroundColor: getPlacementColor(ad.placement) + '18' }]}>
                    <Text style={[styles.placementBadgeText, { color: getPlacementColor(ad.placement) }]}>{PLACEMENT_LABELS[ad.placement] || ad.placement}</Text>
                  </View>
                  <View style={[styles.targetBadge, { backgroundColor: ad.target_type === 'specific' ? '#E07A3A18' : Colors.success + '18' }]}>
                    <Text style={[styles.targetBadgeText, { color: ad.target_type === 'specific' ? '#E07A3A' : Colors.success }]}>
                      {ad.target_type === 'specific' ? 'Specific' : 'All'}
                    </Text>
                  </View>
                  {ad.target_type === 'specific' && targetCounts[ad.id] != null && (
                    <View style={styles.targetCountBadge}>
                      <Users size={10} color={Colors.textSecondary} />
                      <Text style={styles.targetCountText}>{targetCounts[ad.id]}</Text>
                    </View>
                  )}
                  {expired && (
                    <View style={[styles.placementBadge, { backgroundColor: Colors.danger + '18' }]}>
                      <Text style={[styles.placementBadgeText, { color: Colors.danger }]}>Expired</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardDateRow}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.cardDateText}>{ad.start_date || '—'} → {ad.end_date || '—'}</Text>
                  <Text style={styles.sortLabel}>#{ad.sort_order}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  const renderAnalyticsTab = () => (
    <>
      <View style={styles.dateFilterRow}>
        {DATE_FILTERS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.dateFilterChip, analyticsDateFilter === d && styles.dateFilterChipActive]}
            onPress={() => setAnalyticsDateFilter(d)}
          >
            <Text style={[styles.dateFilterChipText, analyticsDateFilter === d && styles.dateFilterChipTextActive]}>
              {d === 'all' ? 'All Time' : d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.info }]}>
          <Eye size={18} color={Colors.info} />
          <Text style={styles.summaryValue}>{analyticsData.totalImpressions.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Impressions</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.accent }]}>
          <MousePointerClick size={18} color={Colors.accent} />
          <Text style={styles.summaryValue}>{analyticsData.totalClicks.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Clicks</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#7C5CFC' }]}>
          <TrendingUp size={18} color="#7C5CFC" />
          <Text style={styles.summaryValue}>{analyticsData.avgCtr.toFixed(1)}%</Text>
          <Text style={styles.summaryLabel}>Avg CTR</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
          <Megaphone size={18} color={Colors.success} />
          <Text style={styles.summaryValue}>{analyticsData.activeAds}</Text>
          <Text style={styles.summaryLabel}>Active Ads</Text>
        </View>
      </View>

      {(impressionsQuery.isLoading || clicksQuery.isLoading) ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : analyticsData.perAd.length === 0 ? (
        <View style={styles.emptyWrap}>
          <BarChart3 size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No analytics data</Text>
          <Text style={styles.emptySubtext}>沒有分析數據</Text>
        </View>
      ) : (
        analyticsData.perAd.map(ad => (
          <View key={ad.id} style={styles.analyticsCard}>
            <View style={styles.analyticsCardHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.analyticsCardTitle} numberOfLines={1}>{ad.title}</Text>
                <View style={[styles.placementBadge, { backgroundColor: getPlacementColor(ad.placement) + '18', alignSelf: 'flex-start' as const, marginTop: 4 }]}>
                  <Text style={[styles.placementBadgeText, { color: getPlacementColor(ad.placement) }]}>{PLACEMENT_LABELS[ad.placement] || ad.placement}</Text>
                </View>
              </View>
              <View style={styles.ctrBadge}>
                <Text style={styles.ctrValue}>{ad.ctr.toFixed(1)}%</Text>
                <Text style={styles.ctrLabel}>CTR</Text>
              </View>
            </View>
            <View style={styles.analyticsMetrics}>
              <View style={styles.metricItem}>
                <Eye size={14} color={Colors.info} />
                <Text style={styles.metricValue}>{ad.impressions.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>views</Text>
              </View>
              <View style={styles.metricItem}>
                <MousePointerClick size={14} color={Colors.accent} />
                <Text style={styles.metricValue}>{ad.clicks.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>clicks</Text>
              </View>
              <View style={styles.metricItem}>
                <Calendar size={14} color={Colors.textTertiary} />
                <Text style={styles.metricValue}>{ad.start_date?.slice(5) || '—'}</Text>
                <Text style={styles.metricLabel}>to {ad.end_date?.slice(5) || '—'}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderAdFreeTab = () => (
    <>
      {selectedBatchIds.length > 0 && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarText}>{selectedBatchIds.length} selected</Text>
          <TouchableOpacity style={styles.batchBtn} onPress={() => handleBatchAdFree(true)}>
            <UserX size={14} color={Colors.white} />
            <Text style={styles.batchBtnText}>Set Ad-Free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, { backgroundColor: Colors.danger }]} onPress={() => handleBatchAdFree(false)}>
            <Text style={styles.batchBtnText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedBatchIds([])} style={{ padding: 4 }}>
            <X size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowTiers(!showTiers)} activeOpacity={0.7}>
        <Crown size={18} color="#D4A030" />
        <Text style={styles.sectionToggleText}>Tier Ad-Free Settings 級別免廣告</Text>
        {showTiers ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </TouchableOpacity>
      {showTiers && (
        <View style={styles.tierSection}>
          {tiersQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ padding: 16 }} />
          ) : (tiersQuery.data || []).map(tier => (
            <View key={tier.id} style={styles.tierRow}>
              <Text style={styles.tierName}>{tier.name}</Text>
              <Switch
                value={tier.is_ad_free ?? false}
                onValueChange={(val) => updateTierAdFreeMutation.mutate({ id: tier.id, value: val })}
                trackColor={{ true: Colors.accent, false: Colors.border }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowClinicians(!showClinicians)} activeOpacity={0.7}>
        <Building2 size={18} color="#7C5CFC" />
        <Text style={styles.sectionToggleText}>Clinician Ad-Free Settings 治療師免廣告</Text>
        {showClinicians ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </TouchableOpacity>
      {showClinicians && (
        <View style={styles.clinicianSection}>
          {cliniciansQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ padding: 16 }} />
          ) : (cliniciansQuery.data || []).map(c => (
            <View key={c.id} style={styles.clinicianRow}>
              <Text style={styles.clinicianName} numberOfLines={1}>{c.full_name}</Text>
              <Switch
                value={c.is_ad_free_for_patients ?? false}
                onValueChange={(val) => updateClinicianAdFreeMutation.mutate({ id: c.id, value: val })}
                trackColor={{ true: Colors.accent, false: Colors.border }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Patients 患者</Text>

      {patientsAdFreeQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : filteredAdFreePatients.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Users size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No patients found</Text>
        </View>
      ) : (
        filteredAdFreePatients.map(p => {
          const source = getAdFreeSource(p);
          const isBatchSelected = selectedBatchIds.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.adFreeRow, isBatchSelected && styles.adFreeRowSelected]}
              onPress={() => toggleBatchPatient(p.id)}
              activeOpacity={0.7}
            >
              <View style={styles.adFreeCheckbox}>
                {isBatchSelected ? (
                  <Check size={16} color={Colors.accent} />
                ) : (
                  <View style={styles.uncheckedBox} />
                )}
              </View>
              <View style={styles.adFreeInfo}>
                <Text style={styles.adFreePatientName} numberOfLines={1}>{p.patient_name}</Text>
                <Text style={styles.adFreeClinicianName} numberOfLines={1}>{p.clinicians?.full_name || '—'}</Text>
              </View>
              <View style={styles.adFreeRight}>
                <View style={[styles.adFreeBadge, { backgroundColor: getAdFreeColor(source) + '18' }]}>
                  <Text style={[styles.adFreeBadgeText, { color: getAdFreeColor(source) }]}>{getAdFreeLabel(source)}</Text>
                </View>
                <Switch
                  value={p.is_ad_free ?? false}
                  onValueChange={(val) => updatePatientAdFreeMutation.mutate({ ids: [p.id], value: val })}
                  trackColor={{ true: Colors.accent, false: Colors.border }}
                  thumbColor={Colors.white}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Advertisements</Text>
            <Text style={styles.headerSubtitle}>廣告管理</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'library' && styles.tabActive]} onPress={() => setActiveTab('library')}>
          <Megaphone size={16} color={activeTab === 'library' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>Ad Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'analytics' && styles.tabActive]} onPress={() => setActiveTab('analytics')}>
          <BarChart3 size={16} color={activeTab === 'analytics' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'adfree' && styles.tabActive]} onPress={() => setActiveTab('adfree')}>
          <UserX size={16} color={activeTab === 'adfree' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'adfree' && styles.tabTextActive]}>Ad-Free</Text>
        </TouchableOpacity>
      </View>

      {(activeTab === 'library' || activeTab === 'adfree') && (
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'library' ? 'Search ads...' : 'Search patients...'}
            placeholderTextColor={Colors.textTertiary}
            value={activeTab === 'library' ? search : adFreeSearch}
            onChangeText={activeTab === 'library' ? setSearch : setAdFreeSearch}
          />
          {(activeTab === 'library' ? search : adFreeSearch).length > 0 && (
            <TouchableOpacity onPress={() => activeTab === 'library' ? setSearch('') : setAdFreeSearch('')}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'library' && renderLibraryTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
        {activeTab === 'adfree' && renderAdFreeTab()}
      </ScrollView>

      {activeTab === 'library' && (
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Ad</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title (EN) 標題 *</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ad title" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Title (繁中)</Text>
              <TextInput style={styles.input} value={titleZh} onChangeText={setTitleZh} placeholder="廣告標題" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Placement 位置 *</Text>
              <View style={styles.typePicker}>
                {PLACEMENTS.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.typeOption, placement === p.value && { backgroundColor: getPlacementColor(p.value), borderColor: getPlacementColor(p.value) }]}
                    onPress={() => setPlacement(p.value)}
                  >
                    <Text style={[styles.typeOptionText, placement === p.value && { color: Colors.white }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Image URL 圖片網址 *</Text>
              <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
              {imageUrl.trim().length > 0 && (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
              )}

              <Text style={styles.fieldLabel}>Image URL (Chinese 中文版, optional)</Text>
              <TextInput style={styles.input} value={imageUrlZh} onChangeText={setImageUrlZh} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <Text style={styles.fieldLabel}>Link URL 連結網址</Text>
              <TextInput style={styles.input} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <Text style={styles.fieldLabel}>Advertiser Name (EN)</Text>
              <TextInput style={styles.input} value={advertiserName} onChangeText={setAdvertiserName} placeholder="Company name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Advertiser Name (繁中)</Text>
              <TextInput style={styles.input} value={advertiserNameZh} onChangeText={setAdvertiserNameZh} placeholder="公司名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Advertiser Logo URL</Text>
              <TextInput style={styles.input} value={advertiserLogoUrl} onChangeText={setAdvertiserLogoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Duration (s) 時長</Text>
                  <TextInput style={styles.input} value={durationSeconds} onChangeText={setDurationSeconds} placeholder="5" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Skip Delay (s) 跳過延遲</Text>
                  <TextInput style={styles.input} value={skipDelaySeconds} onChangeText={setSkipDelaySeconds} placeholder="2" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Target Type 目標類型</Text>
              <View style={styles.typePicker}>
                <TouchableOpacity
                  style={[styles.typeOption, targetType === 'all' && { backgroundColor: Colors.success, borderColor: Colors.success }]}
                  onPress={() => setTargetType('all')}
                >
                  <Text style={[styles.typeOptionText, targetType === 'all' && { color: Colors.white }]}>All Patients</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, targetType === 'specific' && { backgroundColor: '#E07A3A', borderColor: '#E07A3A' }]}
                  onPress={() => setTargetType('specific')}
                >
                  <Text style={[styles.typeOptionText, targetType === 'specific' && { color: Colors.white }]}>Specific</Text>
                </TouchableOpacity>
              </View>

              {targetType === 'specific' && (
                <View style={styles.patientSection}>
                  <View style={styles.patientSectionHeader}>
                    <Text style={styles.patientSectionTitle}>Select Patients 選擇患者</Text>
                    <Text style={styles.patientSectionCount}>{selectedPatientIds.length} selected</Text>
                  </View>
                  <View style={styles.selectAllRow}>
                    <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllPatients}>
                      <CheckSquare size={14} color={Colors.accent} />
                      <Text style={styles.selectAllText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selectAllBtn} onPress={deselectAllPatients}>
                      <Square size={14} color={Colors.textTertiary} />
                      <Text style={styles.deselectAllText}>Deselect</Text>
                    </TouchableOpacity>
                  </View>
                  {patientsQuery.isLoading ? (
                    <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 12 }} />
                  ) : (
                    <View style={styles.patientList}>
                      {(patientsQuery.data || []).map(p => {
                        const isSelected = selectedPatientIds.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.patientRow, isSelected && styles.patientRowSelected]}
                            onPress={() => togglePatient(p.id)}
                            activeOpacity={0.7}
                          >
                            {isSelected ? (
                              <Check size={16} color={Colors.accent} />
                            ) : (
                              <View style={styles.uncheckedBox} />
                            )}
                            <Text style={[styles.patientName, isSelected && { color: Colors.text, fontWeight: '600' as const }]}>{p.patient_name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Start Date 開始 *</Text>
                  <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>End Date 結束 *</Text>
                  <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.accent,
  },
  tabText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textTertiary },
  tabTextActive: { color: Colors.accent, fontWeight: '600' as const },
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
  filterRow: {
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 0,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  statusChipActive: {
    backgroundColor: Colors.text,
  },
  statusChipText: { fontSize: 12, fontWeight: '500' as const, color: Colors.textSecondary },
  statusChipTextActive: { color: Colors.white },
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
  cardExpired: {
    opacity: 0.55,
  },
  cardThumb: { width: '100%', height: 80 },
  cardThumbPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  cardAdvertiser: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  placementBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  placementBadgeText: { fontSize: 11, fontWeight: '600' as const },
  targetBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  targetBadgeText: { fontSize: 11, fontWeight: '600' as const },
  targetCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSecondary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  targetCountText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary },
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeOptionText: { fontSize: 13, color: Colors.text, fontWeight: '500' as const },
  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
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
  patientSection: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  patientSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surfaceSecondary,
  },
  patientSectionTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  patientSectionCount: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  selectAllRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 13, color: Colors.accent, fontWeight: '500' as const },
  deselectAllText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' as const },
  patientList: { maxHeight: 260 },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  patientRowSelected: { backgroundColor: Colors.accent + '08' },
  uncheckedBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  patientName: { fontSize: 14, color: Colors.textSecondary },
  dateFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dateFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateFilterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dateFilterChipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  dateFilterChipTextActive: { color: Colors.white },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    width: '47%' as any,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginTop: 6 },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  analyticsCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  analyticsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  analyticsCardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  ctrBadge: {
    backgroundColor: Colors.accent + '14',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  ctrValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent },
  ctrLabel: { fontSize: 10, color: Colors.accent, fontWeight: '500' as const },
  analyticsMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.textTertiary },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accent + '12',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  batchBarText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent, flex: 1 },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  batchBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionToggleText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  tierSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tierName: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  clinicianSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  clinicianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  clinicianName: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, flex: 1, marginRight: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  adFreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  adFreeRowSelected: {
    backgroundColor: Colors.accent + '08',
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  adFreeCheckbox: { marginRight: 10 },
  adFreeInfo: { flex: 1 },
  adFreePatientName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  adFreeClinicianName: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  adFreeRight: { alignItems: 'flex-end', gap: 4 },
  adFreeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adFreeBadgeText: { fontSize: 10, fontWeight: '600' as const },
});
