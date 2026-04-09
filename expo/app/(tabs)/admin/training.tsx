import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Switch,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  BookOpen,
  FileText,
  Users,
  BarChart3,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Upload,
  UserPlus,
  RefreshCw,
  Eye,
  Clock,
  Ban,
  Calendar,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  TrainingCourse,
  TrainingMaterial,
  TrainingEnrollment,
  TrainingMaterialAssignment,
} from '@/types';

type TabKey = 'courses' | 'materials' | 'assignments' | 'analytics';

interface CourseWithCounts extends TrainingCourse {
  materialCount?: number;
  enrollmentCount?: number;
}

export default function TrainingManagementScreen() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('courses');

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 16, color: '#999' }}>Admin access required 需要管理員權限</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <GraduationCap size={22} color={Colors.white} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Training Library</Text>
            <Text style={styles.headerSubtitle}>培訓文庫管理</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
          {([
            { key: 'courses' as TabKey, label: 'Courses 課程', icon: BookOpen },
            { key: 'materials' as TabKey, label: 'Materials 資料', icon: FileText },
            { key: 'assignments' as TabKey, label: 'Assign 分配', icon: Users },
            { key: 'analytics' as TabKey, label: 'Analytics 分析', icon: BarChart3 },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <tab.icon size={16} color={activeTab === tab.key ? Colors.white : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {activeTab === 'courses' && <CoursesTab />}
      {activeTab === 'materials' && <MaterialsTab />}
      {activeTab === 'assignments' && <AssignmentsTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </View>
  );
}

function CoursesTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [form, setForm] = useState({
    title: '',
    title_zh: '',
    description: '',
    course_date: '',
    location: '',
    location_zh: '',
    instructor_name: '',
    instructor_name_zh: '',
    max_participants: '',
    is_active: true,
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-training-courses'],
    queryFn: async () => {
      const { data: courses, error } = await supabase
        .from('training_courses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched: CourseWithCounts[] = await Promise.all(
        (courses || []).map(async (c: TrainingCourse) => {
          const { count: matCount } = await supabase
            .from('training_materials')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', c.id);
          const { count: enrCount } = await supabase
            .from('training_course_enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', c.id);
          return { ...c, materialCount: matCount ?? 0, enrollmentCount: enrCount ?? 0 };
        })
      );
      return enriched;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        title_zh: form.title_zh.trim() || null,
        description: form.description.trim() || null,
        course_date: form.course_date.trim() || null,
        location: form.location.trim() || null,
        location_zh: form.location_zh.trim() || null,
        instructor_name: form.instructor_name.trim() || null,
        instructor_name_zh: form.instructor_name_zh.trim() || null,
        max_participants: form.max_participants ? parseInt(form.max_participants, 10) : null,
        is_active: form.is_active,
      };
      if (!payload.title) throw new Error('Title is required');

      if (editingCourse) {
        const { error } = await supabase.from('training_courses').update(payload).eq('id', editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('training_courses').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-courses'] });
      setShowModal(false);
      resetForm();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-training-courses'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const resetForm = useCallback(() => {
    setForm({ title: '', title_zh: '', description: '', course_date: '', location: '', location_zh: '', instructor_name: '', instructor_name_zh: '', max_participants: '', is_active: true });
    setEditingCourse(null);
  }, []);

  const openEdit = useCallback((course: TrainingCourse) => {
    setEditingCourse(course);
    setForm({
      title: course.title || '',
      title_zh: course.title_zh || '',
      description: course.description || '',
      course_date: course.course_date || '',
      location: course.location || '',
      location_zh: course.location_zh || '',
      instructor_name: course.instructor_name || '',
      instructor_name_zh: course.instructor_name_zh || '',
      max_participants: course.max_participants?.toString() || '',
      is_active: course.is_active ?? true,
    });
    setShowModal(true);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  const confirmDelete = useCallback((id: string, title: string) => {
    Alert.alert('Delete Course', `Delete "${title}"? This will also remove enrollments.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }, [deleteMutation]);

  return (
    <View style={styles.tabContent}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={coursesQuery.isFetching} onRefresh={() => coursesQuery.refetch()} tintColor={Colors.accent} />}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Courses ({coursesQuery.data?.length ?? 0})</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/admin/clinicians' as any)}>
              <UserPlus size={14} color={Colors.white} />
              <Text style={styles.btnPrimaryText}>New Participant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={openCreate}>
              <Plus size={14} color={Colors.white} />
              <Text style={styles.btnPrimaryText}>Add Course</Text>
            </TouchableOpacity>
          </View>
        </View>

        {coursesQuery.isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={Colors.accent} />}

        {coursesQuery.data?.map((course) => (
          <View key={course.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{course.title}</Text>
                {course.title_zh ? <Text style={styles.cardSubtext}>{course.title_zh}</Text> : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: course.is_active ? Colors.successLight : Colors.dangerLight }]}>
                <Text style={[styles.statusText, { color: course.is_active ? Colors.success : Colors.danger }]}>
                  {course.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              {course.course_date ? (
                <View style={styles.metaItem}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{course.course_date}</Text>
                </View>
              ) : null}
              {course.instructor_name ? (
                <View style={styles.metaItem}>
                  <Users size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{course.instructor_name}</Text>
                </View>
              ) : null}
              {course.location ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaText}>📍 {course.location}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <FileText size={12} color={Colors.info} />
                <Text style={styles.statChipText}>{course.materialCount} materials</Text>
              </View>
              <View style={styles.statChip}>
                <Users size={12} color={Colors.accent} />
                <Text style={styles.statChipText}>{course.enrollmentCount} enrolled</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(course)}>
                <Edit3 size={14} color={Colors.info} />
                <Text style={[styles.actionText, { color: Colors.info }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(course.id, course.title)}>
                <Trash2 size={14} color={Colors.danger} />
                <Text style={[styles.actionText, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {coursesQuery.data?.length === 0 && !coursesQuery.isLoading && (
          <Text style={styles.emptyText}>No courses yet. Create one to get started.</Text>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingCourse ? 'Edit Course' : 'New Course'}</Text>
            <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <ActivityIndicator size="small" color={Colors.accent} /> : <Check size={24} color={Colors.accent} />}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <FormField label="Title *" value={form.title} onChangeText={(v) => setForm(p => ({ ...p, title: v }))} />
            <FormField label="Title (Chinese) 中文標題" value={form.title_zh} onChangeText={(v) => setForm(p => ({ ...p, title_zh: v }))} />
            <FormField label="Description" value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} multiline />
            <FormField label="Course Date (YYYY-MM-DD)" value={form.course_date} onChangeText={(v) => setForm(p => ({ ...p, course_date: v }))} placeholder="2025-06-15" />
            <FormField label="Location" value={form.location} onChangeText={(v) => setForm(p => ({ ...p, location: v }))} />
            <FormField label="Location (Chinese)" value={form.location_zh} onChangeText={(v) => setForm(p => ({ ...p, location_zh: v }))} />
            <FormField label="Instructor" value={form.instructor_name} onChangeText={(v) => setForm(p => ({ ...p, instructor_name: v }))} />
            <FormField label="Instructor (Chinese)" value={form.instructor_name_zh} onChangeText={(v) => setForm(p => ({ ...p, instructor_name_zh: v }))} />
            <FormField label="Max Participants" value={form.max_participants} onChangeText={(v) => setForm(p => ({ ...p, max_participants: v }))} keyboardType="numeric" />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm(p => ({ ...p, is_active: v }))} trackColor={{ true: Colors.accent }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function MaterialsTab() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<TrainingMaterial | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    title_zh: '',
    description: '',
    page_count: '',
    sort_order: '0',
    is_active: true,
    storage_path: '',
    file_size_bytes: 0,
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-training-courses-list'],
    queryFn: async () => {
      const { data } = await supabase.from('training_courses').select('id, title, title_zh').order('title');
      return data || [];
    },
  });

  const materialsQuery = useQuery({
    queryKey: ['admin-training-materials', selectedCourseId],
    queryFn: async () => {
      let query = supabase.from('training_materials').select('*').order('sort_order');
      if (selectedCourseId) query = query.eq('course_id', selectedCourseId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return 'All Courses';
    const c = coursesQuery.data?.find((x: any) => x.id === selectedCourseId);
    return c ? c.title : 'All Courses';
  }, [selectedCourseId, coursesQuery.data]);

  const pickAndUpload = useCallback(async (courseId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled || !result.assets?.[0]) return null;

      const file = result.assets[0];
      setUploading(true);

      const timestamp = Date.now();
      const path = `courses/${courseId}/${timestamp}.pdf`;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('training-materials').upload(path, blob, { contentType: 'application/pdf' });
        if (error) throw error;
      } else {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('training-materials').upload(path, blob, { contentType: 'application/pdf' });
        if (error) throw error;
      }

      setUploading(false);
      return { path, size: file.size || 0 };
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Upload Error', e.message);
      return null;
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required');

      const courseId = editingMaterial ? editingMaterial.course_id : selectedCourseId;
      if (!courseId) throw new Error('Select a course first');

      let storagePath = form.storage_path;
      let fileSize = form.file_size_bytes;

      if (!editingMaterial && !storagePath) {
        const uploaded = await pickAndUpload(courseId);
        if (!uploaded) throw new Error('PDF upload is required');
        storagePath = uploaded.path;
        fileSize = uploaded.size;
      }

      const payload = {
        course_id: courseId,
        title: form.title.trim(),
        title_zh: form.title_zh.trim() || null,
        description: form.description.trim() || null,
        storage_path: storagePath,
        file_size_bytes: fileSize || null,
        page_count: form.page_count ? parseInt(form.page_count, 10) : null,
        sort_order: parseInt(form.sort_order, 10) || 0,
        is_active: form.is_active,
      };

      if (editingMaterial) {
        const { error } = await supabase.from('training_materials').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('training_materials').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-materials'] });
      setShowModal(false);
      resetForm();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mat: TrainingMaterial) => {
      if (mat.storage_path) {
        await supabase.storage.from('training-materials').remove([mat.storage_path]);
      }
      const { error } = await supabase.from('training_materials').delete().eq('id', mat.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-training-materials'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const resetForm = useCallback(() => {
    setForm({ title: '', title_zh: '', description: '', page_count: '', sort_order: '0', is_active: true, storage_path: '', file_size_bytes: 0 });
    setEditingMaterial(null);
  }, []);

  const openCreate = useCallback(() => {
    if (!selectedCourseId) {
      Alert.alert('Select a course first');
      return;
    }
    resetForm();
    setShowModal(true);
  }, [selectedCourseId, resetForm]);

  const openEdit = useCallback((mat: TrainingMaterial) => {
    setEditingMaterial(mat);
    setForm({
      title: mat.title || '',
      title_zh: mat.title_zh || '',
      description: mat.description || '',
      page_count: mat.page_count?.toString() || '',
      sort_order: mat.sort_order?.toString() || '0',
      is_active: mat.is_active ?? true,
      storage_path: mat.storage_path || '',
      file_size_bytes: mat.file_size_bytes || 0,
    });
    setShowModal(true);
  }, []);

  const handleUploadNew = useCallback(async () => {
    if (!selectedCourseId) return;
    const uploaded = await pickAndUpload(selectedCourseId);
    if (uploaded) {
      setForm(p => ({ ...p, storage_path: uploaded.path, file_size_bytes: uploaded.size }));
    }
  }, [selectedCourseId, pickAndUpload]);

  return (
    <View style={styles.tabContent}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={materialsQuery.isFetching} onRefresh={() => materialsQuery.refetch()} tintColor={Colors.accent} />}
      >
        <View style={styles.sectionHeader}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowCourseDropdown(!showCourseDropdown)}>
            <Text style={styles.dropdownText} numberOfLines={1}>{selectedCourseName}</Text>
            <ChevronDown size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={openCreate}>
            <Plus size={14} color={Colors.white} />
            <Text style={styles.btnPrimaryText}>Add Material</Text>
          </TouchableOpacity>
        </View>

        {showCourseDropdown && (
          <View style={styles.dropdownList}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSelectedCourseId(null); setShowCourseDropdown(false); }}>
              <Text style={styles.dropdownItemText}>All Courses</Text>
            </TouchableOpacity>
            {coursesQuery.data?.map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.dropdownItem, selectedCourseId === c.id && { backgroundColor: Colors.accentLight }]} onPress={() => { setSelectedCourseId(c.id); setShowCourseDropdown(false); }}>
                <Text style={styles.dropdownItemText}>{c.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {materialsQuery.isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={Colors.accent} />}

        {materialsQuery.data?.map((mat: TrainingMaterial) => {
          const courseName = coursesQuery.data?.find((c: any) => c.id === mat.course_id)?.title || 'Unknown';
          return (
            <View key={mat.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <FileText size={18} color={Colors.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{mat.title}</Text>
                    {mat.title_zh ? <Text style={styles.cardSubtext}>{mat.title_zh}</Text> : null}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: mat.is_active ? Colors.successLight : Colors.dangerLight }]}>
                  <Text style={[styles.statusText, { color: mat.is_active ? Colors.success : Colors.danger }]}>
                    {mat.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              <Text style={styles.metaText}>Course: {courseName}</Text>
              <View style={styles.metaRow}>
                {mat.page_count ? <Text style={styles.metaText}>{mat.page_count} pages</Text> : null}
                {mat.file_size_bytes ? <Text style={styles.metaText}>{(mat.file_size_bytes / 1024 / 1024).toFixed(1)} MB</Text> : null}
                <Text style={styles.metaText}>Order: {mat.sort_order}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(mat)}>
                  <Edit3 size={14} color={Colors.info} />
                  <Text style={[styles.actionText, { color: Colors.info }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Delete Material', `Delete "${mat.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(mat) }])}>
                  <Trash2 size={14} color={Colors.danger} />
                  <Text style={[styles.actionText, { color: Colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {materialsQuery.data?.length === 0 && !materialsQuery.isLoading && (
          <Text style={styles.emptyText}>No materials found. {selectedCourseId ? 'Add materials to this course.' : 'Select a course to filter.'}</Text>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingMaterial ? 'Edit Material' : 'New Material'}</Text>
            <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading}>
              {(saveMutation.isPending || uploading) ? <ActivityIndicator size="small" color={Colors.accent} /> : <Check size={24} color={Colors.accent} />}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <FormField label="Title *" value={form.title} onChangeText={(v) => setForm(p => ({ ...p, title: v }))} />
            <FormField label="Title (Chinese)" value={form.title_zh} onChangeText={(v) => setForm(p => ({ ...p, title_zh: v }))} />
            <FormField label="Description" value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} multiline />
            <FormField label="Page Count" value={form.page_count} onChangeText={(v) => setForm(p => ({ ...p, page_count: v }))} keyboardType="numeric" />
            <FormField label="Sort Order" value={form.sort_order} onChangeText={(v) => setForm(p => ({ ...p, sort_order: v }))} keyboardType="numeric" />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm(p => ({ ...p, is_active: v }))} trackColor={{ true: Colors.accent }} />
            </View>

            {!editingMaterial && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabel}>PDF File *</Text>
                {form.storage_path ? (
                  <View style={styles.uploadedBadge}>
                    <Check size={14} color={Colors.success} />
                    <Text style={{ color: Colors.success, fontSize: 13, flex: 1 }}>File selected</Text>
                    <TouchableOpacity onPress={handleUploadNew}><Text style={{ color: Colors.info, fontSize: 13 }}>Change</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadNew} disabled={uploading}>
                    {uploading ? <ActivityIndicator size="small" color={Colors.accent} /> : (
                      <>
                        <Upload size={18} color={Colors.accent} />
                        <Text style={{ color: Colors.accent, fontWeight: '600' as const }}>Choose PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function AssignmentsTab() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<'enroll' | 'assign' | 'list'>('enroll');

  return (
    <View style={styles.tabContent}>
      <View style={styles.subTabBar}>
        {([
          { key: 'enroll' as const, label: 'Enrollment 註冊' },
          { key: 'assign' as const, label: 'Assign 分配' },
          { key: 'list' as const, label: 'List 列表' },
        ]).map((s) => (
          <TouchableOpacity key={s.key} style={[styles.subTab, section === s.key && styles.subTabActive]} onPress={() => setSection(s.key)}>
            <Text style={[styles.subTabText, section === s.key && styles.subTabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'enroll' && <EnrollmentSection />}
      {section === 'assign' && <AssignSection />}
      {section === 'list' && <AssignmentListSection />}
    </View>
  );
}

function EnrollmentSection() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');

  const coursesQuery = useQuery({
    queryKey: ['admin-training-courses-list'],
    queryFn: async () => {
      const { data } = await supabase.from('training_courses').select('id, title, title_zh').eq('is_active', true).order('title');
      return data || [];
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['admin-enrollments', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data } = await supabase
        .from('training_course_enrollments')
        .select('*, clinicians(id, full_name, full_name_zh, email)')
        .eq('course_id', selectedCourseId);
      return data || [];
    },
    enabled: !!selectedCourseId,
  });

  const cliniciansQuery = useQuery({
    queryKey: ['admin-all-clinicians-enroll'],
    queryFn: async () => {
      const { data } = await supabase.from('clinicians').select('id, full_name, full_name_zh, email, tier_id').eq('is_active', true);
      return data || [];
    },
  });

  const enrolledIds = useMemo(() => new Set((enrollmentsQuery.data || []).map((e: any) => e.clinician_id)), [enrollmentsQuery.data]);

  const filteredClinicians = useMemo(() => {
    const search = searchText.toLowerCase();
    return (cliniciansQuery.data || []).filter((c: any) => {
      if (!search) return true;
      return (c.full_name || '').toLowerCase().includes(search) || (c.email || '').toLowerCase().includes(search);
    });
  }, [cliniciansQuery.data, searchText]);

  const enrollMutation = useMutation({
    mutationFn: async (clinicianId: string) => {
      const { error } = await supabase.from('training_course_enrollments').insert({ course_id: selectedCourseId, clinician_id: clinicianId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const unenrollMutation = useMutation({
    mutationFn: async (clinicianId: string) => {
      const { error } = await supabase.from('training_course_enrollments').delete().eq('course_id', selectedCourseId).eq('clinician_id', clinicianId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const enrollAllTrainingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourseId) throw new Error('Select a course');
      const { data: tiers } = await supabase.from('clinician_tiers').select('id').ilike('name', '%Training Participant%');
      if (!tiers?.length) throw new Error('No "Training Participant" tier found');
      const tierIds = tiers.map((t: any) => t.id);
      const { data: participants } = await supabase.from('clinicians').select('id').in('tier_id', tierIds).eq('is_active', true);
      if (!participants?.length) throw new Error('No active training participants found');

      const toEnroll = participants.filter((p: any) => !enrolledIds.has(p.id));
      if (!toEnroll.length) { Alert.alert('Info', 'All training participants are already enrolled.'); return; }

      const rows = toEnroll.map((p: any) => ({ course_id: selectedCourseId, clinician_id: p.id }));
      const { error } = await supabase.from('training_course_enrollments').upsert(rows, { onConflict: 'course_id,clinician_id' });
      if (error) throw error;
      Alert.alert('Success', `Enrolled ${toEnroll.length} training participants.`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return 'Select Course...';
    return coursesQuery.data?.find((c: any) => c.id === selectedCourseId)?.title || 'Select Course...';
  }, [selectedCourseId, coursesQuery.data]);

  return (
    <ScrollView contentContainerStyle={styles.scrollPad} refreshControl={<RefreshControl refreshing={enrollmentsQuery.isFetching} onRefresh={() => enrollmentsQuery.refetch()} tintColor={Colors.accent} />}>
      <TouchableOpacity style={styles.dropdown} onPress={() => setShowCourseDropdown(!showCourseDropdown)}>
        <Text style={styles.dropdownText}>{selectedCourseName}</Text>
        <ChevronDown size={16} color={Colors.textSecondary} />
      </TouchableOpacity>

      {showCourseDropdown && (
        <View style={styles.dropdownList}>
          {coursesQuery.data?.map((c: any) => (
            <TouchableOpacity key={c.id} style={[styles.dropdownItem, selectedCourseId === c.id && { backgroundColor: Colors.accentLight }]} onPress={() => { setSelectedCourseId(c.id); setShowCourseDropdown(false); }}>
              <Text style={styles.dropdownItemText}>{c.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedCourseId && (
        <>
          <TouchableOpacity
            style={[styles.btnPrimary, { alignSelf: 'flex-start', marginTop: 12 }]}
            onPress={() => enrollAllTrainingMutation.mutate()}
            disabled={enrollAllTrainingMutation.isPending}
          >
            {enrollAllTrainingMutation.isPending ? <ActivityIndicator size="small" color={Colors.white} /> : <UserPlus size={14} color={Colors.white} />}
            <Text style={styles.btnPrimaryText}>Enroll All Training Participants</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
            Enrolled ({enrollmentsQuery.data?.length ?? 0})
          </Text>

          {enrollmentsQuery.data?.map((e: any) => (
            <View key={e.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listRowTitle}>{e.clinicians?.full_name || 'Unknown'}</Text>
                <Text style={styles.listRowSub}>{e.clinicians?.email}</Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Unenroll', `Remove ${e.clinicians?.full_name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => unenrollMutation.mutate(e.clinician_id) }])}>
                <X size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 8 }]}>All Clinicians</Text>
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textTertiary} />
            <TextInput style={styles.searchInput} placeholder="Search clinicians..." value={searchText} onChangeText={setSearchText} placeholderTextColor={Colors.textTertiary} />
          </View>

          {filteredClinicians.map((c: any) => {
            const isEnrolled = enrolledIds.has(c.id);
            return (
              <View key={c.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle}>{c.full_name}</Text>
                  <Text style={styles.listRowSub}>{c.email}</Text>
                </View>
                {isEnrolled ? (
                  <View style={[styles.statusBadge, { backgroundColor: Colors.successLight }]}>
                    <Text style={[styles.statusText, { color: Colors.success }]}>Enrolled</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.btnSmall} onPress={() => enrollMutation.mutate(c.id)} disabled={enrollMutation.isPending}>
                    <Plus size={12} color={Colors.white} />
                    <Text style={styles.btnSmallText}>Enroll</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function AssignSection() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-training-courses-list'],
    queryFn: async () => {
      const { data } = await supabase.from('training_courses').select('id, title, title_zh').eq('is_active', true).order('title');
      return data || [];
    },
  });

  const materialsQuery = useQuery({
    queryKey: ['admin-assign-materials', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data } = await supabase.from('training_materials').select('*').eq('course_id', selectedCourseId).eq('is_active', true).order('sort_order');
      return data || [];
    },
    enabled: !!selectedCourseId,
  });

  const enrolledQuery = useQuery({
    queryKey: ['admin-assign-enrolled', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data } = await supabase.from('training_course_enrollments').select('clinician_id, clinicians(id, full_name, email)').eq('course_id', selectedCourseId);
      return data || [];
    },
    enabled: !!selectedCourseId,
  });

  const toggleMaterial = useCallback((id: string) => {
    setSelectedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourseId) throw new Error('Select a course');
      if (selectedMaterials.size === 0) throw new Error('Select at least one material');
      const enrolled = enrolledQuery.data || [];
      if (enrolled.length === 0) throw new Error('No enrolled clinicians');

      const rows: any[] = [];
      enrolled.forEach((e: any) => {
        selectedMaterials.forEach((matId) => {
          rows.push({
            material_id: matId,
            clinician_id: e.clinician_id,
            start_date: startDate,
            end_date: endDate,
            is_revoked: false,
          });
        });
      });

      const { error } = await supabase.from('training_material_assignments').upsert(rows, { onConflict: 'material_id,clinician_id' });
      if (error) throw error;
      Alert.alert('Success', `Assigned ${selectedMaterials.size} materials to ${enrolled.length} clinicians.`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignment-list'] });
      setSelectedMaterials(new Set());
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return 'Select Course...';
    return coursesQuery.data?.find((c: any) => c.id === selectedCourseId)?.title || 'Select Course...';
  }, [selectedCourseId, coursesQuery.data]);

  return (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      <TouchableOpacity style={styles.dropdown} onPress={() => setShowCourseDropdown(!showCourseDropdown)}>
        <Text style={styles.dropdownText}>{selectedCourseName}</Text>
        <ChevronDown size={16} color={Colors.textSecondary} />
      </TouchableOpacity>

      {showCourseDropdown && (
        <View style={styles.dropdownList}>
          {coursesQuery.data?.map((c: any) => (
            <TouchableOpacity key={c.id} style={[styles.dropdownItem, selectedCourseId === c.id && { backgroundColor: Colors.accentLight }]} onPress={() => { setSelectedCourseId(c.id); setShowCourseDropdown(false); setSelectedMaterials(new Set()); }}>
              <Text style={styles.dropdownItemText}>{c.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedCourseId && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>Select Materials</Text>
          {materialsQuery.data?.map((mat: any) => (
            <TouchableOpacity key={mat.id} style={styles.checkRow} onPress={() => toggleMaterial(mat.id)}>
              {selectedMaterials.has(mat.id) ? <CheckSquare size={20} color={Colors.accent} /> : <Square size={20} color={Colors.textTertiary} />}
              <Text style={styles.checkRowText}>{mat.title}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
            Enrolled Clinicians ({enrolledQuery.data?.length ?? 0})
          </Text>
          {enrolledQuery.data?.map((e: any) => (
            <Text key={e.clinician_id} style={styles.listRowSub}>{e.clinicians?.full_name} — {e.clinicians?.email}</Text>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>Access Dates</Text>
          <FormField label="Start Date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          <FormField label="End Date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />

          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 20, alignSelf: 'flex-start' }]}
            onPress={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? <ActivityIndicator size="small" color={Colors.white} /> : <Check size={14} color={Colors.white} />}
            <Text style={styles.btnPrimaryText}>Assign Selected</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function AssignmentListSection() {
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery({
    queryKey: ['admin-assignment-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_material_assignments')
        .select('*, training_materials(id, title, course_id), clinicians(id, full_name, email, expires_at)')
        .order('assigned_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_material_assignments').update({ is_revoked: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-assignment-list'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const extendMutation = useMutation({
    mutationFn: async ({ id, newEnd }: { id: string; newEnd: string }) => {
      const { error } = await supabase.from('training_material_assignments').update({ end_date: newEnd }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignment-list'] });
      Alert.alert('Success', 'Expiry extended.');
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const handleExtend = useCallback((a: any) => {
    const currentEnd = a.end_date || new Date().toISOString().split('T')[0];
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);
    const newEndStr = newEnd.toISOString().split('T')[0];
    Alert.alert('Extend Expiry', `Extend to ${newEndStr}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Extend', onPress: () => extendMutation.mutate({ id: a.id, newEnd: newEndStr }) },
    ]);
  }, [extendMutation]);

  const getStatus = useCallback((a: any): { label: string; color: string; bg: string } => {
    if (a.is_revoked) return { label: 'Revoked', color: Colors.danger, bg: Colors.dangerLight };
    const now = new Date().toISOString().split('T')[0];
    if (a.start_date && a.start_date > now) return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight };
    if (a.end_date && a.end_date < now) return { label: 'Expired', color: Colors.danger, bg: Colors.dangerLight };
    return { label: 'Active', color: Colors.success, bg: Colors.successLight };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollPad} refreshControl={<RefreshControl refreshing={assignmentsQuery.isFetching} onRefresh={() => assignmentsQuery.refetch()} tintColor={Colors.accent} />}>
      <Text style={styles.sectionTitle}>All Assignments ({assignmentsQuery.data?.length ?? 0})</Text>

      {assignmentsQuery.isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={Colors.accent} />}

      {assignmentsQuery.data?.map((a: any) => {
        const status = getStatus(a);
        return (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{a.training_materials?.title || 'Unknown Material'}</Text>
                <Text style={styles.cardSubtext}>{a.clinicians?.full_name || 'Unknown'} — {a.clinicians?.email || ''}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Views: {a.view_count || 0}</Text>
              {a.last_viewed_at ? <Text style={styles.metaText}>Last: {new Date(a.last_viewed_at).toLocaleDateString()}</Text> : null}
              {a.start_date ? <Text style={styles.metaText}>From: {a.start_date}</Text> : null}
              {a.end_date ? <Text style={styles.metaText}>To: {a.end_date}</Text> : null}
            </View>
            {!a.is_revoked && (
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleExtend(a)}>
                  <Clock size={14} color={Colors.info} />
                  <Text style={[styles.actionText, { color: Colors.info }]}>Extend</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Revoke', 'Revoke access?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(a.id) }])}>
                  <Ban size={14} color={Colors.danger} />
                  <Text style={[styles.actionText, { color: Colors.danger }]}>Revoke</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function AnalyticsTab() {
  const summaryQuery = useQuery({
    queryKey: ['admin-training-analytics'],
    queryFn: async () => {
      const { count: courseCount } = await supabase.from('training_courses').select('id', { count: 'exact', head: true }).eq('is_active', true);
      const { count: materialCount } = await supabase.from('training_materials').select('id', { count: 'exact', head: true }).eq('is_active', true);
      const { count: enrollmentCount } = await supabase.from('training_course_enrollments').select('id', { count: 'exact', head: true });
      const { count: assignmentCount } = await supabase.from('training_material_assignments').select('id', { count: 'exact', head: true }).eq('is_revoked', false);

      const { data: viewLogs } = await supabase.from('training_material_view_logs').select('id, clinician_id, material_id, viewed_at').order('viewed_at', { ascending: false }).limit(500);

      const { data: assignments } = await supabase
        .from('training_material_assignments')
        .select('*, training_materials(id, title, course_id), clinicians(id, full_name, email, expires_at)')
        .eq('is_revoked', false)
        .order('last_viewed_at', { ascending: false });

      const materialStats: Record<string, { title: string; views: number; uniqueViewers: Set<string>; lastActive: string | null }> = {};
      (viewLogs || []).forEach((log: any) => {
        if (!materialStats[log.material_id]) {
          materialStats[log.material_id] = { title: '', views: 0, uniqueViewers: new Set(), lastActive: null };
        }
        materialStats[log.material_id].views++;
        materialStats[log.material_id].uniqueViewers.add(log.clinician_id);
        if (!materialStats[log.material_id].lastActive || log.viewed_at > materialStats[log.material_id].lastActive!) {
          materialStats[log.material_id].lastActive = log.viewed_at;
        }
      });

      (assignments || []).forEach((a: any) => {
        if (a.training_materials?.id && materialStats[a.training_materials.id]) {
          materialStats[a.training_materials.id].title = a.training_materials.title;
        } else if (a.training_materials?.id) {
          materialStats[a.training_materials.id] = { title: a.training_materials.title, views: 0, uniqueViewers: new Set(), lastActive: null };
        }
      });

      const clinicianStats: Record<string, { name: string; email: string; totalViews: number; lastActive: string | null; expiresAt: string | null }> = {};
      (assignments || []).forEach((a: any) => {
        const cid = a.clinician_id;
        if (!clinicianStats[cid]) {
          clinicianStats[cid] = {
            name: a.clinicians?.full_name || 'Unknown',
            email: a.clinicians?.email || '',
            totalViews: 0,
            lastActive: null,
            expiresAt: a.clinicians?.expires_at || null,
          };
        }
        clinicianStats[cid].totalViews += a.view_count || 0;
        if (a.last_viewed_at && (!clinicianStats[cid].lastActive || a.last_viewed_at > clinicianStats[cid].lastActive!)) {
          clinicianStats[cid].lastActive = a.last_viewed_at;
        }
      });

      return {
        courseCount: courseCount ?? 0,
        materialCount: materialCount ?? 0,
        enrollmentCount: enrollmentCount ?? 0,
        assignmentCount: assignmentCount ?? 0,
        totalViews: (viewLogs || []).length,
        materialStats: Object.entries(materialStats).map(([id, s]) => ({ id, title: s.title || id, views: s.views, uniqueViewers: s.uniqueViewers.size, lastActive: s.lastActive })),
        clinicianStats: Object.values(clinicianStats),
      };
    },
  });

  const d = summaryQuery.data;

  return (
    <ScrollView contentContainerStyle={styles.scrollPad} refreshControl={<RefreshControl refreshing={summaryQuery.isFetching} onRefresh={() => summaryQuery.refetch()} tintColor={Colors.accent} />}>
      {summaryQuery.isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={Colors.accent} />}

      {d && (
        <>
          <View style={styles.statsGrid}>
            <StatCard label="Courses" value={d.courseCount} color={Colors.info} />
            <StatCard label="Materials" value={d.materialCount} color={Colors.accent} />
            <StatCard label="Enrollments" value={d.enrollmentCount} color={Colors.success} />
            <StatCard label="Assignments" value={d.assignmentCount} color="#7C5CFC" />
            <StatCard label="Total Views" value={d.totalViews} color={Colors.warning} />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>Per-Material Stats</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: 180 }]}>Material</Text>
                <Text style={[styles.tableHeaderCell, { width: 70 }]}>Views</Text>
                <Text style={[styles.tableHeaderCell, { width: 90 }]}>Unique</Text>
                <Text style={[styles.tableHeaderCell, { width: 110 }]}>Last Active</Text>
              </View>
              {d.materialStats.map((m, i) => (
                <View key={`mat-${i}`} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: Colors.background }]}>
                  <Text style={[styles.tableCell, { width: 180 }]} numberOfLines={1}>{m.title}</Text>
                  <Text style={[styles.tableCell, { width: 70 }]}>{m.views}</Text>
                  <Text style={[styles.tableCell, { width: 90 }]}>{m.uniqueViewers}</Text>
                  <Text style={[styles.tableCell, { width: 110 }]}>{m.lastActive ? new Date(m.lastActive).toLocaleDateString() : '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>Per-Clinician Stats</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: 150 }]}>Clinician</Text>
                <Text style={[styles.tableHeaderCell, { width: 70 }]}>Views</Text>
                <Text style={[styles.tableHeaderCell, { width: 110 }]}>Last Active</Text>
                <Text style={[styles.tableHeaderCell, { width: 100 }]}>Expires</Text>
              </View>
              {d.clinicianStats.map((c, i) => (
                <View key={`cli-${i}`} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: Colors.background }]}>
                  <Text style={[styles.tableCell, { width: 150 }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[styles.tableCell, { width: 70 }]}>{c.totalViews}</Text>
                  <Text style={[styles.tableCell, { width: 110 }]}>{c.lastActive ? new Date(c.lastActive).toLocaleDateString() : '—'}</Text>
                  <Text style={[styles.tableCell, { width: 100 }]}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: '#2D6A4F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  tabBar: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500' as const,
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  tabContent: {
    flex: 1,
  },
  scrollPad: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  btnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  btnSmallText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    flex: 1,
    maxWidth: 220,
  },
  dropdownText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.text,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  listRowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginBottom: 4,
  },
  checkRowText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2D6A4F',
  },
  subTabText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  subTabTextActive: {
    color: '#2D6A4F',
    fontWeight: '600' as const,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    width: '47%' as any,
    borderLeftWidth: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#2D6A4F',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableCell: {
    fontSize: 12,
    color: Colors.text,
    paddingHorizontal: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentLight,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
});
