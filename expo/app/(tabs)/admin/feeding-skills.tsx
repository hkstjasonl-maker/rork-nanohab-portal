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
  Utensils,
  Play,
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
    setTitleEn('');
    setTitleZh('');
    setDescEn('');
    setDescZh('');
    setCategory('');
    setYoutubeId('');
    setVimeoId('');
    setCreatorEn('');
    setCreatorZh('');
    setTagsText('');
    setIsActive(true);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((v: FeedingSkillVideo) => {
    setEditingId(v.id);
    setTitleEn(v.title_en || '');
    setTitleZh(v.title_zh || '');
    setDescEn(v.description_en || '');
    setDescZh(v.description_zh || '');
    setCategory(v.category || '');
    setYoutubeId(v.youtube_video_id || '');
    setVimeoId(v.vimeo_video_id || '');
    setCreatorEn(v.creator_name_en || '');
    setCreatorZh(v.creator_name_zh || '');
    setTagsText(Array.isArray(v.tags) ? v.tags.join(', ') : '');
    setIsActive(v.is_active ?? true);
    setModalVisible(true);
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

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Video 刪除影片', 'Are you sure? 確定刪除？', [
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
            <Text style={styles.headerTitle}>Feeding Skills</Text>
            <Text style={styles.headerSubtitle}>餵食技巧</Text>
          </View>
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
              <TouchableOpacity key={v.id} style={styles.card} onPress={() => openEdit(v)} activeOpacity={0.7}>
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
  thumbWrap: { position: 'relative' },
  cardThumb: { width: '100%', height: 140 },
  playOverlay: {
    position: 'absolute',
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
  multiline: { height: 80, textAlignVertical: 'top' },
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
});
