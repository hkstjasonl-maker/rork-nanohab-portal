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
  Utensils,
  Play,
  Send,
  Check,
  Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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

function getThumbnail(v: FeedingSkillVideo): string | null {
  if (v.youtube_video_id) return `https://img.youtube.com/vi/${v.youtube_video_id}/mqdefault.jpg`;
  return null;
}

export default function FeedingSkillsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [category, setCategory] = useState('');
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

  const [bulkPushModalVisible, setBulkPushModalVisible] = useState(false);
  const [bulkSelectedVideoIds, setBulkSelectedVideoIds] = useState<string[]>([]);
  const [bulkPatientIds, setBulkPatientIds] = useState<string[]>([]);
  const [bulkPatientSearch, setBulkPatientSearch] = useState('');
  const [bulkStep, setBulkStep] = useState<'videos' | 'patients'>('videos');

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
    enabled: isAdmin && (pushModalVisible || bulkPushModalVisible),
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
    setPushModalVisible(true);
  }, []);

  const openBulkPush = useCallback(() => {
    setBulkSelectedVideoIds([]);
    setBulkPatientIds([]);
    setBulkPatientSearch('');
    setBulkStep('videos');
    setBulkPushModalVisible(true);
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
      Alert.alert('Error', error.message);
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
      Alert.alert('Error', error.message);
    },
  });

  const pushMutation = useMutation({
    mutationFn: async ({ videoIds, patientIds }: { videoIds: string[]; patientIds: string[] }) => {
      let successCount = 0;
      for (const videoId of videoIds) {
        for (const patientId of patientIds) {
          try {
            const { error } = await supabase.from('feeding_skill_assignments').insert({
              video_id: videoId,
              patient_id: patientId,
              target_type: 'individual',
              start_date: new Date().toISOString().split('T')[0],
              is_active: true,
            });
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
      void queryClient.invalidateQueries({ queryKey: ['feeding-skill-assignments'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Video 刪除影片', 'Are you sure? 確定刪除？', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }, [deleteMutation]);

  const handlePush = useCallback(() => {
    if (!pushVideoId || pushPatientIds.length === 0) {
      Alert.alert('Select Patients 選擇患者', 'Please select at least one patient.\n請選擇至少一位患者。');
      return;
    }
    pushMutation.mutate({ videoIds: [pushVideoId], patientIds: pushPatientIds });
  }, [pushVideoId, pushPatientIds, pushMutation]);

  const handleBulkPush = useCallback(() => {
    if (bulkSelectedVideoIds.length === 0 || bulkPatientIds.length === 0) {
      Alert.alert('Missing Selection 缺少選擇', 'Please select videos and patients.\n請選擇影片和患者。');
      return;
    }
    pushMutation.mutate({ videoIds: bulkSelectedVideoIds, patientIds: bulkPatientIds });
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
            <Text style={styles.headerTitle}>Feeding Skills</Text>
            <Text style={styles.headerSubtitle}>餵食技巧</Text>
          </View>
          <TouchableOpacity onPress={openBulkPush} style={styles.bulkPushBtn} activeOpacity={0.7}>
            <Users size={16} color={Colors.white} />
            <Text style={styles.bulkPushText}>Bulk Push 批量推送</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search feeding skills..."
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
                          <Text style={styles.catBadgeText}>{v.category}</Text>
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
                  style={styles.pushBtn}
                  onPress={() => openPushToPatient(v)}
                  activeOpacity={0.7}
                >
                  <Send size={14} color={Colors.accent} />
                  <Text style={styles.pushBtnText}>Push to Patient 推送至患者</Text>
                </TouchableOpacity>
              </View>
            );
          })
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Feeding Skill</Text>
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
              <TextInput style={styles.input} value={titleEn} onChangeText={setTitleEn} placeholder="English title" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Title (繁中) 標題</Text>
              <TextInput style={styles.input} value={titleZh} onChangeText={setTitleZh} placeholder="中文標題" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Description (EN) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descEn} onChangeText={setDescEn} placeholder="English description" placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.fieldLabel}>Description (繁中) 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={descZh} onChangeText={setDescZh} placeholder="中文描述" placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.fieldLabel}>Category 分類</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Bottle, Spoon, Cup" placeholderTextColor={Colors.textTertiary} />

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

      <Modal visible={pushModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPushModalVisible(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Push to Patient 推送至患者</Text>
            <TouchableOpacity onPress={handlePush} disabled={pushMutation.isPending || pushPatientIds.length === 0}>
              {pushMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={[styles.saveText, pushPatientIds.length === 0 && { opacity: 0.4 }]}>
                  Push ({pushPatientIds.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.pushBanner}>
            <Utensils size={16} color={Colors.accentDark} />
            <Text style={styles.pushBannerText}>{pushVideoTitle}</Text>
          </View>

          <View style={styles.pushSearchContainer}>
            <Search size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.pushSearchInput}
              placeholder="Search patients..."
              placeholderTextColor={Colors.textTertiary}
              value={pushPatientSearch}
              onChangeText={setPushPatientSearch}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredPushPatients}
            keyExtractor={p => p.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isSelected = pushPatientIds.includes(item.id);
              return (
                <TouchableOpacity
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
            }}
            ListEmptyComponent={<Text style={styles.pushEmptyText}>No patients found</Text>}
          />
        </SafeAreaView>
      </Modal>

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
              {bulkStep === 'patients' && (
                <TouchableOpacity onPress={() => setBulkStep('videos')} style={styles.backStepBtn}>
                  <ChevronLeft size={16} color={Colors.accent} />
                  <Text style={styles.backStepText}>Back to videos 返回影片</Text>
                </TouchableOpacity>
              )}
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
  bulkPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkPushText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
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
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: '#FFF8F4',
  },
  pushBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
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
  multiline: { height: 80, textAlignVertical: 'top' as const },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
  },
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
  pushBannerText: { fontSize: 15, fontWeight: '600' as const, color: Colors.accentDark },
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
});
