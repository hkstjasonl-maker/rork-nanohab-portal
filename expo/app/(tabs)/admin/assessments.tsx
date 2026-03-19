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
  ClipboardCheck,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Assessment {
  id: string;
  name_en: string;
  name_zh?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

export default function AssessmentsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const assessmentsQuery = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          if (error.message?.includes('does not exist') || error.code === '42P01') {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data || []) as Assessment[];
      } catch (e: any) {
        console.log('Error fetching assessments:', e);
        if (e?.message?.includes('does not exist') || e?.code === '42P01') {
          setTableExists(false);
        }
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!assessmentsQuery.data) return [];
    if (!search.trim()) return assessmentsQuery.data;
    const s = search.toLowerCase();
    return assessmentsQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s) ||
      a.category?.toLowerCase().includes(s)
    );
  }, [assessmentsQuery.data, search]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setNameEn('');
    setNameZh('');
    setCategory('');
    setDescription('');
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((a: Assessment) => {
    setEditingId(a.id);
    setNameEn(a.name_en || '');
    setNameZh(a.name_zh || '');
    setCategory(a.category || '');
    setDescription(a.description || '');
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim()) throw new Error('English name is required');
      const payload = {
        name_en: nameEn.trim(),
        name_zh: nameZh.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('assessment_library').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assessment_library').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  if (!tableExists) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft size={24} color={Colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Assessments</Text>
              <Text style={styles.headerSubtitle}>評估庫</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.placeholderCenter}>
          <ClipboardCheck size={56} color={Colors.textTertiary} />
          <Text style={styles.placeholderTitle}>Coming Soon</Text>
          <Text style={styles.placeholderSubtitle}>即將推出</Text>
          <Text style={styles.placeholderDesc}>The assessment library table has not been set up yet.{'\n'}Use the web portal to configure it.</Text>
        </View>
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
            <Text style={styles.headerTitle}>Assessments</Text>
            <Text style={styles.headerSubtitle}>評估庫</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assessments..."
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
          <RefreshControl refreshing={assessmentsQuery.isFetching} onRefresh={() => void assessmentsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {assessmentsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No assessments found</Text>
        ) : (
          filtered.map(a => (
            <TouchableOpacity key={a.id} style={styles.card} onPress={() => openEdit(a)} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{a.name_en}</Text>
                  {a.name_zh && <Text style={styles.cardNameZh}>{a.name_zh}</Text>}
                </View>
                {a.category && (
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{a.category}</Text>
                  </View>
                )}
              </View>
              {a.description && <Text style={styles.cardDesc} numberOfLines={2}>{a.description}</Text>}
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Assessment</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Name (English)</Text>
              <TextInput style={styles.input} value={nameEn} onChangeText={setNameEn} placeholder="Assessment name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Name (Chinese) 中文名稱</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="評估名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Category 類別</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Description 描述</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor={Colors.textTertiary}
                multiline
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
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardNameZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  catBadge: { backgroundColor: Colors.infoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
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
  placeholderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  placeholderTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginTop: 12 },
  placeholderSubtitle: { fontSize: 16, color: Colors.textSecondary },
  placeholderDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
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
});
