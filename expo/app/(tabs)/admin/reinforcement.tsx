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
  Volume2,
  Star,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface ReinforcementAudio {
  id: string;
  name_en: string;
  name_zh: string;
  youtube_id_en?: string;
  youtube_id_zh_hant?: string;
  youtube_id_zh_hans?: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  audio_url_en?: string;
  audio_url_zh_hant?: string;
  audio_url_zh_hans?: string;
}

function getSourceBadges(item: ReinforcementAudio) {
  const badges: { label: string; color: string }[] = [];
  if (item.youtube_id_en) badges.push({ label: 'YT EN', color: Colors.danger });
  if (item.youtube_id_zh_hant) badges.push({ label: 'YT 繁', color: '#7C5CFC' });
  if (item.youtube_id_zh_hans) badges.push({ label: 'YT 简', color: Colors.info });
  if (item.audio_url_en) badges.push({ label: 'Audio EN', color: Colors.success });
  if (item.audio_url_zh_hant) badges.push({ label: 'Audio 繁', color: '#D4A030' });
  if (item.audio_url_zh_hans) badges.push({ label: 'Audio 简', color: '#E07AAA' });
  return badges;
}

export default function ReinforcementScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [description, setDescription] = useState('');
  const [ytEn, setYtEn] = useState('');
  const [ytZhHant, setYtZhHant] = useState('');
  const [ytZhHans, setYtZhHans] = useState('');
  const [audioEn, setAudioEn] = useState('');
  const [audioZhHant, setAudioZhHant] = useState('');
  const [audioZhHans, setAudioZhHans] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const audioQuery = useQuery({
    queryKey: ['admin-reinforcement-audio'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('reinforcement_audio_library')
          .select('*')
          .order('is_default', { ascending: false });
        if (error) throw error;
        return (data || []) as ReinforcementAudio[];
      } catch (e) {
        console.log('Error fetching reinforcement audio:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!audioQuery.data) return [];
    if (!search.trim()) return audioQuery.data;
    const s = search.toLowerCase();
    return audioQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) || a.name_zh?.includes(s)
    );
  }, [audioQuery.data, search]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setNameEn('');
    setNameZh('');
    setDescription('');
    setYtEn('');
    setYtZhHant('');
    setYtZhHans('');
    setAudioEn('');
    setAudioZhHant('');
    setAudioZhHans('');
    setIsDefault(false);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEdit = useCallback((item: ReinforcementAudio) => {
    setEditingId(item.id);
    setNameEn(item.name_en || '');
    setNameZh(item.name_zh || '');
    setDescription(item.description || '');
    setYtEn(item.youtube_id_en || '');
    setYtZhHant(item.youtube_id_zh_hant || '');
    setYtZhHans(item.youtube_id_zh_hans || '');
    setAudioEn(item.audio_url_en || '');
    setAudioZhHant(item.audio_url_zh_hant || '');
    setAudioZhHans(item.audio_url_zh_hans || '');
    setIsDefault(item.is_default ?? false);
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim()) throw new Error('English name is required');
      const payload: Record<string, unknown> = {
        name_en: nameEn.trim(),
        name_zh: nameZh.trim() || null,
        description: description.trim() || null,
        youtube_id_en: ytEn.trim() || null,
        youtube_id_zh_hant: ytZhHant.trim() || null,
        youtube_id_zh_hans: ytZhHans.trim() || null,
        audio_url_en: audioEn.trim() || null,
        audio_url_zh_hant: audioZhHant.trim() || null,
        audio_url_zh_hans: audioZhHans.trim() || null,
        is_default: isDefault,
      };
      if (editingId) {
        const { error } = await supabase.from('reinforcement_audio_library').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reinforcement_audio_library').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reinforcement-audio'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reinforcement_audio_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reinforcement-audio'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Delete Audio 刪除音訊', 'Are you sure? 確定刪除？', [
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
            <Text style={styles.headerTitle}>Reinforcement</Text>
            <Text style={styles.headerSubtitle}>強化音訊</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search audio..."
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
          <RefreshControl refreshing={audioQuery.isFetching} onRefresh={() => void audioQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {audioQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Volume2 size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No reinforcement audio found</Text>
            <Text style={styles.emptySubtext}>找不到強化音訊</Text>
          </View>
        ) : (
          filtered.map(item => (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardIconWrap}>
                  <Volume2 size={20} color={Colors.accent} />
                </View>
                <View style={styles.cardTitleArea}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name_en}</Text>
                    {item.is_default && (
                      <View style={styles.defaultBadge}>
                        <Star size={10} color="#B8860B" />
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  {item.name_zh ? <Text style={styles.cardSubtitle} numberOfLines={1}>{item.name_zh}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
              {item.description ? (
                <Text style={styles.descText} numberOfLines={1}>{item.description}</Text>
              ) : null}
              <View style={styles.badgeRow}>
                {getSourceBadges(item).map((b, i) => (
                  <View key={i} style={[styles.sourceBadge, { backgroundColor: b.color + '15' }]}>
                    <Text style={[styles.sourceBadgeText, { color: b.color }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Audio</Text>
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
              <TextInput style={styles.input} value={nameEn} onChangeText={setNameEn} placeholder="Clapping sounds" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Name (ZH) 中文名稱</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="拍手聲" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Description 描述</Text>
              <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Description..." placeholderTextColor={Colors.textTertiary} multiline />

              <Text style={styles.sectionHeader}>YouTube IDs</Text>

              <Text style={styles.fieldLabel}>YouTube ID (EN)</Text>
              <TextInput style={styles.input} value={ytEn} onChangeText={setYtEn} placeholder="dQw4w9WgXcQ" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>YouTube ID (繁體中文)</Text>
              <TextInput style={styles.input} value={ytZhHant} onChangeText={setYtZhHant} placeholder="Video ID" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>YouTube ID (简体中文)</Text>
              <TextInput style={styles.input} value={ytZhHans} onChangeText={setYtZhHans} placeholder="Video ID" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

              <Text style={styles.sectionHeader}>Audio URLs</Text>

              <Text style={styles.fieldLabel}>Audio URL (EN)</Text>
              <TextInput style={styles.input} value={audioEn} onChangeText={setAudioEn} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <Text style={styles.fieldLabel}>Audio URL (繁體中文)</Text>
              <TextInput style={styles.input} value={audioZhHant} onChangeText={setAudioZhHant} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <Text style={styles.fieldLabel}>Audio URL (简体中文)</Text>
              <TextInput style={styles.input} value={audioZhHans} onChangeText={setAudioZhHans} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Default 預設</Text>
                <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#D4A030', false: Colors.border }} thumbColor={Colors.white} />
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
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleArea: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flexShrink: 1 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#B8860B' },
  descText: { fontSize: 12, color: Colors.textTertiary, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sourceBadgeText: { fontSize: 10, fontWeight: '600' as const },
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
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
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

