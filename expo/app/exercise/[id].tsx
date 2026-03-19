import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Video,
  Headphones,
  Clock,
  Share2,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/colors';
import { Exercise } from '@/types';

const CATEGORIES = [
  'Articulation',
  'Phonology',
  'Fluency',
  'Voice',
  'Language',
  'Swallowing',
  'Oral Motor',
  'Pragmatics',
  'Other',
];

function getMediaStatusInfo(status?: string) {
  switch (status) {
    case 'pending_review':
      return { label: '🟡 Pending Review 待審核', color: Colors.warning, bg: Colors.warningLight };
    case 'rejected':
      return { label: '🔴 Rejected 已拒絕', color: Colors.danger, bg: Colors.dangerLight };
    case 'active':
    default:
      return { label: '🟢 Active 活躍', color: Colors.success, bg: Colors.successLight };
  }
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, clinician } = useAuth();

  const [title, setTitle] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const exerciseQuery = useQuery({
    queryKey: ['exercise', id],
    queryFn: async () => {
      console.log('Fetching exercise detail:', id);
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.log('Exercise detail fetch error:', error);
        throw error;
      }
      return data as Exercise;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (exerciseQuery.data) {
      const e = exerciseQuery.data;
      setTitle(e.title_en || '');
      setTitleZh(e.title_zh_hant || '');
      setCategory(e.category || '');
      setDescription(e.description_en || '');
      setDescriptionZh(e.description_zh_hant || '');
      setDurationSeconds(e.default_duration_minutes ? String(e.default_duration_minutes) : '');
      setVimeoUrl(e.vimeo_video_id || '');
      setYoutubeUrl(e.youtube_video_id || '');
    }
  }, [exerciseQuery.data]);

  const exercise = exerciseQuery.data;
  const isOwn = exercise?.created_by_clinician_id === clinician?.id;
  const isShared = !isAdmin && !isOwn;
  const canEdit = isAdmin || isOwn;
  const statusInfo = exercise ? getMediaStatusInfo(exercise.media_status) : null;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('exercise_library')
        .update({
          title_en: title.trim(),
          title_zh_hant: titleZh.trim() || null,
          category: category.trim() || null,
          description_en: description.trim() || null,
          description_zh_hant: descriptionZh.trim() || null,
          default_duration_minutes: durationSeconds ? parseInt(durationSeconds, 10) : null,
          vimeo_video_id: vimeoUrl.trim() || null,
          youtube_video_id: youtubeUrl.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      void queryClient.invalidateQueries({ queryKey: ['exercise', id] });
      Alert.alert('Success 成功', 'Exercise updated.\n運動已更新。');
    },
    onError: (error: Error) => {
      console.log('Update exercise error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing Title 標題不完整', 'Please enter exercise title.\n請輸入運動標題。');
      return;
    }
    updateMutation.mutate();
  }, [title, updateMutation]);

  if (exerciseQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Exercise Detail', headerShown: true, headerBackTitle: 'Back' }} />
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (exerciseQuery.isError || !exercise) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Exercise Detail', headerShown: true, headerBackTitle: 'Back' }} />
        <Text style={styles.errorText}>Failed to load exercise</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: exercise.title_en || 'Exercise',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: canEdit
            ? () => (
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={updateMutation.isPending}
                  style={styles.headerSaveBtn}
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Save size={20} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusRow}>
          {statusInfo && (
            <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusPillText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          )}
          {isShared && (
            <View style={styles.sharedPill}>
              <Share2 size={12} color={Colors.info} />
              <Text style={styles.sharedPillText}>Shared (Read-only)</Text>
            </View>
          )}
        </View>

        <View style={styles.mediaRow}>
          {exercise.vimeo_video_id && (
            <View style={styles.mediaTag}>
              <Video size={14} color={Colors.accent} />
              <Text style={styles.mediaTagText}>Vimeo</Text>
            </View>
          )}
          {exercise.youtube_video_id && (
            <View style={styles.mediaTag}>
              <Video size={14} color="#FF0000" />
              <Text style={styles.mediaTagText}>YouTube</Text>
            </View>
          )}
          {exercise.audio_instruction_url_en && (
            <View style={styles.mediaTag}>
              <Headphones size={14} color={Colors.success} />
              <Text style={styles.mediaTagText}>Audio</Text>
            </View>
          )}
          {exercise.default_duration_minutes && (
            <View style={styles.mediaTag}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.mediaTagText}>
                {exercise.default_duration_minutes} min
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details 詳細資料</Text>

          <FieldRow label="Title 標題 *" editable={canEdit}>
            <TextInput
              style={[styles.input, !canEdit && styles.inputDisabled]}
              value={title}
              onChangeText={setTitle}
              editable={canEdit}
              placeholder="Exercise title"
              placeholderTextColor={Colors.textTertiary}
            />
          </FieldRow>

          <FieldRow label="Chinese Title 中文標題" editable={canEdit}>
            <TextInput
              style={[styles.input, !canEdit && styles.inputDisabled]}
              value={titleZh}
              onChangeText={setTitleZh}
              editable={canEdit}
              placeholder="運動標題"
              placeholderTextColor={Colors.textTertiary}
            />
          </FieldRow>

          <FieldRow label="Category 類別" editable={canEdit}>
            {canEdit ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipSelected]}
                    onPress={() => setCategory(category === cat ? '' : cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{category || '—'}</Text>
              </View>
            )}
          </FieldRow>

          <FieldRow label="Description 描述" editable={canEdit}>
            <TextInput
              style={[styles.input, styles.inputMultiline, !canEdit && styles.inputDisabled]}
              value={description}
              onChangeText={setDescription}
              editable={canEdit}
              placeholder="Exercise description"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </FieldRow>

          <FieldRow label="Chinese Description 中文描述" editable={canEdit}>
            <TextInput
              style={[styles.input, styles.inputMultiline, !canEdit && styles.inputDisabled]}
              value={descriptionZh}
              onChangeText={setDescriptionZh}
              editable={canEdit}
              placeholder="運動描述"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </FieldRow>

          <FieldRow label="Duration (minutes) 時長（分鐘）" editable={canEdit}>
            <TextInput
              style={[styles.input, !canEdit && styles.inputDisabled]}
              value={durationSeconds}
              onChangeText={setDurationSeconds}
              editable={canEdit}
              placeholder="e.g. 120"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </FieldRow>

          {(canEdit || exercise.vimeo_video_id) && (
            <FieldRow label="Vimeo Video ID" editable={canEdit}>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={vimeoUrl}
                onChangeText={setVimeoUrl}
                editable={canEdit}
                placeholder="https://vimeo.com/..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </FieldRow>
          )}

          {(canEdit || exercise.youtube_video_id) && (
            <FieldRow label="YouTube Video ID" editable={canEdit}>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                editable={canEdit}
                placeholder="https://youtube.com/..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </FieldRow>
          )}
        </View>

        <View style={styles.metaSection}>
          <Text style={styles.metaLabel}>Created 建立時間</Text>
          <Text style={styles.metaValue}>
            {exercise.created_at ? new Date(exercise.created_at).toLocaleDateString() : '—'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldRow({
  label,
  editable: _editable,
  children,
}: {
  label: string;
  editable: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F0ED',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  headerSaveBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.infoLight,
  },
  sharedPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.info,
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mediaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mediaTagText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textSecondary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  readOnlyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  metaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
});
