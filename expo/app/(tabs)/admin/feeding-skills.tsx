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
  FlatList,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  ChevronDown,
  Plus,
  Trash2,
  Shield,
  Utensils,
  Play,
  Send,
  Check,
  Users,
  Eye,
  EyeOff,
  Star,
  Calendar,
  ClipboardList,
  FileVideo,
  Filter,
  ExternalLink,
  Edit3,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type TabKey = 'library' | 'pushed' | 'review';

interface FeedingSkillVideo {
  id: string;
  title_en: string;
  title_zh?: string;
  description_en?: string;
  description_zh?: string;
  category?: string;
  vimeo_video_id?: string;
  youtube_video_id?: string;
  creator_name_en?: string;
  creator_name_zh?: string;
  tags?: string[];
  is_active: boolean;
  created_at: string;
}

interface PatientPick {
  id: string;
  patient_name: string;
  access_code: string;
}

interface FeedingSkillAssignment {
  id: string;
  video_id: string;
  patient_id: string;
  target_type: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  viewed_at?: string;
  created_at: string;
  feeding_skill_videos?: { title_en: string; title_zh?: string } | null;
  patients?: { patient_name: string } | null;
}

interface FeedingReviewRequirement {
  id: string;
  program_id?: string;
  patient_id: string;
  feeding_skill_video_id: string;
  max_submissions?: number;
  allowed_days?: string[];
  notes?: string;
  is_active: boolean;
  created_at: string;
  feeding_skill_videos?: { title_en: string; title_zh?: string } | null;
  patients?: { patient_name: string } | null;
}

interface FeedingVideoSubmission {
  id: string;
  patient_id: string;
  feeding_skill_video_id?: string;
  video_title_en?: string;
  video_url?: string;
  submission_date?: string;
  review_status: string;
  rating?: number;
  reviewer_notes?: string;
  reviewed_at?: string;
  created_at: string;
  patients?: { patient_name: string } | null;
}

const CATEGORIES = [
  { value: '', label: 'All 全部' },
  { value: 'texture_modified', label: 'Texture Modified 質地調整' },
  { value: 'thickened_fluids', label: 'Thickened Fluids 增稠液體' },
  { value: 'positioning', label: 'Positioning 姿勢' },
  { value: 'feeding_technique', label: 'Feeding Technique 餵食技巧' },
  { value: 'oral_care', label: 'Oral Care 口腔護理' },
  { value: 'safety_signs', label: 'Safety Signs 安全徵兆' },
  { value: 'other', label: 'Other 其他' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getThumbnail(v: FeedingSkillVideo): string | null {
  if (v.youtube_video_id) return `https://img.youtube.com/vi/${v.youtube_video_id}/mqdefault.jpg`;
  return null;
}

function statusColor(status: string): string {
  switch (status) {
    case 'reviewed': return Colors.success;
    case 'redo_requested': return Colors.danger;
    default: return Colors.warning;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'reviewed': return 'Reviewed 已審核';
    case 'redo_requested': return 'Redo 重做';
    default: return 'Pending 待審核';
  }
}

export default function FeedingSkillsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('library');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [category, setCategory] = useState('');
  const [showFormCategoryPicker, setShowFormCategoryPicker] = useState(false);
  const [youtubeId, setYoutubeId] = useState('');
  const [vimeoId, setVimeoId] = useState('');
  const [creatorEn, setCreatorEn] = useState('');
  const [creatorZh, setCreatorZh] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushVideoId, setPushVideoId] = useState<string | null>(null);
  const [pushVideoTitle, setPushVideoTitle] = useState('');
  const [pushPatientIds, setPushPatientIds] = useState<string[]>([]);
  const [pushPatientSearch, setPushPatientSearch] = useState('');
  const [pushStartDate, setPushStartDate] = useState('');
  const [pushEndDate, setPushEndDate] = useState('');
  const [pushTargetType, setPushTargetType] = useState<'individual' | 'all'>('individual');

  const [bulkPushModalVisible, setBulkPushModalVisible] = useState(false);
  const [bulkSelectedVideoIds, setBulkSelectedVideoIds] = useState<string[]>([]);
  const [bulkPatientIds, setBulkPatientIds] = useState<string[]>([]);
  const [bulkPatientSearch, setBulkPatientSearch] = useState('');
  const [bulkStep, setBulkStep] = useState<'videos' | 'patients'>('videos');

  const [reviewReqModalVisible, setReviewReqModalVisible] = useState(false);
  const [reqPatientId, setReqPatientId] = useState('');
  const [reqVideoId, setReqVideoId] = useState('');
  const [reqMaxSubmissions, setReqMaxSubmissions] = useState('');
  const [reqAllowedDays, setReqAllowedDays] = useState<string[]>([]);
  const [reqNotes, setReqNotes] = useState('');
  const [reqIsActive, setReqIsActive] = useState(true);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<FeedingVideoSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState('reviewed');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState('');

  const videosQuery = useQuery({
    queryKey: ['admin-feeding-skills'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('feeding_skill_videos')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as FeedingSkillVideo[];
      } catch (e) {
        console.log('Error fetching feeding skill videos:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const patientsQuery = useQuery({
    queryKey: ['feeding-push-patients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, access_code')
          .eq('is_frozen', false)
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientPick[];
      } catch (e) {
        console.log('Error fetching patients for push:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const assignmentsQuery = useQuery({
    queryKey: ['admin-feeding-assignments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('feeding_skill_assignments')
          .select('*, feeding_skill_videos(title_en, title_zh), patients(patient_name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as FeedingSkillAssignment[];
      } catch (e) {
        console.log('Error fetching feeding assignments:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'pushed',
  });

  const reviewReqsQuery = useQuery({
    queryKey: ['admin-feeding-review-requirements'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('feeding_skill_review_requirements')
          .select('*, feeding_skill_videos(title_en, title_zh), patients(patient_name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as FeedingReviewRequirement[];
      } catch (e) {
        console.log('Error fetching feeding review requirements:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'review',
  });

  const submissionsQuery = useQuery({
    queryKey: ['admin-feeding-video-submissions'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('feeding_skill_video_submissions')
          .select('*, patients(patient_name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as FeedingVideoSubmission[];
      } catch (e) {
        console.log('Error fetching feeding video submissions:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'review',
  });

  const filtered = useMemo(() => {
    if (!videosQuery.data) return [];
    let result = videosQuery.data;
    if (selectedCategory) {
      result = result.filter(v => v.category === selectedCategory);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.title_en?.toLowerCase().includes(s) ||
        v.title_zh?.toLowerCase().includes(s) ||
        v.category?.toLowerCase().includes(s) ||
        v.creator_name_en?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [videosQuery.data, search, selectedCategory]);

  const filteredPushPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!pushPatientSearch.trim()) return patientsQuery.data;
    const s = pushPatientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, pushPatientSearch]);

  const filteredBulkPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!bulkPatientSearch.trim()) return patientsQuery.data;
    const s = bulkPatientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, bulkPatientSearch]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitleEn(''); setTitleZh(''); setDescEn(''); setDescZh('');
    setCategory(''); setYoutubeId(''); setVimeoId('');
    setCreatorEn(''); setCreatorZh(''); setTagsText(''); setIsActive(true);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((v: FeedingSkillVideo) => {
    setEditingId(v.id);
    setTitleEn(v.title_en || ''); setTitleZh(v.title_zh || '');
    setDescEn(v.description_en || ''); setDescZh(v.description_zh || '');
    setCategory(v.category || ''); setYoutubeId(v.youtube_video_id || '');
    setVimeoId(v.vimeo_video_id || ''); setCreatorEn(v.creator_name_en || '');
    setCreatorZh(v.creator_name_zh || '');
    setTagsText(Array.isArray(v.tags) ? v.tags.join(', ') : '');
    setIsActive(v.is_active ?? true);
    setModalVisible(true);
  }, []);

  const openPushToPatient = useCallback((v: FeedingSkillVideo) => {
    setPushVideoId(v.id);
    setPushVideoTitle(v.title_en);
    setPushPatientIds([]);
    setPushPatientSearch('');
    setPushStartDate(new Date().toISOString().split('T')[0]);
    setPushEndDate('');
    setPushTargetType('individual');
    setPushModalVisible(true);
  }, []);

  const openBulkPush = useCallback(() => {
    setBulkSelectedVideoIds([]);
    setBulkPatientIds([]);
    setBulkPatientSearch('');
    setBulkStep('videos');
    setBulkPushModalVisible(true);
  }, []);

  const openNewReviewReq = useCallback(() => {
    setEditingReqId(null);
    setReqPatientId('');
    setReqVideoId('');
    setReqMaxSubmissions('');
    setReqAllowedDays([]);
    setReqNotes('');
    setReqIsActive(true);
    setReviewReqModalVisible(true);
  }, []);

  const openEditReviewReq = useCallback((req: FeedingReviewRequirement) => {
    setEditingReqId(req.id);
    setReqPatientId(req.patient_id);
    setReqVideoId(req.feeding_skill_video_id);
    setReqMaxSubmissions(req.max_submissions?.toString() || '');
    setReqAllowedDays(req.allowed_days || []);
    setReqNotes(req.notes || '');
    setReqIsActive(req.is_active ?? true);
    setReviewReqModalVisible(true);
  }, []);

  const openReviewSubmission = useCallback((sub: FeedingVideoSubmission) => {
    setReviewingSubmission(sub);
    setReviewStatus(sub.review_status === 'pending' ? 'reviewed' : sub.review_status);
    setReviewRating(sub.rating || 0);
    setReviewNotes(sub.reviewer_notes || '');
    setReviewModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!titleEn.trim()) throw new Error('English title is required');
      const parsedTags = tagsText.trim()
        ? tagsText.split(',').map(t => t.trim()).filter(Boolean)
        : null;
      const payload: Record<string, unknown> = {
        title_en: titleEn.trim(),
        title_zh: titleZh.trim() || null,
        description_en: descEn.trim() || null,
        description_zh: descZh.trim() || null,
        category: category.trim() || null,
        youtube_video_id: youtubeId.trim() || null,
        vimeo_video_id: vimeoId.trim() || null,
        creator_name_en: creatorEn.trim() || null,
        creator_name_zh: creatorZh.trim() || null,
        tags: parsedTags,
        is_active: isActive,
      };
      if (editingId) {
        const { error } = await supabase.from('feeding_skill_videos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feeding_skill_videos').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-skills'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-skills'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const pushMutation = useMutation({
    mutationFn: async ({ videoIds, patientIds, targetType, startDate, endDate }: {
      videoIds: string[];
      patientIds: string[];
      targetType: string;
      startDate: string;
      endDate: string;
    }) => {
      let successCount = 0;
      for (const videoId of videoIds) {
        for (const patientId of patientIds) {
          try {
            const row: Record<string, unknown> = {
              video_id: videoId,
              patient_id: patientId,
              target_type: targetType || 'individual',
              start_date: startDate || new Date().toISOString().split('T')[0],
              is_active: true,
            };
            if (endDate) row.end_date = endDate;
            const { error } = await supabase.from('feeding_skill_assignments').insert(row);
            if (error) {
              console.log('Push feeding skill error:', error);
            } else {
              successCount++;
            }
          } catch (e) {
            console.log('Push feeding skill exception:', e);
          }
        }
      }
      return successCount;
    },
    onSuccess: (count) => {
      setPushModalVisible(false);
      setBulkPushModalVisible(false);
      Alert.alert('Pushed 已推送', `Successfully pushed ${count} assignment(s).\n已成功推送 ${count} 個分配。`);
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-assignments'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-assignments'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const saveReviewReqMutation = useMutation({
    mutationFn: async () => {
      if (!reqPatientId || !reqVideoId) throw new Error('Patient and video are required');
      const payload: Record<string, unknown> = {
        patient_id: reqPatientId,
        feeding_skill_video_id: reqVideoId,
        max_submissions: reqMaxSubmissions ? parseInt(reqMaxSubmissions, 10) : null,
        allowed_days: reqAllowedDays.length > 0 ? reqAllowedDays : null,
        notes: reqNotes.trim() || null,
        is_active: reqIsActive,
      };
      if (editingReqId) {
        const { error } = await supabase.from('feeding_skill_review_requirements').update(payload).eq('id', editingReqId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feeding_skill_review_requirements').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-review-requirements'] });
      setReviewReqModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteReviewReqMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_review_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-review-requirements'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const saveReviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewingSubmission) throw new Error('No submission selected');
      const { error } = await supabase.from('feeding_skill_video_submissions').update({
        review_status: reviewStatus,
        rating: reviewRating > 0 ? reviewRating : null,
        reviewer_notes: reviewNotes.trim() || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reviewingSubmission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-video-submissions'] });
      setReviewModalVisible(false);
      Alert.alert('Saved 已儲存', 'Review saved successfully.\n審核已成功儲存。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_video_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feeding-video-submissions'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Video 刪除影片', 'Are you sure? 確定刪除？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }, [deleteMutation]);

  const confirmDeleteAssignment = useCallback((id: string) => {
    Alert.alert('Delete Assignment 刪除分配', 'Are you sure? 確定刪除？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteAssignmentMutation.mutate(id) },
    ]);
  }, [deleteAssignmentMutation]);

  const confirmDeleteReq = useCallback((id: string) => {
    Alert.alert('Delete Requirement 刪除要求', 'Are you sure? 確定刪除？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteReviewReqMutation.mutate(id) },
    ]);
  }, [deleteReviewReqMutation]);

  const confirmDeleteSubmission = useCallback((id: string) => {
    Alert.alert('Delete Submission 刪除提交', 'Are you sure? 確定刪除？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteSubmissionMutation.mutate(id) },
    ]);
  }, [deleteSubmissionMutation]);

  const handlePush = useCallback(() => {
    if (!pushVideoId) return;
    if (pushTargetType === 'individual' && pushPatientIds.length === 0) {
      Alert.alert('Select Patients 選擇患者', 'Please select at least one patient.\n請選擇至少一位患者。');
      return;
    }
    const patIds = pushTargetType === 'all'
      ? (patientsQuery.data || []).map(p => p.id)
      : pushPatientIds;
    pushMutation.mutate({
      videoIds: [pushVideoId],
      patientIds: patIds,
      targetType: pushTargetType,
      startDate: pushStartDate,
      endDate: pushEndDate,
    });
  }, [pushVideoId, pushPatientIds, pushTargetType, pushStartDate, pushEndDate, patientsQuery.data, pushMutation]);

  const handleBulkPush = useCallback(() => {
    if (bulkSelectedVideoIds.length === 0 || bulkPatientIds.length === 0) {
      Alert.alert('Missing Selection 缺少選擇', 'Please select videos and patients.\n請選擇影片和患者。');
      return;
    }
    pushMutation.mutate({
      videoIds: bulkSelectedVideoIds,
      patientIds: bulkPatientIds,
      targetType: 'individual',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    });
  }, [bulkSelectedVideoIds, bulkPatientIds, pushMutation]);

  const togglePushPatient = useCallback((patientId: string) => {
    setPushPatientIds(prev =>
      prev.includes(patientId) ? prev.filter(id => id !== patientId) : [...prev, patientId]
    );
  }, []);

  const toggleBulkVideo = useCallback((videoId: string) => {
    setBulkSelectedVideoIds(prev =>
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
  }, []);

  const toggleBulkPatient = useCallback((patientId: string) => {
    setBulkPatientIds(prev =>
      prev.includes(patientId) ? prev.filter(id => id !== patientId) : [...prev, patientId]
    );
  }, []);

  const toggleReqDay = useCallback((day: string) => {
    setReqAllowedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }, []);

  const refetchCurrent = useCallback(() => {
    if (activeTab === 'library') void videosQuery.refetch();
    if (activeTab === 'pushed') void assignmentsQuery.refetch();
    if (activeTab === 'review') {
      void reviewReqsQuery.refetch();
      void submissionsQuery.refetch();
    }
  }, [activeTab, videosQuery, assignmentsQuery, reviewReqsQuery, submissionsQuery]);

  const isRefreshing = activeTab === 'library' ? videosQuery.isFetching
    : activeTab === 'pushed' ? assignmentsQuery.isFetching
    : (reviewReqsQuery.isFetching || submissionsQuery.isFetching);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required{'\n'}需要管理員權限</Text>
      </View>
    );
  }

  const renderLibraryTab = () => (
    <>
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search feeding skills 搜尋..."
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
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryRow}
        contentContainerStyle={styles.categoryRowContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.categoryChip, selectedCategory === cat.value && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat.value && styles.categoryChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={videosQuery.isFetching} onRefresh={() => void videosQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {videosQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Utensils size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No feeding skill videos found</Text>
            <Text style={styles.emptySubtext}>找不到餵食技巧影片</Text>
          </View>
        ) : (
          filtered.map(v => {
            const thumb = getThumbnail(v);
            return (
              <View key={v.id} style={styles.card}>
                <TouchableOpacity onPress={() => openEdit(v)} activeOpacity={0.7}>
                  {thumb ? (
                    <View style={styles.thumbWrap}>
                      <Image source={{ uri: thumb }} style={styles.cardThumb} resizeMode="cover" />
                      <View style={styles.playOverlay}>
                        <Play size={20} color={Colors.white} fill={Colors.white} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.cardThumbPlaceholder}>
                      <Utensils size={28} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{v.title_en}</Text>
                        {v.title_zh ? <Text style={styles.cardTitleZh} numberOfLines={1}>{v.title_zh}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => confirmDelete(v.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cardMeta}>
                      {v.category ? (
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{v.category.replace(/_/g, ' ')}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.statusDot, { backgroundColor: v.is_active ? Colors.success : Colors.frozen }]} />
                      <Text style={styles.statusLabel}>{v.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                    {v.creator_name_en ? (
                      <Text style={styles.creatorText}>By {v.creator_name_en}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pushBtnRow}
                  onPress={() => openPushToPatient(v)}
                  activeOpacity={0.7}
                >
                  <Send size={14} color={Colors.accent} />
                  <Text style={styles.pushBtnRowText}>Push to Patient 推送至患者</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>
    </>
  );

  const renderPushedTab = () => (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={assignmentsQuery.isFetching} onRefresh={() => void assignmentsQuery.refetch()} tintColor={Colors.accent} />
      }
      showsVerticalScrollIndicator={false}
    >
      {assignmentsQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : !assignmentsQuery.data || assignmentsQuery.data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Send size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No assignments yet</Text>
          <Text style={styles.emptySubtext}>尚無分配</Text>
        </View>
      ) : (
        assignmentsQuery.data.map(a => (
          <View key={a.id} style={styles.assignmentCard}>
            <View style={styles.assignmentCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>
                  {a.feeding_skill_videos?.title_en || 'Unknown Video'}
                </Text>
                {a.feeding_skill_videos?.title_zh ? (
                  <Text style={styles.assignmentTitleZh}>{a.feeding_skill_videos.title_zh}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => confirmDeleteAssignment(a.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Trash2 size={15} color={Colors.danger} />
              </TouchableOpacity>
            </View>
            <View style={styles.assignmentMeta}>
              <View style={styles.assignmentMetaRow}>
                <Users size={13} color={Colors.textSecondary} />
                <Text style={styles.assignmentMetaText}>{a.patients?.patient_name || a.patient_id}</Text>
              </View>
              <View style={styles.assignmentMetaRow}>
                <Calendar size={13} color={Colors.textSecondary} />
                <Text style={styles.assignmentMetaText}>
                  {a.start_date || '—'}{a.end_date ? ` → ${a.end_date}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.assignmentBottom}>
              <View style={[styles.typeBadge, { backgroundColor: a.target_type === 'all' ? Colors.infoLight : Colors.accentLight }]}>
                <Text style={[styles.typeBadgeText, { color: a.target_type === 'all' ? Colors.info : Colors.accentDark }]}>
                  {a.target_type === 'all' ? 'All Patients 全部' : 'Individual 個別'}
                </Text>
              </View>
              <View style={styles.assignmentStatusRow}>
                {a.viewed_at ? (
                  <View style={styles.viewedBadge}>
                    <Eye size={12} color={Colors.success} />
                    <Text style={styles.viewedText}>Viewed 已觀看</Text>
                  </View>
                ) : (
                  <View style={styles.notViewedBadge}>
                    <EyeOff size={12} color={Colors.textTertiary} />
                    <Text style={styles.notViewedText}>Not viewed 未觀看</Text>
                  </View>
                )}
                <View style={[styles.activeBadge, { backgroundColor: a.is_active ? Colors.successLight : Colors.frozenLight }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600' as const, color: a.is_active ? Colors.success : Colors.frozen }}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderReviewTab = () => (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={reviewReqsQuery.isFetching || submissionsQuery.isFetching}
          onRefresh={() => { void reviewReqsQuery.refetch(); void submissionsQuery.refetch(); }}
          tintColor={Colors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <ClipboardList size={18} color={Colors.accent} />
        <Text style={styles.sectionTitle}>Review Requirements 審核要求</Text>
        <TouchableOpacity onPress={openNewReviewReq} style={styles.sectionAddBtn}>
          <Plus size={16} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {reviewReqsQuery.isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 16 }} />
      ) : !reviewReqsQuery.data || reviewReqsQuery.data.length === 0 ? (
        <View style={styles.emptySmall}>
          <Text style={styles.emptySmallText}>No review requirements 無審核要求</Text>
        </View>
      ) : (
        reviewReqsQuery.data.map(req => (
          <View key={req.id} style={styles.reqCard}>
            <View style={styles.reqCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqVideoName}>{req.feeding_skill_videos?.title_en || 'Unknown'}</Text>
                <Text style={styles.reqPatientName}>{req.patients?.patient_name || req.patient_id}</Text>
              </View>
              <View style={styles.reqActions}>
                <TouchableOpacity onPress={() => openEditReviewReq(req)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Edit3 size={15} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteReq(req.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={15} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.reqMeta}>
              {req.max_submissions ? (
                <Text style={styles.reqMetaText}>Max: {req.max_submissions}/day</Text>
              ) : null}
              {req.allowed_days && req.allowed_days.length > 0 ? (
                <Text style={styles.reqMetaText}>Days: {req.allowed_days.map(d => d.substring(0, 3)).join(', ')}</Text>
              ) : null}
              <View style={[styles.activeBadge, { backgroundColor: req.is_active ? Colors.successLight : Colors.frozenLight }]}>
                <Text style={{ fontSize: 11, fontWeight: '600' as const, color: req.is_active ? Colors.success : Colors.frozen }}>
                  {req.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            {req.notes ? <Text style={styles.reqNotes}>{req.notes}</Text> : null}
          </View>
        ))
      )}

      <View style={[styles.sectionHeader, { marginTop: 28 }]}>
        <FileVideo size={18} color={Colors.accent} />
        <Text style={styles.sectionTitle}>Video Submissions 影片提交</Text>
      </View>

      {submissionsQuery.isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 16 }} />
      ) : !submissionsQuery.data || submissionsQuery.data.length === 0 ? (
        <View style={styles.emptySmall}>
          <Text style={styles.emptySmallText}>No submissions 無提交</Text>
        </View>
      ) : (
        submissionsQuery.data.map(sub => (
          <View key={sub.id} style={styles.subCard}>
            <View style={styles.subCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subExerciseName}>{sub.video_title_en || 'Unnamed'}</Text>
                <Text style={styles.subPatientName}>{sub.patients?.patient_name || sub.patient_id}</Text>
              </View>
              <View style={[styles.reviewStatusBadge, { backgroundColor: statusColor(sub.review_status) + '20' }]}>
                <Text style={[styles.reviewStatusText, { color: statusColor(sub.review_status) }]}>
                  {statusLabel(sub.review_status)}
                </Text>
              </View>
            </View>
            <View style={styles.subMeta}>
              <Text style={styles.subDate}>{sub.submission_date || sub.created_at?.split('T')[0] || '—'}</Text>
              {sub.rating ? (
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={13} color={s <= sub.rating! ? '#F5A623' : Colors.border} fill={s <= sub.rating! ? '#F5A623' : 'transparent'} />
                  ))}
                </View>
              ) : null}
            </View>
            {sub.reviewer_notes ? <Text style={styles.subNotes}>{sub.reviewer_notes}</Text> : null}
            <View style={styles.subActions}>
              {sub.video_url ? (
                <TouchableOpacity style={styles.subActionBtn} onPress={() => { void Linking.openURL(sub.video_url!); }}>
                  <ExternalLink size={13} color={Colors.info} />
                  <Text style={styles.subActionText}>Watch 觀看</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.subActionBtn} onPress={() => openReviewSubmission(sub)}>
                <Edit3 size={13} color={Colors.accent} />
                <Text style={[styles.subActionText, { color: Colors.accent }]}>Review 審核</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.subActionBtn} onPress={() => confirmDeleteSubmission(sub.id)}>
                <Trash2 size={13} color={Colors.danger} />
                <Text style={[styles.subActionText, { color: Colors.danger }]}>Delete 刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Feeding Skills</Text>
            <Text style={styles.headerSubtitle}>餵食技巧</Text>
          </View>
          {activeTab === 'library' && (
            <TouchableOpacity onPress={openBulkPush} style={styles.bulkPushBtn} activeOpacity={0.7}>
              <Users size={14} color={Colors.white} />
              <Text style={styles.bulkPushText}>Bulk 批量</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        {([
          { key: 'library' as TabKey, label: 'Library 庫', icon: <Utensils size={15} color={activeTab === 'library' ? Colors.accent : Colors.textTertiary} /> },
          { key: 'pushed' as TabKey, label: 'Pushed 已推送', icon: <Send size={15} color={activeTab === 'pushed' ? Colors.accent : Colors.textTertiary} /> },
          { key: 'review' as TabKey, label: 'Review 審核', icon: <ClipboardList size={15} color={activeTab === 'review' ? Colors.accent : Colors.textTertiary} /> },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            {tab.icon}
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'library' && renderLibraryTab()}
      {activeTab === 'pushed' && renderPushedTab()}
      {activeTab === 'review' && renderReviewTab()}

      {/* Add/Edit Video Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit 編輯' : 'New 新增'}</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title (EN) 標題 *</Text>
              <TextInput style={styles.input} value={titleEn} onChangeText={setTitleEn} placeholder="English title" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Title (繁中) 標題</Text>
              <TextInput style={styles.input} value={titleZh} onChangeText={setTitleZh} placeholder="中文標題" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Description (EN) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descEn} onChangeText={setDescEn} placeholder="English description" placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.fieldLabel}>Description (繁中) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descZh} onChangeText={setDescZh} placeholder="中文描述" placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.fieldLabel}>Category 分類</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowFormCategoryPicker(!showFormCategoryPicker)}>
                <Text style={[styles.pickerBtnText, !category && { color: Colors.textTertiary }]}>
                  {category ? CATEGORIES.find(c => c.value === category)?.label || category : 'Select category 選擇分類'}
                </Text>
                <ChevronDown size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showFormCategoryPicker && (
                <View style={styles.pickerDropdown}>
                  {CATEGORIES.filter(c => c.value !== '').map(cat => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[styles.pickerOption, category === cat.value && styles.pickerOptionActive]}
                      onPress={() => { setCategory(cat.value); setShowFormCategoryPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, category === cat.value && { color: Colors.accent, fontWeight: '600' as const }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>YouTube Video ID</Text>
              <TextInput style={styles.input} value={youtubeId} onChangeText={setYoutubeId} placeholder="e.g. dQw4w9WgXcQ" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {youtubeId.trim().length > 0 && (
                <Image source={{ uri: `https://img.youtube.com/vi/${youtubeId.trim()}/mqdefault.jpg` }} style={styles.previewImage} resizeMode="cover" />
              )}

              <Text style={styles.fieldLabel}>Vimeo Video ID</Text>
              <TextInput style={styles.input} value={vimeoId} onChangeText={setVimeoId} placeholder="e.g. 123456789" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Creator Name (EN)</Text>
              <TextInput style={styles.input} value={creatorEn} onChangeText={setCreatorEn} placeholder="Creator name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Creator Name (繁中)</Text>
              <TextInput style={styles.input} value={creatorZh} onChangeText={setCreatorZh} placeholder="創作者姓名" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Tags 標籤 (comma-separated)</Text>
              <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} placeholder="feeding, infant, therapy" placeholderTextColor={Colors.textTertiary} />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Push to Patient Modal */}
      <Modal visible={pushModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPushModalVisible(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Push 推送</Text>
            <TouchableOpacity onPress={handlePush} disabled={pushMutation.isPending}>
              {pushMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.saveText}>Push 推送</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.pushBanner}>
            <Utensils size={16} color={Colors.accentDark} />
            <Text style={styles.pushBannerText} numberOfLines={1}>{pushVideoTitle}</Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.pushSection}>
              <Text style={styles.pushSectionLabel}>Target 目標</Text>
              <View style={styles.targetToggle}>
                <TouchableOpacity
                  style={[styles.targetBtn, pushTargetType === 'individual' && styles.targetBtnActive]}
                  onPress={() => setPushTargetType('individual')}
                >
                  <Text style={[styles.targetBtnText, pushTargetType === 'individual' && styles.targetBtnTextActive]}>
                    Specific 個別
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.targetBtn, pushTargetType === 'all' && styles.targetBtnActive]}
                  onPress={() => setPushTargetType('all')}
                >
                  <Text style={[styles.targetBtnText, pushTargetType === 'all' && styles.targetBtnTextActive]}>
                    All Patients 全部
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pushSection}>
              <Text style={styles.pushSectionLabel}>Date Range 日期範圍</Text>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateLabel}>Start 開始</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={pushStartDate}
                    onChangeText={setPushStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateLabel}>End 結束 (optional)</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={pushEndDate}
                    onChangeText={setPushEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
            </View>

            {pushTargetType === 'individual' && (
              <>
                <View style={styles.pushSearchContainer}>
                  <Search size={16} color={Colors.textTertiary} />
                  <TextInput
                    style={styles.pushSearchInput}
                    placeholder="Search patients 搜尋患者..."
                    placeholderTextColor={Colors.textTertiary}
                    value={pushPatientSearch}
                    onChangeText={setPushPatientSearch}
                    autoCorrect={false}
                  />
                </View>

                {filteredPushPatients.map(item => {
                  const isSelected = pushPatientIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.patientSelectItem, isSelected && styles.patientSelectItemActive]}
                      onPress={() => togglePushPatient(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}>
                        {isSelected && <Check size={14} color={Colors.white} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.patientSelectName}>{item.patient_name}</Text>
                        <Text style={styles.patientSelectCode}>{item.access_code}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {filteredPushPatients.length === 0 && (
                  <Text style={styles.pushEmptyText}>No patients found 找不到患者</Text>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bulk Push Modal */}
      <Modal visible={bulkPushModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setBulkPushModalVisible(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {bulkStep === 'videos' ? 'Select Videos 選擇影片' : 'Select Patients 選擇患者'}
            </Text>
            {bulkStep === 'videos' ? (
              <TouchableOpacity
                onPress={() => setBulkStep('patients')}
                disabled={bulkSelectedVideoIds.length === 0}
              >
                <Text style={[styles.saveText, bulkSelectedVideoIds.length === 0 && { opacity: 0.4 }]}>
                  Next ({bulkSelectedVideoIds.length})
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleBulkPush} disabled={pushMutation.isPending || bulkPatientIds.length === 0}>
                {pushMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={[styles.saveText, bulkPatientIds.length === 0 && { opacity: 0.4 }]}>
                    Push ({bulkPatientIds.length})
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {bulkStep === 'videos' ? (
            <FlatList
              data={videosQuery.data || []}
              keyExtractor={v => v.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = bulkSelectedVideoIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.patientSelectItem, isSelected && styles.patientSelectItemActive]}
                    onPress={() => toggleBulkVideo(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}>
                      {isSelected && <Check size={14} color={Colors.white} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.patientSelectName}>{item.title_en}</Text>
                      {item.title_zh ? <Text style={styles.patientSelectCode}>{item.title_zh}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.pushEmptyText}>No videos found</Text>}
            />
          ) : (
            <>
              <TouchableOpacity onPress={() => setBulkStep('videos')} style={styles.backStepBtn}>
                <ChevronLeft size={16} color={Colors.accent} />
                <Text style={styles.backStepText}>Back to videos 返回影片</Text>
              </TouchableOpacity>
              <View style={styles.pushSearchContainer}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.pushSearchInput}
                  placeholder="Search patients..."
                  placeholderTextColor={Colors.textTertiary}
                  value={bulkPatientSearch}
                  onChangeText={setBulkPatientSearch}
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={filteredBulkPatients}
                keyExtractor={p => p.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const isSelected = bulkPatientIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.patientSelectItem, isSelected && styles.patientSelectItemActive]}
                      onPress={() => toggleBulkPatient(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}>
                        {isSelected && <Check size={14} color={Colors.white} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.patientSelectName}>{item.patient_name}</Text>
                        <Text style={styles.patientSelectCode}>{item.access_code}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.pushEmptyText}>No patients found</Text>}
              />
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Review Requirement Modal */}
      <Modal visible={reviewReqModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReviewReqModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingReqId ? 'Edit Requirement 編輯' : 'New Requirement 新增'}</Text>
              <TouchableOpacity onPress={() => saveReviewReqMutation.mutate()} disabled={saveReviewReqMutation.isPending}>
                {saveReviewReqMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Patient 患者 *</Text>
              <View style={styles.pickerList}>
                {(patientsQuery.data || []).map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pickerListItem, reqPatientId === p.id && styles.pickerListItemActive]}
                    onPress={() => setReqPatientId(p.id)}
                  >
                    <Text style={[styles.pickerListText, reqPatientId === p.id && { color: Colors.accent, fontWeight: '600' as const }]}>
                      {p.patient_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Feeding Skill Video 影片 *</Text>
              <View style={styles.pickerList}>
                {(videosQuery.data || []).filter(v => v.is_active).map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.pickerListItem, reqVideoId === v.id && styles.pickerListItemActive]}
                    onPress={() => setReqVideoId(v.id)}
                  >
                    <Text style={[styles.pickerListText, reqVideoId === v.id && { color: Colors.accent, fontWeight: '600' as const }]}>
                      {v.title_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Max Submissions/Day 每日最大提交數</Text>
              <TextInput
                style={styles.input}
                value={reqMaxSubmissions}
                onChangeText={setReqMaxSubmissions}
                placeholder="e.g. 3"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>Allowed Days 允許日期</Text>
              <View style={styles.daysGrid}>
                {DAYS_OF_WEEK.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, reqAllowedDays.includes(day) && styles.dayChipActive]}
                    onPress={() => toggleReqDay(day)}
                  >
                    <Text style={[styles.dayChipText, reqAllowedDays.includes(day) && styles.dayChipTextActive]}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={reqNotes}
                onChangeText={setReqNotes}
                placeholder="Optional notes"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch value={reqIsActive} onValueChange={setReqIsActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Review Submission Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Review 審核</Text>
              <TouchableOpacity onPress={() => saveReviewMutation.mutate()} disabled={saveReviewMutation.isPending}>
                {saveReviewMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {reviewingSubmission && (
                <>
                  <View style={styles.reviewInfoCard}>
                    <Text style={styles.reviewInfoTitle}>{reviewingSubmission.video_title_en || 'Unnamed'}</Text>
                    <Text style={styles.reviewInfoSub}>{reviewingSubmission.patients?.patient_name || ''}</Text>
                    <Text style={styles.reviewInfoDate}>
                      Submitted: {reviewingSubmission.submission_date || reviewingSubmission.created_at?.split('T')[0]}
                    </Text>
                  </View>

                  <Text style={styles.fieldLabel}>Status 狀態</Text>
                  <View style={styles.statusToggle}>
                    {[
                      { value: 'reviewed', label: 'Reviewed 已審核', color: Colors.success },
                      { value: 'redo_requested', label: 'Request Redo 要求重做', color: Colors.danger },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.statusOption, reviewStatus === opt.value && { backgroundColor: opt.color + '18', borderColor: opt.color }]}
                        onPress={() => setReviewStatus(opt.value)}
                      >
                        <Text style={[styles.statusOptionText, reviewStatus === opt.value && { color: opt.color, fontWeight: '600' as const }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Rating 評分 (1-5)</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <TouchableOpacity key={s} onPress={() => setReviewRating(s)} style={styles.ratingStar}>
                        <Star size={28} color={s <= reviewRating ? '#F5A623' : Colors.border} fill={s <= reviewRating ? '#F5A623' : 'transparent'} />
                      </TouchableOpacity>
                    ))}
                    {reviewRating > 0 && (
                      <TouchableOpacity onPress={() => setReviewRating(0)} style={{ marginLeft: 8 }}>
                        <X size={18} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.fieldLabel}>Notes 備註</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    placeholder="Reviewer notes 審核備註"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                  />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  bulkPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkPushText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.accent,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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
  categoryRow: { maxHeight: 44 },
  categoryRowContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden' as const,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  thumbWrap: { position: 'relative' as const },
  cardThumb: { width: '100%', height: 140 },
  playOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  cardTitleZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catBadge: { backgroundColor: '#FFF0E6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accentDark },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: Colors.textSecondary },
  creatorText: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  pushBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: '#FFF8F4',
  },
  pushBtnRowText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, gap: 12 },
  noAccessText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
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
  multiline: { height: 80, textAlignVertical: 'top' as const },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnText: { fontSize: 15, color: Colors.text },
  pickerDropdown: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerOptionActive: { backgroundColor: Colors.accentLight },
  pickerOptionText: { fontSize: 14, color: Colors.text },
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
  switchLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  pushBannerText: { fontSize: 15, fontWeight: '600' as const, color: Colors.accentDark, flex: 1 },
  pushSection: { paddingHorizontal: 16, marginTop: 14 },
  pushSectionLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 8 },
  targetToggle: { flexDirection: 'row', gap: 8 },
  targetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  targetBtnActive: { borderColor: Colors.accent, backgroundColor: '#FFF8F4' },
  targetBtnText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  targetBtnTextActive: { color: Colors.accent, fontWeight: '600' as const },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateLabel: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  dateInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pushSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  pushSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  patientSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    marginHorizontal: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  patientSelectItemActive: {
    borderColor: Colors.accent,
    backgroundColor: '#FFF8F4',
  },
  selectCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheckboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  patientSelectName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  patientSelectCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  pushEmptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: 30 },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backStepText: { fontSize: 14, color: Colors.accent, fontWeight: '500' as const },
  assignmentCard: {
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
  assignmentCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  assignmentTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  assignmentTitleZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  assignmentMeta: { gap: 4, marginBottom: 8 },
  assignmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignmentMetaText: { fontSize: 13, color: Colors.textSecondary },
  assignmentBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignmentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' as const },
  viewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewedText: { fontSize: 11, color: Colors.success, fontWeight: '500' as const },
  notViewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notViewedText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' as const },
  activeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  sectionAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySmall: { alignItems: 'center', paddingVertical: 20 },
  emptySmallText: { fontSize: 14, color: Colors.textTertiary },
  reqCard: {
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
  reqCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reqVideoName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  reqPatientName: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reqActions: { flexDirection: 'row', gap: 12 },
  reqMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  reqMetaText: { fontSize: 12, color: Colors.textSecondary },
  reqNotes: { fontSize: 12, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' },
  subCard: {
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
  subCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  subExerciseName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  subPatientName: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reviewStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  reviewStatusText: { fontSize: 11, fontWeight: '600' as const },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  subDate: { fontSize: 12, color: Colors.textSecondary },
  starsRow: { flexDirection: 'row', gap: 2 },
  subNotes: { fontSize: 12, color: Colors.textTertiary, marginBottom: 6, fontStyle: 'italic' },
  subActions: { flexDirection: 'row', gap: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10 },
  subActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subActionText: { fontSize: 12, fontWeight: '500' as const, color: Colors.info },
  pickerList: {
    maxHeight: 160,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  pickerListItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerListItemActive: { backgroundColor: Colors.accentLight },
  pickerListText: { fontSize: 14, color: Colors.text },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayChipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.white },
  reviewInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewInfoTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  reviewInfoSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  reviewInfoDate: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  statusToggle: { gap: 8 },
  statusOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  statusOptionText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingStar: { padding: 4 },
});
