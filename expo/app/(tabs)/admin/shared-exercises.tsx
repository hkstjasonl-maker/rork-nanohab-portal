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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Plus,
  Shield,
  Trash2,
  Share2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface SharedExerciseItem {
  id: string;
  exercise_library_id: string;
  clinician_id: string;
  created_at?: string;
  exercise_library?: { title_en: string; title_zh_hant?: string };
  clinicians?: { full_name: string; full_name_zh?: string };
}

interface ExerciseOption {
  id: string;
  title_en: string;
  title_zh_hant?: string;
}

interface ClinicianOption {
  id: string;
  full_name: string;
  full_name_zh?: string;
  email: string;
}

export default function SharedExercisesScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedClinicianId, setSelectedClinicianId] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [clinicianSearch, setClinicianSearch] = useState('');

  const sharedQuery = useQuery({
    queryKey: ['admin-shared-exercises'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('shared_exercises')
          .select('*, exercise_library(title_en, title_zh_hant), clinicians(full_name, full_name_zh)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as SharedExerciseItem[];
      } catch (e) {
        console.log('Error fetching shared exercises:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const exercisesQuery = useQuery({
    queryKey: ['admin-all-exercises'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('exercise_library').select('id, title_en, title_zh_hant').order('title_en');
        if (error) throw error;
        return (data || []) as ExerciseOption[];
      } catch (e) {
        console.log('Error fetching exercises:', e);
        return [];
      }
    },
    enabled: isAdmin && addModalVisible,
  });

  const cliniciansQuery = useQuery({
    queryKey: ['admin-all-clinicians-picker'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('clinicians').select('id, full_name, full_name_zh, email').eq('is_active', true).order('full_name');
        if (error) throw error;
        return (data || []) as ClinicianOption[];
      } catch (e) {
        console.log('Error fetching clinicians:', e);
        return [];
      }
    },
    enabled: isAdmin && addModalVisible,
  });

  const filtered = useMemo(() => {
    if (!sharedQuery.data) return [];
    if (!search.trim()) return sharedQuery.data;
    const s = search.toLowerCase();
    return sharedQuery.data.filter(se =>
      se.exercise_library?.title_en?.toLowerCase().includes(s) ||
      se.clinicians?.full_name?.toLowerCase().includes(s)
    );
  }, [sharedQuery.data, search]);

  const filteredExercises = useMemo(() => {
    if (!exercisesQuery.data) return [];
    if (!exerciseSearch.trim()) return exercisesQuery.data;
    const s = exerciseSearch.toLowerCase();
    return exercisesQuery.data.filter(e => e.title_en?.toLowerCase().includes(s) || e.title_zh_hant?.toLowerCase().includes(s));
  }, [exercisesQuery.data, exerciseSearch]);

  const filteredClinicians = useMemo(() => {
    if (!cliniciansQuery.data) return [];
    if (!clinicianSearch.trim()) return cliniciansQuery.data;
    const s = clinicianSearch.toLowerCase();
    return cliniciansQuery.data.filter(c => c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s));
  }, [cliniciansQuery.data, clinicianSearch]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExerciseId || !selectedClinicianId) throw new Error('Select both exercise and clinician');
      const { error } = await supabase.from('shared_exercises').upsert(
        { exercise_library_id: selectedExerciseId, clinician_id: selectedClinicianId },
        { onConflict: 'exercise_library_id,clinician_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-shared-exercises'] });
      setAddModalVisible(false);
      setSelectedExerciseId('');
      setSelectedClinicianId('');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shared_exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-shared-exercises'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const confirmDelete = useCallback((id: string) => {
    Alert.alert('Remove Share 移除共享', 'Remove this shared exercise?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
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
            <Text style={styles.headerTitle}>Shared Exercises</Text>
            <Text style={styles.headerSubtitle}>共享運動</Text>
          </View>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search shared exercises..."
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
          <RefreshControl refreshing={sharedQuery.isFetching} onRefresh={() => void sharedQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {sharedQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No shared exercises found</Text>
        ) : (
          filtered.map(se => (
            <View key={se.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconWrap}>
                  <Share2 size={18} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{se.exercise_library?.title_en || 'Unknown'}</Text>
                  {se.exercise_library?.title_zh_hant && (
                    <Text style={styles.cardTitleZh}>{se.exercise_library.title_zh_hant}</Text>
                  )}
                  <Text style={styles.cardClinician}>
                    → {se.clinicians?.full_name || 'Unknown'}{se.clinicians?.full_name_zh ? ` ${se.clinicians.full_name_zh}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(se.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { setAddModalVisible(true); setSelectedExerciseId(''); setSelectedClinicianId(''); setExerciseSearch(''); setClinicianSearch(''); }} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Share Exercise 共享運動</Text>
            <TouchableOpacity onPress={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={[styles.saveText, (!selectedExerciseId || !selectedClinicianId) && { opacity: 0.4 }]}>Add</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.sectionLabel}>Select Exercise 選擇運動</Text>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search exercises..."
              placeholderTextColor={Colors.textTertiary}
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
            />
            <View style={styles.pickerList}>
              {filteredExercises.slice(0, 30).map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.pickerItem, selectedExerciseId === e.id && styles.pickerItemActive]}
                  onPress={() => setSelectedExerciseId(e.id)}
                >
                  <Text style={[styles.pickerItemText, selectedExerciseId === e.id && styles.pickerItemTextActive]} numberOfLines={1}>
                    {e.title_en}{e.title_zh_hant ? ` ${e.title_zh_hant}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Select Clinician 選擇治療師</Text>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search clinicians..."
              placeholderTextColor={Colors.textTertiary}
              value={clinicianSearch}
              onChangeText={setClinicianSearch}
            />
            <View style={styles.pickerList}>
              {filteredClinicians.slice(0, 30).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pickerItem, selectedClinicianId === c.id && styles.pickerItemActive]}
                  onPress={() => setSelectedClinicianId(c.id)}
                >
                  <Text style={[styles.pickerItemText, selectedClinicianId === c.id && styles.pickerItemTextActive]} numberOfLines={1}>
                    {c.full_name}{c.full_name_zh ? ` ${c.full_name_zh}` : ''} — {c.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.accent },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  countText: { fontSize: 16, fontWeight: '600' as const, color: 'rgba(255,255,255,0.9)' },
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
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  cardTitleZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  cardClinician: { fontSize: 12, color: Colors.accent, marginTop: 3 },
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
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
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
  modalContent: { padding: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginTop: 16, marginBottom: 10 },
  pickerSearch: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  pickerList: { gap: 4 },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerItemActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pickerItemText: { fontSize: 14, color: Colors.text },
  pickerItemTextActive: { color: Colors.white, fontWeight: '600' as const },
});

