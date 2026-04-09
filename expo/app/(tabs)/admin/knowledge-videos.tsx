import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Plus,
  Trash2,
  Shield,
  Video,
  Play,
  Send,
  Users,
  User,
  Calendar,
  Eye,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - GRID_GAP) / 2;

type TabKey = 'library' | 'pushed';

interface KnowledgeVideo {
  id: string;
  title_en: string;
  title_zh?: string;
  description_en?: string;
  description_zh?: string;
  category?: string;
  vimeo_video_id?: string;
  youtube_video_id?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  tags?: string[];
  is_active: boolean;
  created_at: string;
  creator_name_en?: string;
  creator_name_zh?: string;
  provider_org_en?: string;
  provider_org_zh?: string;
  provider_logo_url?: string;
  is_public?: boolean;
}

interface PatientOption {
  id: string;
  patient_name: string;
}

interface KnowledgeVideoAssignment {
  id: string;
  video_id: string;
  patient_id: string;
  target_type: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  viewed_at?: string;
  created_at: string;
  patients?: { patient_name: string } | null;
  knowledge_videos?: { title_en: string; category: string | null } | null;
}

function getThumbnail(v: KnowledgeVideo): string | null {
  if (v.youtube_video_id) return `https://img.youtube.com/vi/${v.youtube_video_id}/mqdefault.jpg`;
  if (v.thumbnail_url) return v.thumbnail_url;
  return null;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s > 0 ? `${s}s` : ''}`.trim() : `${s}s`;
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  } catch { return d; }
}

function isExpired(endDate?: string | null): boolean {
  if (!endDate) return false;
  try {
    return new Date(endDate) < new Date();
  } catch { return false; }
}

export default function KnowledgeVideosScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('library');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushingVideo, setPushingVideo] = useState<KnowledgeVideo | null>(null);

  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [category, setCategory] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [vimeoId, setVimeoId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [creatorEn, setCreatorEn] = useState('');
  const [creatorZh, setCreatorZh] = useState('');
  const [providerOrgEn, setProviderOrgEn] = useState('');
  const [providerOrgZh, setProviderOrgZh] = useState('');
  const [providerLogoUrl, setProviderLogoUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [pushTargetType, setPushTargetType] = useState<'all' | 'specific'>('specific');
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [pushStartDate, setPushStartDate] = useState('');
  const [pushEndDate, setPushEndDate] = useState('');

  const videosQuery = useQuery({
    queryKey: ['admin-knowledge-videos'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('knowledge_videos')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as KnowledgeVideo[];
      } catch (e) {
        console.log('Error fetching knowledge videos:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientsQuery = useQuery({
    queryKey: ['admin-all-patients-for-push'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name')
          .eq('is_frozen', false)
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientOption[];
      } catch (e) {
        console.log('Error fetching patients for push:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const assignmentsQuery = useQuery({
    queryKey: ['admin-knowledge-video-assignments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('knowledge_video_assignments')
          .select('*, patients(patient_name), knowledge_videos(title_en, category)')
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Error fetching knowledge video assignments:', error);
          return [];
        }
        return (data || []) as KnowledgeVideoAssignment[];
      } catch (e) {
        console.log('Exception fetching assignments:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'pushed',
  });

  const filtered = useMemo(() => {
    if (!videosQuery.data) return [];
    if (!search.trim()) return videosQuery.data;
    const s = search.toLowerCase();
    return videosQuery.data.filter(v =>
      v.title_en?.toLowerCase().includes(s) ||
      v.title_zh?.toLowerCase().includes(s) ||
      v.category?.toLowerCase().includes(s)
    );
  }, [videosQuery.data, search]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitleEn(''); setTitleZh(''); setDescEn(''); setDescZh('');
    setCategory(''); setYoutubeId(''); setVimeoId(''); setThumbnailUrl('');
    setDurationSeconds(''); setTagsText(''); setCreatorEn(''); setCreatorZh('');
    setProviderOrgEn(''); setProviderOrgZh(''); setProviderLogoUrl('');
    setIsPublic(false); setIsActive(true);
  }, []);

  const openNew = useCallback(() => { resetForm(); setModalVisible(true); }, [resetForm]);

  const openEdit = useCallback((v: KnowledgeVideo) => {
    setEditingId(v.id);
    setTitleEn(v.title_en || ''); setTitleZh(v.title_zh || '');
    setDescEn(v.description_en || ''); setDescZh(v.description_zh || '');
    setCategory(v.category || ''); setYoutubeId(v.youtube_video_id || '');
    setVimeoId(v.vimeo_video_id || ''); setThumbnailUrl(v.thumbnail_url || '');
    setDurationSeconds(v.duration_seconds ? String(v.duration_seconds) : '');
    setTagsText(Array.isArray(v.tags) ? v.tags.join(', ') : '');
    setCreatorEn(v.creator_name_en || ''); setCreatorZh(v.creator_name_zh || '');
    setProviderOrgEn(v.provider_org_en || ''); setProviderOrgZh(v.provider_org_zh || '');
    setProviderLogoUrl(v.provider_logo_url || '');
    setIsPublic(v.is_public ?? false); setIsActive(v.is_active ?? true);
    setModalVisible(true);
  }, []);

  const openPush = useCallback((v: KnowledgeVideo) => {
    setPushingVideo(v);
    setPushTargetType('specific');
    setSelectedPatientIds([]);
    const today = new Date().toISOString().split('T')[0];
    setPushStartDate(today);
    setPushEndDate('');
    setPushModalVisible(true);
  }, []);

  const togglePatient = useCallback((id: string) => {
    setSelectedPatientIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }, []);

  const selectAllPatients = useCallback(() => {
    const allIds = (patientsQuery.data || []).map(p => p.id);
    setSelectedPatientIds(allIds);
  }, [patientsQuery.data]);

  const deselectAllPatients = useCallback(() => {
    setSelectedPatientIds([]);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!titleEn.trim()) throw new Error('English title is required');
      const parsedTags = tagsText.trim() ? tagsText.split(',').map(t => t.trim()).filter(Boolean) : null;
      const payload: Record<string, unknown> = {
        title_en: titleEn.trim(), title_zh: titleZh.trim() || null,
        description_en: descEn.trim() || null, description_zh: descZh.trim() || null,
        category: category.trim() || null, youtube_video_id: youtubeId.trim() || null,
        vimeo_video_id: vimeoId.trim() || null, thumbnail_url: thumbnailUrl.trim() || null,
        duration_seconds: parseInt(durationSeconds, 10) || null, tags: parsedTags,
        creator_name_en: creatorEn.trim() || null, creator_name_zh: creatorZh.trim() || null,
        provider_org_en: providerOrgEn.trim() || null, provider_org_zh: providerOrgZh.trim() || null,
        provider_logo_url: providerLogoUrl.trim() || null, is_public: isPublic, is_active: isActive,
      };
      if (editingId) {
        const { error } = await supabase.from('knowledge_videos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_videos').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-videos'] }); setModalVisible(false); },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      if (!pushingVideo) throw new Error('No video selected');
      const videoId = pushingVideo.id;
      const startDate = pushStartDate.trim() || new Date().toISOString().split('T')[0];
      const endDate = pushEndDate.trim() || null;

      let patientIds: string[] = [];
      if (pushTargetType === 'all') {
        patientIds = (patientsQuery.data || []).map(p => p.id);
      } else {
        patientIds = selectedPatientIds;
      }

      if (patientIds.length === 0) throw new Error('No patients selected');

      let successCount = 0;
      let errorCount = 0;
      for (const patientId of patientIds) {
        try {
          const { error } = await supabase
            .from('knowledge_video_assignments')
            .upsert({
              video_id: videoId,
              patient_id: patientId,
              target_type: pushTargetType,
              start_date: startDate,
              end_date: endDate,
              is_active: true,
            }, { onConflict: 'video_id,patient_id' });
          if (error) {
            console.log('Push assignment error for patient', patientId, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.log('Push assignment exception:', e);
          errorCount++;
        }
      }
      return { successCount, errorCount };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-video-assignments'] });
      setPushModalVisible(false);
      const msg = result.errorCount > 0
        ? `Pushed to ${result.successCount} patients (${result.errorCount} failed)\n已推送至 ${result.successCount} 位患者（${result.errorCount} 失敗）`
        : `Pushed to ${result.successCount} patients\n已推送至 ${result.successCount} 位患者`;
      Alert.alert('Success 成功', msg);
    },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-videos'] }); },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_video_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-video-assignments'] }); },
    onError: (error: Error) => { Alert.alert('Error', error.message); },
  });

  const confirmDelete = useCallback((id: string, e?: { stopPropagation?: () => void }) => {
    if (e?.stopPropagation) e.stopPropagation();
    Alert.alert('Delete Video 刪除影片', 'Are you sure? 確定刪除？', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }, [deleteMutation]);

  const confirmRemoveAssignment = useCallback((id: string) => {
    Alert.alert('Remove Assignment 移除分配', 'Remove this assignment? 確定移除？', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeAssignmentMutation.mutate(id) },
    ]);
  }, [removeAssignmentMutation]);

  const renderGridItem = useCallback(({ item }: { item: KnowledgeVideo }) => {
    const thumb = getThumbnail(item);
    const dur = formatDuration(item.duration_seconds);
    return (
      <TouchableOpacity style={styles.gridCard} onPress={() => openEdit(item)} activeOpacity={0.7}>
        <View style={styles.gridThumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.gridThumb} resizeMode="cover" />
          ) : (
            <View style={styles.gridThumbPlaceholder}>
              <Video size={24} color={Colors.textTertiary} />
            </View>
          )}
          <View style={styles.gridPlayOverlay}>
            <Play size={16} color={Colors.white} fill={Colors.white} />
          </View>
          {dur ? (
            <View style={styles.gridDurBadge}>
              <Text style={styles.gridDurText}>{dur}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.gridDeleteBtn}
            onPress={() => confirmDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={13} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.gridTitle} numberOfLines={2}>{item.title_en}</Text>
          {item.title_zh ? <Text style={styles.gridTitleZh} numberOfLines={1}>{item.title_zh}</Text> : null}
          <View style={styles.gridMeta}>
            {item.category ? (
              <View style={styles.gridCatBadge}>
                <Text style={styles.gridCatText} numberOfLines={1}>{item.category}</Text>
              </View>
            ) : null}
            <View style={[styles.gridStatusDot, { backgroundColor: item.is_active ? Colors.success : Colors.frozen }]} />
          </View>
          {item.creator_name_en ? (
            <Text style={styles.gridCreator} numberOfLines={1}>By {item.creator_name_en}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.pushBtn}
            onPress={(e) => { e.stopPropagation?.(); openPush(item); }}
            activeOpacity={0.7}
          >
            <Send size={11} color={Colors.white} />
            <Text style={styles.pushBtnText}>Push 推送</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [openEdit, confirmDelete, openPush]);

  const renderAssignmentItem = useCallback(({ item }: { item: KnowledgeVideoAssignment }) => {
    const expired = isExpired(item.end_date);
    const videoTitle = item.knowledge_videos?.title_en || 'Unknown Video';
    const videoCategory = item.knowledge_videos?.category || '';
    const patientName = item.patients?.patient_name || 'Unknown Patient';
    return (
      <View style={[styles.assignmentCard, expired && styles.assignmentCardExpired]}>
        <View style={styles.assignmentTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.assignmentTitle, expired && styles.expiredText]} numberOfLines={1}>{videoTitle}</Text>
            <View style={styles.assignmentRow}>
              <User size={12} color={expired ? Colors.textTertiary : Colors.textSecondary} />
              <Text style={[styles.assignmentPatient, expired && styles.expiredText]}>{patientName}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => confirmRemoveAssignment(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.removeBtn}
          >
            <Trash2 size={14} color={Colors.danger} />
          </TouchableOpacity>
        </View>
        <View style={styles.assignmentBadges}>
          {videoCategory ? (
            <View style={styles.catBadgeSmall}>
              <Text style={styles.catBadgeSmallText}>{videoCategory}</Text>
            </View>
          ) : null}
          <View style={[styles.targetBadge, item.target_type === 'all' ? styles.targetAll : styles.targetSpecific]}>
            {item.target_type === 'all' ? <Users size={10} color={Colors.info} /> : <User size={10} color={Colors.accent} />}
            <Text style={[styles.targetBadgeText, { color: item.target_type === 'all' ? Colors.info : Colors.accent }]}>
              {item.target_type === 'all' ? 'All' : 'Specific'}
            </Text>
          </View>
          {item.viewed_at ? (
            <View style={styles.viewedBadge}>
              <Eye size={10} color={Colors.success} />
              <Text style={styles.viewedBadgeText}>Viewed 已觀看</Text>
            </View>
          ) : (
            <View style={styles.notViewedBadge}>
              <Clock size={10} color={Colors.warning} />
              <Text style={styles.notViewedBadgeText}>Not viewed 未觀看</Text>
            </View>
          )}
        </View>
        <View style={styles.assignmentDates}>
          <Calendar size={11} color={Colors.textTertiary} />
          <Text style={[styles.assignmentDateText, expired && styles.expiredText]}>
            {formatDate(item.start_date)} → {formatDate(item.end_date)}
            {expired ? '  (Expired 已過期)' : ''}
          </Text>
        </View>
      </View>
    );
  }, [confirmRemoveAssignment]);

  const keyExtractor = useCallback((item: KnowledgeVideo) => item.id, []);
  const assignmentKeyExtractor = useCallback((item: KnowledgeVideoAssignment) => item.id, []);

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
            <Text style={styles.headerTitle}>Knowledge Videos</Text>
            <Text style={styles.headerSubtitle}>知識影片</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'library' && styles.tabItemActive]}
          onPress={() => setActiveTab('library')}
        >
          <Video size={15} color={activeTab === 'library' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>Library 庫</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pushed' && styles.tabItemActive]}
          onPress={() => setActiveTab('pushed')}
        >
          <Send size={15} color={activeTab === 'pushed' ? Colors.accent : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'pushed' && styles.tabTextActive]}>Pushed 已推送</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'library' ? (
        <>
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search videos..."
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

          {videosQuery.isLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Video size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No knowledge videos found</Text>
              <Text style={styles.emptySubtext}>找不到知識影片</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderGridItem}
              keyExtractor={keyExtractor}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={videosQuery.isFetching} onRefresh={() => void videosQuery.refetch()} tintColor={Colors.accent} />
              }
            />
          )}

          <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
            <Plus size={24} color={Colors.white} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          {assignmentsQuery.isLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
          ) : (assignmentsQuery.data || []).length === 0 ? (
            <View style={styles.emptyWrap}>
              <Send size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No pushed assignments</Text>
              <Text style={styles.emptySubtext}>沒有推送記錄</Text>
            </View>
          ) : (
            <FlatList
              data={assignmentsQuery.data || []}
              renderItem={renderAssignmentItem}
              keyExtractor={assignmentKeyExtractor}
              contentContainerStyle={styles.assignmentListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={assignmentsQuery.isFetching} onRefresh={() => void assignmentsQuery.refetch()} tintColor={Colors.accent} />
              }
            />
          )}
        </>
      )}

      {/* Edit/New Video Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Video</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionHeader}>Basic Info 基本資料</Text>
              <Text style={styles.fieldLabel}>Title (EN) 標題 *</Text>
              <TextInput style={styles.input} value={titleEn} onChangeText={setTitleEn} placeholder="English title" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Title (繁中) 標題</Text>
              <TextInput style={styles.input} value={titleZh} onChangeText={setTitleZh} placeholder="中文標題" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Description (EN) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descEn} onChangeText={setDescEn} placeholder="English description" placeholderTextColor={Colors.textTertiary} multiline />
              <Text style={styles.fieldLabel}>Description (繁中) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descZh} onChangeText={setDescZh} placeholder="中文描述" placeholderTextColor={Colors.textTertiary} multiline />
              <Text style={styles.fieldLabel}>Category 分類</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Speech, Swallowing" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.sectionHeader}>Video Sources 影片來源</Text>
              <Text style={styles.fieldLabel}>YouTube Video ID</Text>
              <TextInput style={styles.input} value={youtubeId} onChangeText={setYoutubeId} placeholder="e.g. dQw4w9WgXcQ" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {youtubeId.trim().length > 0 && (
                <Image source={{ uri: `https://img.youtube.com/vi/${youtubeId.trim()}/mqdefault.jpg` }} style={styles.previewImage} resizeMode="cover" />
              )}
              <Text style={styles.fieldLabel}>Vimeo Video ID</Text>
              <TextInput style={styles.input} value={vimeoId} onChangeText={setVimeoId} placeholder="e.g. 123456789" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              <Text style={styles.fieldLabel}>Thumbnail URL 縮圖</Text>
              <TextInput style={styles.input} value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
              <Text style={styles.fieldLabel}>Duration (seconds) 時長</Text>
              <TextInput style={styles.input} value={durationSeconds} onChangeText={setDurationSeconds} placeholder="120" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>Tags 標籤 (comma-separated)</Text>
              <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} placeholder="speech, therapy, adults" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.sectionHeader}>Creator / Provider 創作者</Text>
              <Text style={styles.fieldLabel}>Creator Name (EN)</Text>
              <TextInput style={styles.input} value={creatorEn} onChangeText={setCreatorEn} placeholder="Creator name" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Creator Name (繁中)</Text>
              <TextInput style={styles.input} value={creatorZh} onChangeText={setCreatorZh} placeholder="創作者姓名" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Provider Org (EN)</Text>
              <TextInput style={styles.input} value={providerOrgEn} onChangeText={setProviderOrgEn} placeholder="Organisation name" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Provider Org (繁中)</Text>
              <TextInput style={styles.input} value={providerOrgZh} onChangeText={setProviderOrgZh} placeholder="機構名稱" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Provider Logo URL</Text>
              <TextInput style={styles.input} value={providerLogoUrl} onChangeText={setProviderLogoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Public 公開</Text>
                <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: Colors.info, false: Colors.border }} thumbColor={Colors.white} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Push Modal */}
      <Modal visible={pushModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPushModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Push Video 推送影片</Text>
              <TouchableOpacity onPress={() => pushMutation.mutate()} disabled={pushMutation.isPending}>
                {pushMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Push 推送</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {pushingVideo && (
                <View style={styles.pushVideoPreview}>
                  <Video size={16} color={Colors.accent} />
                  <Text style={styles.pushVideoTitle} numberOfLines={2}>{pushingVideo.title_en}</Text>
                </View>
              )}

              <Text style={styles.sectionHeader}>Target 目標</Text>
              <View style={styles.targetTypeRow}>
                <TouchableOpacity
                  style={[styles.targetTypeBtn, pushTargetType === 'all' && styles.targetTypeBtnActive]}
                  onPress={() => setPushTargetType('all')}
                >
                  <Users size={14} color={pushTargetType === 'all' ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.targetTypeBtnText, pushTargetType === 'all' && styles.targetTypeBtnTextActive]}>
                    All Patients 全部患者
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.targetTypeBtn, pushTargetType === 'specific' && styles.targetTypeBtnActive]}
                  onPress={() => setPushTargetType('specific')}
                >
                  <User size={14} color={pushTargetType === 'specific' ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.targetTypeBtnText, pushTargetType === 'specific' && styles.targetTypeBtnTextActive]}>
                    Specific 指定患者
                  </Text>
                </TouchableOpacity>
              </View>

              {pushTargetType === 'specific' && (
                <>
                  <View style={styles.selectAllRow}>
                    <TouchableOpacity onPress={selectAllPatients} style={styles.selectAllBtn}>
                      <CheckSquare size={14} color={Colors.info} />
                      <Text style={styles.selectAllText}>Select All 全選</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={deselectAllPatients} style={styles.selectAllBtn}>
                      <Square size={14} color={Colors.textTertiary} />
                      <Text style={styles.deselectAllText}>Deselect All 取消全選</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.patientCheckList}>
                    {patientsQuery.isLoading ? (
                      <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 12 }} />
                    ) : (patientsQuery.data || []).length === 0 ? (
                      <Text style={styles.noPatientText}>No patients found 找不到患者</Text>
                    ) : (
                      (patientsQuery.data || []).map(p => {
                        const checked = selectedPatientIds.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.patientCheckRow, checked && styles.patientCheckRowActive]}
                            onPress={() => togglePatient(p.id)}
                            activeOpacity={0.7}
                          >
                            {checked ? (
                              <CheckSquare size={18} color={Colors.accent} />
                            ) : (
                              <Square size={18} color={Colors.border} />
                            )}
                            <Text style={[styles.patientCheckName, checked && styles.patientCheckNameActive]}>
                              {p.patient_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                  <Text style={styles.selectedCount}>
                    {selectedPatientIds.length} selected 已選
                  </Text>
                </>
              )}

              <Text style={styles.sectionHeader}>Date Range 日期範圍</Text>
              <Text style={styles.fieldLabel}>Start Date 開始日期</Text>
              <TextInput
                style={styles.input}
                value={pushStartDate}
                onChangeText={setPushStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>End Date 結束日期 (optional)</Text>
              <TextInput
                style={styles.input}
                value={pushEndDate}
                onChangeText={setPushEndDate}
                placeholder="YYYY-MM-DD"
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.accent },
  tabText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textTertiary },
  tabTextActive: { color: Colors.accent, fontWeight: '600' as const },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  gridContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  gridRow: { justifyContent: 'space-between' as const },
  gridCard: {
    width: GRID_CARD_WIDTH, backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden' as const,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 2,
  },
  gridThumbWrap: { position: 'relative' as const, width: '100%' as const, height: 120 },
  gridThumb: { width: '100%' as const, height: 120 },
  gridThumbPlaceholder: { width: '100%' as const, height: 120, backgroundColor: Colors.surfaceSecondary, alignItems: 'center' as const, justifyContent: 'center' as const },
  gridPlayOverlay: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  gridDurBadge: {
    position: 'absolute' as const, bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  gridDurText: { fontSize: 10, color: Colors.white, fontWeight: '600' as const },
  gridDeleteBtn: {
    position: 'absolute' as const, top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  gridBody: { padding: 10, gap: 3 },
  gridTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text, lineHeight: 17 },
  gridTitleZh: { fontSize: 11, color: Colors.textSecondary },
  gridMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  gridCatBadge: { backgroundColor: Colors.accentLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 80 },
  gridCatText: { fontSize: 9, fontWeight: '600' as const, color: Colors.accentDark },
  gridStatusDot: { width: 7, height: 7, borderRadius: 4 },
  gridCreator: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  pushBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.info, borderRadius: 6, paddingVertical: 5, marginTop: 6,
  },
  pushBtnText: { fontSize: 11, fontWeight: '600' as const, color: Colors.white },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 6 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySubtext: { fontSize: 13, color: Colors.textTertiary },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  saveText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 14, fontWeight: '700' as const, color: Colors.accent,
    marginTop: 20, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  multiline: { height: 80, textAlignVertical: 'top' as const },
  previewImage: { width: '100%', height: 120, borderRadius: 10, marginTop: 10, backgroundColor: Colors.surfaceSecondary },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, backgroundColor: Colors.white, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  pushVideoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accentLight,
    borderRadius: 10, padding: 12,
  },
  pushVideoTitle: { flex: 1, fontSize: 15, fontWeight: '600' as const, color: Colors.accentDark },
  targetTypeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  targetTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  targetTypeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  targetTypeBtnText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  targetTypeBtnTextActive: { color: Colors.white },
  selectAllRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectAllText: { fontSize: 13, fontWeight: '500' as const, color: Colors.info },
  deselectAllText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textTertiary },
  patientCheckList: {
    marginTop: 10, backgroundColor: Colors.white, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, maxHeight: 300,
  },
  noPatientText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', padding: 16 },
  patientCheckRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  patientCheckRowActive: { backgroundColor: Colors.accentLight + '30' },
  patientCheckName: { fontSize: 14, color: Colors.text, flex: 1 },
  patientCheckNameActive: { fontWeight: '600' as const, color: Colors.accentDark },
  selectedCount: { fontSize: 12, color: Colors.textTertiary, marginTop: 6, textAlign: 'right' },
  assignmentListContent: { padding: 16, paddingBottom: 40, gap: 10 },
  assignmentCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 14,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  assignmentCardExpired: { opacity: 0.5 },
  assignmentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  assignmentTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assignmentPatient: { fontSize: 13, color: Colors.textSecondary },
  removeBtn: { padding: 4 },
  assignmentBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  catBadgeSmall: { backgroundColor: Colors.accentLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeSmallText: { fontSize: 10, fontWeight: '600' as const, color: Colors.accentDark },
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  targetAll: { backgroundColor: Colors.infoLight },
  targetSpecific: { backgroundColor: Colors.accentLight },
  targetBadgeText: { fontSize: 10, fontWeight: '600' as const },
  viewedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.successLight,
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  viewedBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.success },
  notViewedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningLight,
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  notViewedBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.warning },
  assignmentDates: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  assignmentDateText: { fontSize: 12, color: Colors.textTertiary },
  expiredText: { color: Colors.textTertiary },
});
