import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, ChevronDown, ChevronRight, Lock, Clock, BookOpen, Shield } from 'lucide-react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface TrainingCourse {
  id: string;
  title: string;
  title_zh?: string;
  description?: string;
  course_date?: string;
  instructor_name?: string;
  instructor_name_zh?: string;
}

interface TrainingMaterial {
  id: string;
  title: string;
  title_zh?: string;
  description?: string;
  storage_path: string;
  file_size_bytes?: number;
  page_count?: number;
  sort_order?: number;
  course_id?: string;
}

interface MaterialAssignment {
  id: string;
  material_id: string;
  clinician_id: string;
  assigned_at: string;
  access_start_date?: string;
  access_end_date?: string;
  is_revoked: boolean;
  view_count?: number;
  last_viewed_at?: string;
  training_materials: TrainingMaterial;
}

interface CourseEnrollment {
  course_id: string;
  training_courses: TrainingCourse;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type AccessStatus = 'active' | 'expired' | 'not_yet';

function getAccessStatus(assignment: MaterialAssignment): { status: AccessStatus; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (assignment.access_end_date) {
    const end = new Date(assignment.access_end_date);
    if (end < today) {
      return { status: 'expired', label: 'Expired 已過期' };
    }
  }

  if (assignment.access_start_date) {
    const start = new Date(assignment.access_start_date);
    if (start > today) {
      return { status: 'not_yet', label: `Available from ${formatDate(assignment.access_start_date)}` };
    }
  }

  return { status: 'active', label: 'Open 開啟' };
}

export default function LibraryScreen() {
  const { clinician, isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clinicianId = isAdmin ? null : clinician?.id;
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        ScreenCapture.preventScreenCaptureAsync('training-library');
        const sub = ScreenCapture.addScreenshotListener(() => {
          Alert.alert(
            'Screenshot Detected 偵測到截圖',
            'Screenshots of training materials are not permitted.\n培訓資料不允許截圖。'
          );
        });
        return () => {
          ScreenCapture.allowScreenCaptureAsync('training-library');
          sub.remove();
        };
      }
    }, [])
  );

  const coursesQuery = useQuery({
    queryKey: ['my-courses', isAdmin, clinicianId],
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from('training_courses')
          .select('*')
          .eq('is_active', true)
          .order('course_date', { ascending: false });
        if (error) {
          console.log('Error fetching all courses:', error);
          return [];
        }
        return (data || []) as TrainingCourse[];
      }
      if (!clinicianId) return [];
      const { data, error } = await supabase
        .from('training_course_enrollments')
        .select('course_id, training_courses(id, title, title_zh, description, course_date, instructor_name, instructor_name_zh)')
        .eq('clinician_id', clinicianId)
        .order('enrolled_at', { ascending: false });
      if (error) {
        console.log('Error fetching enrollments:', error);
        return [];
      }
      return ((data || []) as unknown as CourseEnrollment[]).map(e => e.training_courses).filter(Boolean) as TrainingCourse[];
    },
  });

  const materialsQuery = useQuery({
    queryKey: ['my-materials', isAdmin, clinicianId],
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from('training_materials')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        if (error) {
          console.log('Error fetching all materials:', error);
          return [];
        }
        return (data || []).map(m => ({
          id: `admin-${m.id}`,
          material_id: m.id,
          clinician_id: '',
          assigned_at: '',
          is_revoked: false,
          training_materials: m,
        })) as MaterialAssignment[];
      }
      if (!clinicianId) return [];
      const { data, error } = await supabase
        .from('training_material_assignments')
        .select('*, training_materials(id, title, title_zh, description, storage_path, file_size_bytes, page_count, sort_order, course_id)')
        .eq('clinician_id', clinicianId)
        .eq('is_revoked', false)
        .order('assigned_at', { ascending: false });
      if (error) {
        console.log('Error fetching assignments:', error);
        return [];
      }
      return (data || []) as unknown as MaterialAssignment[];
    },
  });

  const logViewMutation = useMutation({
    mutationFn: async ({ assignmentId, materialId }: { assignmentId: string; materialId: string }) => {
      const currentAssignment = materialsQuery.data?.find(a => a.id === assignmentId);
      await supabase
        .from('training_material_assignments')
        .update({
          view_count: (currentAssignment?.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      await supabase
        .from('training_material_view_logs')
        .insert({
          material_id: materialId,
          clinician_id: clinicianId,
          viewed_at: new Date().toISOString(),
        });
    },
  });

  const materialsByCourse = useMemo(() => {
    const assignments = materialsQuery.data || [];
    const courses = coursesQuery.data || [];
    const courseMap = new Map<string, { course: TrainingCourse; materials: MaterialAssignment[] }>();

    for (const course of courses) {
      if (course) {
        courseMap.set(course.id, {
          course,
          materials: [],
        });
      }
    }

    const ungrouped: MaterialAssignment[] = [];

    for (const assignment of assignments) {
      const mat = assignment.training_materials;
      if (!mat) continue;
      if (mat.course_id && courseMap.has(mat.course_id)) {
        courseMap.get(mat.course_id)!.materials.push(assignment);
      } else {
        ungrouped.push(assignment);
      }
    }

    for (const [, value] of courseMap) {
      value.materials.sort((a, b) => (a.training_materials.sort_order || 0) - (b.training_materials.sort_order || 0));
    }

    return { courses: Array.from(courseMap.values()), ungrouped };
  }, [materialsQuery.data, coursesQuery.data]);

  const toggleCourse = useCallback((courseId: string) => {
    setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  }, []);

  const handleOpenMaterial = useCallback(async (assignment: MaterialAssignment) => {
    const mat = assignment.training_materials;

    if (!isAdmin) {
      const { status } = getAccessStatus(assignment);

      if (status === 'expired') {
        Alert.alert(
          'Access Expired 存取已過期',
          'Your access to this material has expired.\n您對此資料的存取權限已過期。'
        );
        return;
      }

      if (status === 'not_yet') {
        Alert.alert(
          'Not Yet Available 尚未開放',
          `This material will be available from ${formatDate(assignment.access_start_date)}.\n此資料將於 ${formatDate(assignment.access_start_date)} 開放。`
        );
        return;
      }

      try {
        const { data: verifyData } = await supabase
          .from('training_material_assignments')
          .select('id, is_revoked')
          .eq('id', assignment.id)
          .single();

        if (!verifyData || verifyData.is_revoked) {
          Alert.alert('Access Revoked 存取已撤銷', 'Your access to this material has been revoked.\n您對此資料的存取權限已被撤銷。');
          return;
        }
      } catch (e) {
        console.log('Error verifying access:', e);
      }
    }

    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from('training-materials')
        .createSignedUrl(mat.storage_path, 900);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.log('Error creating signed URL:', signedUrlError);
        Alert.alert('Error 錯誤', 'Could not load the document. Please try again.\n無法載入文件，請重試。');
        return;
      }

      if (!isAdmin) {
        logViewMutation.mutate({ assignmentId: assignment.id, materialId: mat.id });
      }

      router.push({
        pathname: '/pdf-viewer',
        params: {
          url: signedUrlData.signedUrl,
          title: mat.title,
          materialId: mat.id,
          assignmentId: assignment.id,
        },
      });
    } catch (e) {
      console.log('Error opening material:', e);
      Alert.alert('Error 錯誤', 'Something went wrong. Please try again.\n發生錯誤，請重試。');
    }
  }, [isAdmin, clinicianId, logViewMutation, router]);

  const isLoading = coursesQuery.isLoading || materialsQuery.isLoading;
  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-courses'] });
    queryClient.invalidateQueries({ queryKey: ['my-materials'] });
  }, [queryClient]);

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const hasCourses = materialsByCourse.courses.length > 0;
  const hasMaterials = materialsByCourse.courses.some(c => c.materials.length > 0) || materialsByCourse.ungrouped.length > 0;
  const hasContent = hasCourses || hasMaterials;

  if (!hasContent) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <BookOpen size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Materials 尚無資料</Text>
        <Text style={styles.emptySubtitle}>
          No training materials assigned.{'\n'}尚未獲分配培訓資料。
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {materialsByCourse.courses.map(({ course, materials }) => {
        if (materials.length === 0) return null;
        const isExpanded = expandedCourses[course.id] !== false;
        return (
          <View key={course.id} style={styles.courseCard}>
            <TouchableOpacity
              style={styles.courseHeader}
              onPress={() => toggleCourse(course.id)}
              activeOpacity={0.7}
            >
              <View style={styles.courseHeaderLeft}>
                {isExpanded
                  ? <ChevronDown size={20} color={Colors.text} />
                  : <ChevronRight size={20} color={Colors.text} />
                }
                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  {course.title_zh ? (
                    <Text style={styles.courseTitleZh} numberOfLines={1}>
                      {course.title_zh}
                    </Text>
                  ) : null}
                  <View style={styles.courseMeta}>
                    {course.course_date ? (
                      <Text style={styles.courseMetaText}>{formatDate(course.course_date)}</Text>
                    ) : null}
                    {course.instructor_name ? (
                      <Text style={styles.courseMetaText}>
                        {course.instructor_name_zh || course.instructor_name}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={styles.materialCountBadge}>
                <Text style={styles.materialCountText}>{materials.length}</Text>
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.materialsList}>
                {materials.map(renderMaterialRow)}
              </View>
            )}
          </View>
        );
      })}

      {materialsByCourse.ungrouped.length > 0 && (
        <View style={styles.courseCard}>
          <View style={styles.courseHeader}>
            <View style={styles.courseHeaderLeft}>
              <FileText size={20} color={Colors.text} />
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>Other Materials 其他資料</Text>
              </View>
            </View>
            <View style={styles.materialCountBadge}>
              <Text style={styles.materialCountText}>{materialsByCourse.ungrouped.length}</Text>
            </View>
          </View>
          <View style={styles.materialsList}>
            {materialsByCourse.ungrouped.map(renderMaterialRow)}
          </View>
        </View>
      )}
    </ScrollView>
  );

  function renderMaterialRow(assignment: MaterialAssignment) {
    const mat = assignment.training_materials;
    if (!mat) return null;

    const accessInfo = isAdmin
      ? { status: 'active' as AccessStatus, label: 'Open 開啟' }
      : getAccessStatus(assignment);
    const { status, label } = accessInfo;
    const isExpired = status === 'expired';
    const isNotYet = status === 'not_yet';

    return (
      <TouchableOpacity
        key={assignment.id}
        style={[styles.materialRow, isExpired && styles.materialRowExpired]}
        onPress={() => handleOpenMaterial(assignment)}
        activeOpacity={0.65}
        disabled={isNotYet}
      >
        <View style={[styles.materialIcon, isExpired && styles.materialIconExpired]}>
          {isExpired ? (
            <Lock size={18} color={Colors.danger} />
          ) : isNotYet ? (
            <Clock size={18} color={Colors.textTertiary} />
          ) : (
            <FileText size={18} color={Colors.accent} />
          )}
        </View>

        <View style={styles.materialInfo}>
          <Text style={[styles.materialTitle, isExpired && styles.materialTitleExpired]} numberOfLines={1}>
            {mat.title}
          </Text>
          {mat.title_zh ? (
            <Text style={[styles.materialTitleZh, isExpired && styles.materialTitleExpired]} numberOfLines={1}>
              {mat.title_zh}
            </Text>
          ) : null}
          <View style={styles.materialMeta}>
            {mat.page_count ? (
              <Text style={styles.materialMetaText}>{mat.page_count} pages</Text>
            ) : null}
            {mat.file_size_bytes ? (
              <Text style={styles.materialMetaText}>{formatFileSize(mat.file_size_bytes)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.materialAction}>
          {status === 'active' && (
            <View style={styles.openButton}>
              <Text style={styles.openButtonText}>Open{'\n'}開啟</Text>
            </View>
          )}
          {status === 'expired' && (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredBadgeText}>Expired{'\n'}已過期</Text>
            </View>
          )}
          {status === 'not_yet' && (
            <Text style={styles.notYetText}>{label}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  courseCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  courseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  courseTitleZh: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  courseMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  courseMetaText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  materialCountBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
  },
  materialCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  materialsList: {
    paddingBottom: 4,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  materialRowExpired: {
    opacity: 0.55,
  },
  materialIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialIconExpired: {
    backgroundColor: Colors.dangerLight,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  materialTitleZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  materialTitleExpired: {
    color: Colors.textTertiary,
  },
  materialMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  materialMetaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  materialAction: {
    alignItems: 'flex-end',
    minWidth: 64,
  },
  openButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 16,
  },
  expiredBadge: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  expiredBadgeText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 15,
  },
  notYetText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right',
    maxWidth: 100,
  },
});
