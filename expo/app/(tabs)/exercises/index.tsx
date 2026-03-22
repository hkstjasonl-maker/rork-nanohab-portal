import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  X,
  ChevronRight,
  Video,
  Headphones,
  Clock,
  Filter,
  ChevronDown,
  Dumbbell,
  Share2,
  Check,
  FileText,
  Link,
  MessageSquare,
  Subtitles,
  Mic,
  Play,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Exercise, ExerciseMediaRequest } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP) / 2;

function getStatusDotColor(status?: string): string {
  switch (status) {
    case 'pending_review': return Colors.warning;
    case 'rejected': return Colors.danger;
    case 'active':
    default: return Colors.success;
  }
}

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, clinician, clinicianCan } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categoriesQuery = useQuery({
    queryKey: ['exercise-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('category')
        .not('category', 'is', null);
      if (error) {
        console.log('Categories fetch error:', error);
        return ['All'];
      }
      const unique = Array.from(new Set((data || []).map((d: { category: string }) => d.category).filter(Boolean)));
      unique.sort((a: string, b: string) => a.localeCompare(b));
      return ['All', ...unique];
    },
  });

  const categories = categoriesQuery.data || ['All'];

  const canCreateExercises = isAdmin || clinicianCan('upload_exercises');

  const exercisesQuery = useQuery({
    queryKey: ['exercises', isAdmin, clinician?.id],
    queryFn: async () => {
      console.log('Fetching exercises, isAdmin:', isAdmin, 'clinicianId:', clinician?.id);

      if (isAdmin) {
        const { data, error } = await supabase
          .from('exercise_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Exercise fetch error:', error);
          throw error;
        }
        return (data || []) as Exercise[];
      }

      if (!clinician?.id) return [];

      const [sharedRes, ownRes] = await Promise.all([
        supabase
          .from('shared_exercises')
          .select('exercise_library_id, exercise_library(*)')
          .eq('clinician_id', clinician.id),
        supabase
          .from('exercise_library')
          .select('*')
          .eq('created_by_clinician_id', clinician.id)
          .order('created_at', { ascending: false }),
      ]);

      if (sharedRes.error) {
        console.log('Shared exercises fetch error:', sharedRes.error);
      }
      if (ownRes.error) {
        console.log('Own exercises fetch error:', ownRes.error);
      }

      const sharedExercises: Exercise[] = (sharedRes.data || [])
        .map((se: { exercise_library_id: string; exercise_library: unknown }) => {
          const ex = se.exercise_library as Exercise | null;
          if (ex) return { ...ex, is_shared: true };
          return null;
        })
        .filter(Boolean) as Exercise[];

      const ownExercises: Exercise[] = (ownRes.data || []) as Exercise[];

      const exerciseMap = new Map<string, Exercise>();
      ownExercises.forEach((e) => exerciseMap.set(e.id, e));
      sharedExercises.forEach((e) => {
        if (!exerciseMap.has(e.id)) {
          exerciseMap.set(e.id, e);
        }
      });

      return Array.from(exerciseMap.values());
    },
  });

  const filteredExercises = useMemo(() => {
    if (!exercisesQuery.data) return [];
    let result = exercisesQuery.data;

    if (selectedCategory !== 'All') {
      result = result.filter(
        (e) => e.category === selectedCategory
      );
    }

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (e) =>
          e.title_en?.toLowerCase().includes(lower) ||
          e.title_zh_hant?.toLowerCase().includes(lower) ||
          e.category?.toLowerCase().includes(lower)
      );
    }

    return result;
  }, [exercisesQuery.data, searchText, selectedCategory]);

  const renderGridItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <GridExerciseCard
        exercise={item}
        clinicianId={clinician?.id}
        onPress={() =>
          router.push({
            pathname: '/exercise/[id]',
            params: { id: item.id },
          })
        }
      />
    ),
    [router, clinician?.id]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ListExerciseCard
        exercise={item}
        clinicianId={clinician?.id}
        onPress={() =>
          router.push({
            pathname: '/exercise/[id]',
            params: { id: item.id },
          })
        }
      />
    ),
    [router, clinician?.id]
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Exercise Library 運動庫</Text>
        <Text style={styles.headerCount}>
          {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises 搜尋運動..."
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            testID="exercise-search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <X size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedCategory !== 'All' && styles.filterButtonActive,
          ]}
          onPress={() => setShowCategoryFilter(true)}
          activeOpacity={0.7}
        >
          <Filter
            size={16}
            color={selectedCategory !== 'All' ? Colors.white : Colors.textSecondary}
          />
          <Text
            style={[
              styles.filterButtonText,
              selectedCategory !== 'All' && styles.filterButtonTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedCategory === 'All' ? 'Category' : selectedCategory}
          </Text>
          <ChevronDown
            size={14}
            color={selectedCategory !== 'All' ? Colors.white : Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          activeOpacity={0.7}
        >
          {viewMode === 'grid' ? (
            <List size={18} color={Colors.textSecondary} />
          ) : (
            <LayoutGrid size={18} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {exercisesQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : exercisesQuery.isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load exercises</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void exercisesQuery.refetch()}
          >
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          key="grid"
          data={filteredExercises}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={exercisesQuery.isRefetching}
              onRefresh={() => void exercisesQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Dumbbell size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No exercises found</Text>
              <Text style={styles.emptyTextZh}>找不到運動</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="list"
          data={filteredExercises}
          renderItem={renderListItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={exercisesQuery.isRefetching}
              onRefresh={() => void exercisesQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Dumbbell size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No exercises found</Text>
              <Text style={styles.emptyTextZh}>找不到運動</Text>
            </View>
          }
        />
      )}

      {canCreateExercises && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 24 }]}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
          testID="add-exercise-button"
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}

      <CategoryFilterModal
        visible={showCategoryFilter}
        selected={selectedCategory}
        categories={categories}
        onSelect={(cat) => {
          setSelectedCategory(cat);
          setShowCategoryFilter(false);
        }}
        onClose={() => setShowCategoryFilter(false)}
      />

      <AddExerciseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        isAdmin={isAdmin}
        clinicianId={clinician?.id}
      />
    </View>
  );
}

const GridExerciseCard = React.memo(function GridExerciseCard({
  exercise,
  clinicianId,
  onPress,
}: {
  exercise: Exercise;
  clinicianId?: string;
  onPress: () => void;
}) {
  const isOwn = exercise.created_by_clinician_id === clinicianId;
  const isShared = exercise.is_shared && !isOwn;
  const durationMin = exercise.default_duration_minutes || null;
  const thumbnailUrl = exercise.youtube_video_id
    ? `https://img.youtube.com/vi/${exercise.youtube_video_id}/mqdefault.jpg`
    : null;
  const hasVimeoOnly = !exercise.youtube_video_id && !!exercise.vimeo_video_id;
  const statusDot = getStatusDotColor(exercise.media_status);

  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`exercise-card-${exercise.id}`}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.gridThumb} resizeMode="cover" />
      ) : hasVimeoOnly ? (
        <View style={styles.gridThumbPlaceholder}>
          <Play size={24} color={Colors.white} />
        </View>
      ) : (
        <View style={[styles.gridThumbPlaceholder, { backgroundColor: '#E8E4DF' }]}>
          <Dumbbell size={24} color={Colors.textTertiary} />
        </View>
      )}

      <View style={styles.gridCardBody}>
        <Text style={styles.gridTitle} numberOfLines={2}>{exercise.title_en}</Text>
        {exercise.title_zh_hant ? (
          <Text style={styles.gridTitleZh} numberOfLines={1}>{exercise.title_zh_hant}</Text>
        ) : null}

        <View style={styles.gridBadgesRow}>
          {exercise.category ? (
            <View style={styles.gridCatBadge}>
              <Text style={styles.gridCatBadgeText} numberOfLines={1}>{exercise.category}</Text>
            </View>
          ) : null}
          <View style={[styles.gridStatusDot, { backgroundColor: statusDot }]} />
          {isShared && (
            <View style={styles.gridSharedBadge}>
              <Share2 size={8} color={Colors.info} />
            </View>
          )}
        </View>

        {durationMin !== null && (
          <View style={styles.gridDuration}>
            <Clock size={10} color={Colors.textTertiary} />
            <Text style={styles.gridDurationText}>{durationMin} min</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const ListExerciseCard = React.memo(function ListExerciseCard({
  exercise,
  clinicianId,
  onPress,
}: {
  exercise: Exercise;
  clinicianId?: string;
  onPress: () => void;
}) {
  const isOwn = exercise.created_by_clinician_id === clinicianId;
  const isShared = exercise.is_shared && !isOwn;
  const durationMin = exercise.default_duration_minutes || null;
  const thumbnailUrl = exercise.youtube_video_id
    ? `https://img.youtube.com/vi/${exercise.youtube_video_id}/mqdefault.jpg`
    : null;
  const hasVimeoOnly = !exercise.youtube_video_id && !!exercise.vimeo_video_id;
  const statusDot = getStatusDotColor(exercise.media_status);

  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`exercise-list-${exercise.id}`}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.listThumb} resizeMode="cover" />
      ) : hasVimeoOnly ? (
        <View style={styles.listThumbPlaceholder}>
          <Play size={18} color={Colors.white} />
        </View>
      ) : (
        <View style={[styles.listThumbPlaceholder, { backgroundColor: '#E8E4DF' }]}>
          <Dumbbell size={18} color={Colors.textTertiary} />
        </View>
      )}

      <View style={styles.listCardBody}>
        <Text style={styles.listTitle} numberOfLines={1}>{exercise.title_en}</Text>
        <View style={styles.listMetaRow}>
          {exercise.category ? (
            <View style={styles.listCatBadge}>
              <Text style={styles.listCatBadgeText} numberOfLines={1}>{exercise.category}</Text>
            </View>
          ) : null}
          <View style={[styles.gridStatusDot, { backgroundColor: statusDot }]} />
          {isShared && (
            <View style={styles.gridSharedBadge}>
              <Share2 size={8} color={Colors.info} />
            </View>
          )}
          {durationMin !== null && (
            <Text style={styles.listDurationText}>{durationMin}m</Text>
          )}
        </View>
      </View>
      <ChevronRight size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
});

function CategoryFilterModal({
  visible,
  selected,
  categories,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  categories: string[];
  onSelect: (cat: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.categoryModal}>
          <Text style={styles.categoryModalTitle}>Category 類別</Text>
          <ScrollView style={styles.categoryList} bounces={false}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  selected === cat && styles.categoryOptionSelected,
                ]}
                onPress={() => onSelect(cat)}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    selected === cat && styles.categoryOptionTextSelected,
                  ]}
                >
                  {cat}
                </Text>
                {selected === cat && <Check size={16} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function AddExerciseModal({
  visible,
  onClose,
  isAdmin: _isAdmin,
  clinicianId,
}: {
  visible: boolean;
  onClose: () => void;
  isAdmin: boolean;
  clinicianId?: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showMediaRequest, setShowMediaRequest] = useState(false);

  const modalCategoriesQuery = useQuery({
    queryKey: ['exercise-categories-modal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('category')
        .not('category', 'is', null);
      if (error) return [] as string[];
      const unique = Array.from(new Set((data || []).map((d: { category: string }) => d.category).filter(Boolean))) as string[];
      unique.sort((a, b) => a.localeCompare(b));
      return unique;
    },
    enabled: visible,
  });

  const [mrVideoRequired, setMrVideoRequired] = useState(true);
  const [mrAudioOptional, setMrAudioOptional] = useState(false);
  const [mrSubtitleOptional, setMrSubtitleOptional] = useState(false);
  const [mrLiveSubtitlesOptional, setMrLiveSubtitlesOptional] = useState(false);
  const [mrVideoUrl, setMrVideoUrl] = useState('');
  const [mrNotes, setMrNotes] = useState('');
  const [mrDeclared, setMrDeclared] = useState(false);
  const [mediaRequestSubmitted, setMediaRequestSubmitted] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setTitleZh('');
    setCategory('');
    setDescription('');
    setDescriptionZh('');
    setDurationSeconds('');
    setVimeoUrl('');
    setYoutubeUrl('');
    setShowMediaRequest(false);
    setMrVideoRequired(true);
    setMrAudioOptional(false);
    setMrSubtitleOptional(false);
    setMrLiveSubtitlesOptional(false);
    setMrVideoUrl('');
    setMrNotes('');
    setMrDeclared(false);
    setMediaRequestSubmitted(false);
  }, []);

  const addMutation = useMutation({
    mutationFn: async () => {
      const isClinician = !_isAdmin && clinicianId;
      const mediaStatus = isClinician ? 'pending_review' : 'active';

      const { data: inserted, error } = await supabase
        .from('exercise_library')
        .insert({
          title_en: title.trim(),
          title_zh_hant: titleZh.trim() || null,
          category: category.trim() || null,
          default_duration_minutes: durationSeconds ? parseInt(durationSeconds, 10) : null,
          vimeo_video_id: _isAdmin ? (vimeoUrl.trim() || null) : null,
          youtube_video_id: _isAdmin ? (youtubeUrl.trim() || null) : null,
          media_status: mediaStatus,
          created_by_clinician_id: clinicianId || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (isClinician && inserted && mediaRequestSubmitted) {
        const mediaRequest: Omit<ExerciseMediaRequest, 'id' | 'created_at' | 'status'> = {
          exercise_library_id: inserted.id,
          clinician_id: clinicianId!,
          video_url: mrVideoUrl.trim() || undefined,
          request_video: mrVideoRequired,
          request_audio: mrAudioOptional,
          request_subtitle: mrSubtitleOptional,
          request_live_subtitles: mrLiveSubtitlesOptional,
          declaration_accepted: true,
          notes: mrNotes.trim() || undefined,
        };

        const { error: mrError } = await supabase
          .from('exercise_media_requests')
          .insert(mediaRequest);

        if (mrError) {
          console.log('Media request insert error:', mrError);
        }
      }

      return inserted;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      resetForm();
      onClose();
      Alert.alert('Success 成功', 'Exercise added successfully.\n運動已成功新增。');
    },
    onError: (error: Error) => {
      console.log('Add exercise error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing Title 標題不完整', 'Please enter exercise title.\n請輸入運動標題。');
      return;
    }

    const isClinician = !_isAdmin && clinicianId;
    if (isClinician && !mediaRequestSubmitted) {
      Alert.alert(
        'Media Setup Required 需要媒體設置',
        'Please complete "Request Media Setup" before saving.\n請先完成「申請媒體設置」。'
      );
      return;
    }

    addMutation.mutate();
  }, [title, _isAdmin, clinicianId, mediaRequestSubmitted, addMutation]);

  const handleMediaRequestSubmit = useCallback(() => {
    if (!mrDeclared) {
      Alert.alert(
        'Declaration Required 需要聲明',
        'Please check the declaration checkbox.\n請勾選聲明。'
      );
      return;
    }
    setMediaRequestSubmitted(true);
    setShowMediaRequest(false);
    Alert.alert('Media Request Ready 媒體申請已準備', 'You can now save the exercise.\n您現在可以儲存運動。');
  }, [mrDeclared]);

  const isClinician = !_isAdmin && clinicianId;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
            <Text style={styles.modalCancel}>Cancel 取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Exercise 新增運動</Text>
          <TouchableOpacity onPress={handleSave} disabled={addMutation.isPending}>
            {addMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.modalSave}>Save 儲存</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <FormField label="Title 標題 *" value={title} onChangeText={setTitle} placeholder="Exercise title" />
          <FormField label="Chinese Title 中文標題" value={titleZh} onChangeText={setTitleZh} placeholder="運動標題" />

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Category 類別</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {(modalCategoriesQuery.data || []).map((cat: string) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                  onPress={() => setCategory(category === cat ? '' : cat)}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FormField label="Description 描述" value={description} onChangeText={setDescription} placeholder="Exercise description" multiline />
          <FormField label="Chinese Description 中文描述" value={descriptionZh} onChangeText={setDescriptionZh} placeholder="運動描述" multiline />
          <FormField label="Duration (seconds) 時長（秒）" value={durationSeconds} onChangeText={setDurationSeconds} placeholder="e.g. 120" keyboardType="phone-pad" />

          {_isAdmin && (
            <>
              <FormField label="Vimeo URL" value={vimeoUrl} onChangeText={setVimeoUrl} placeholder="https://vimeo.com/..." />
              <FormField label="YouTube URL" value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="https://youtube.com/..." />
            </>
          )}

          {isClinician && (
            <View style={styles.mediaRequestSection}>
              {mediaRequestSubmitted ? (
                <View style={styles.mediaRequestDone}>
                  <Check size={20} color={Colors.success} />
                  <Text style={styles.mediaRequestDoneText}>
                    Media request ready 媒體申請已準備
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.mediaRequestButton}
                  onPress={() => setShowMediaRequest(true)}
                  activeOpacity={0.7}
                >
                  <FileText size={18} color={Colors.white} />
                  <Text style={styles.mediaRequestButtonText}>
                    Request Media Setup 申請媒體設置
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {showMediaRequest && (
          <MediaRequestSheet
            videoRequired={mrVideoRequired}
            setVideoRequired={setMrVideoRequired}
            audioOptional={mrAudioOptional}
            setAudioOptional={setMrAudioOptional}
            subtitleOptional={mrSubtitleOptional}
            setSubtitleOptional={setMrSubtitleOptional}
            liveSubtitlesOptional={mrLiveSubtitlesOptional}
            setLiveSubtitlesOptional={setMrLiveSubtitlesOptional}
            videoUrl={mrVideoUrl}
            setVideoUrl={setMrVideoUrl}
            notes={mrNotes}
            setNotes={setMrNotes}
            declared={mrDeclared}
            setDeclared={setMrDeclared}
            onSubmit={handleMediaRequestSubmit}
            onClose={() => setShowMediaRequest(false)}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MediaRequestSheet({
  videoRequired, setVideoRequired, audioOptional, setAudioOptional,
  subtitleOptional, setSubtitleOptional, liveSubtitlesOptional, setLiveSubtitlesOptional,
  videoUrl, setVideoUrl, notes, setNotes, declared, setDeclared, onSubmit, onClose,
}: {
  videoRequired: boolean; setVideoRequired: (v: boolean) => void;
  audioOptional: boolean; setAudioOptional: (v: boolean) => void;
  subtitleOptional: boolean; setSubtitleOptional: (v: boolean) => void;
  liveSubtitlesOptional: boolean; setLiveSubtitlesOptional: (v: boolean) => void;
  videoUrl: string; setVideoUrl: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  declared: boolean; setDeclared: (v: boolean) => void;
  onSubmit: () => void; onClose: () => void;
}) {
  return (
    <View style={styles.sheetOverlay}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHandle} />
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>Media Setup Request 媒體設置申請</Text>
          <View style={styles.sheetCheckboxGroup}>
            <CheckboxRow label="Video Link (Required) 影片連結（必填）" icon={<Video size={16} color={Colors.accent} />} checked={videoRequired} onToggle={() => setVideoRequired(!videoRequired)} />
            <CheckboxRow label="Audio (Optional) 音訊（選填）" icon={<Headphones size={16} color={Colors.success} />} checked={audioOptional} onToggle={() => setAudioOptional(!audioOptional)} />
            <CheckboxRow label="Subtitle (Optional) 字幕（選填）" icon={<Subtitles size={16} color={Colors.info} />} checked={subtitleOptional} onToggle={() => setSubtitleOptional(!subtitleOptional)} />
            <CheckboxRow label="Live Subtitles (Optional) 即時字幕（選填）" icon={<Mic size={16} color={Colors.warning} />} checked={liveSubtitlesOptional} onToggle={() => setLiveSubtitlesOptional(!liveSubtitlesOptional)} />
          </View>
          <View style={styles.sheetField}>
            <View style={styles.sheetFieldLabel}>
              <Link size={14} color={Colors.textSecondary} />
              <Text style={styles.formLabel}>Video URL 影片網址</Text>
            </View>
            <TextInput style={styles.formInput} value={videoUrl} onChangeText={setVideoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
          </View>
          <View style={styles.sheetField}>
            <View style={styles.sheetFieldLabel}>
              <MessageSquare size={14} color={Colors.textSecondary} />
              <Text style={styles.formLabel}>Notes 備註</Text>
            </View>
            <TextInput style={[styles.formInput, styles.formInputMultiline]} value={notes} onChangeText={setNotes} placeholder="Additional notes..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          </View>
          <CheckboxRow label="I declare the above information is accurate and I have the rights to this media.\n本人聲明以上資料準確無誤，並擁有相關媒體使用權。" checked={declared} onToggle={() => setDeclared(!declared)} bold />
          <View style={styles.sheetButtons}>
            <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose}>
              <Text style={styles.sheetCancelText}>Cancel 取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetSubmitBtn, !declared && styles.sheetSubmitBtnDisabled]} onPress={onSubmit} disabled={!declared}>
              <Text style={styles.sheetSubmitText}>Submit 提交</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function CheckboxRow({ label, icon, checked, onToggle, bold }: {
  label: string; icon?: React.ReactNode; checked: boolean; onToggle: () => void; bold?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.checkboxRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Check size={12} color={Colors.white} />}
      </View>
      {icon && <View style={styles.checkboxIcon}>{icon}</View>}
      <Text style={[styles.checkboxLabel, bold && styles.checkboxLabelBold]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (text: string) => void; placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url'; multiline?: boolean;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary} keyboardType={keyboardType || 'default'}
        multiline={multiline} numberOfLines={multiline ? 3 : 1} autoCapitalize="sentences"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0ED' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.3 },
  headerCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const, marginTop: 2 },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 10, height: 44, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  filterButtonActive: { backgroundColor: Colors.accent },
  filterButtonText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const, maxWidth: 70 },
  filterButtonTextActive: { color: Colors.white },
  viewToggleButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.white, alignItems: 'center' as const, justifyContent: 'center' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: Colors.danger },
  retryButton: { backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: Colors.white, fontWeight: '600' as const },
  gridContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  gridRow: { justifyContent: 'space-between' as const },
  listContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 8 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textTertiary, fontWeight: '500' as const },
  emptyTextZh: { fontSize: 13, color: Colors.textTertiary },

  gridCard: { width: GRID_CARD_WIDTH, backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 2 },
  gridThumb: { width: '100%' as const, height: 100, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  gridThumbPlaceholder: { width: '100%' as const, height: 100, backgroundColor: '#2C2C2E', alignItems: 'center' as const, justifyContent: 'center' as const },
  gridCardBody: { padding: 10, gap: 4 },
  gridTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text, lineHeight: 17 },
  gridTitleZh: { fontSize: 11, color: Colors.textSecondary, lineHeight: 14 },
  gridBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  gridCatBadge: { backgroundColor: '#EDE9E3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, maxWidth: 90 },
  gridCatBadgeText: { fontSize: 9, fontWeight: '600' as const, color: Colors.textSecondary },
  gridStatusDot: { width: 7, height: 7, borderRadius: 4 },
  gridSharedBadge: { backgroundColor: Colors.infoLight, borderRadius: 4, padding: 3 },
  gridDuration: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  gridDurationText: { fontSize: 10, color: Colors.textTertiary, fontWeight: '500' as const },

  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  listThumb: { width: 60, height: 60, borderRadius: 10 },
  listThumbPlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center' as const, justifyContent: 'center' as const },
  listCardBody: { flex: 1, gap: 4 },
  listTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listCatBadge: { backgroundColor: '#EDE9E3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  listCatBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.textSecondary },
  listDurationText: { fontSize: 10, color: Colors.textTertiary, fontWeight: '500' as const },

  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 40 },
  categoryModal: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, width: '100%', maxHeight: 420 },
  categoryModalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  categoryList: { maxHeight: 340 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  categoryOptionSelected: { backgroundColor: Colors.accentLight + '40' },
  categoryOptionText: { fontSize: 15, color: Colors.text },
  categoryOptionTextSelected: { fontWeight: '600' as const, color: Colors.accent },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalCancel: { fontSize: 15, color: Colors.textSecondary },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  modalSave: { fontSize: 15, color: Colors.accent, fontWeight: '600' as const },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, gap: 16, paddingBottom: 40 },
  formField: { gap: 6 },
  formLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginLeft: 4 },
  formInput: { backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  formInputMultiline: { minHeight: 80, textAlignVertical: 'top' as const },
  categoryPicker: { flexDirection: 'row', marginTop: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, marginRight: 8, borderWidth: 1, borderColor: Colors.borderLight },
  categoryChipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  categoryChipTextSelected: { color: Colors.white },
  mediaRequestSection: { marginTop: 8 },
  mediaRequestButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.info, borderRadius: 12, paddingVertical: 14 },
  mediaRequestButtonText: { color: Colors.white, fontWeight: '600' as const, fontSize: 15 },
  mediaRequestDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.successLight, borderRadius: 12, paddingVertical: 14 },
  mediaRequestDoneText: { color: Colors.success, fontWeight: '600' as const, fontSize: 15 },
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  sheetCheckboxGroup: { gap: 4, marginBottom: 16 },
  sheetField: { gap: 6, marginBottom: 16 },
  sheetFieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 16, paddingBottom: 20 },
  sheetCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  sheetCancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  sheetSubmitBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.accent },
  sheetSubmitBtnDisabled: { opacity: 0.5 },
  sheetSubmitText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkboxIcon: { marginRight: -2 },
  checkboxLabel: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 19 },
  checkboxLabelBold: { fontWeight: '500' as const },
});
