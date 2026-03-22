import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Activity,
  Clock,
  CalendarDays,
  BarChart3,
  FlaskConical,
  Video,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

const RESEARCH_GREEN = '#1B6B4A';
const RESEARCH_GREEN_LIGHT = '#E8F5EE';

interface PatientData {
  id: string;
  patient_name: string;
  access_code: string;
  is_research_participant?: boolean;
  research_cohort?: string;
  research_participant_code?: string;
  research_consent_date?: string;
  research_baseline_date?: string;
  research_endpoint_date?: string;
}

interface SessionLog {
  id: string;
  session_start?: string;
  session_date?: string;
  exercise_title_en?: string;
  prescribed_sets?: number;
  prescribed_reps?: number;
  completed_sets?: number;
  completed_reps?: number;
  completion_rate?: number;
  duration_seconds?: number;
  self_rating?: number;
  mirror_mode?: boolean;
  video_recorded?: boolean;
}

interface AssessmentRow {
  id: string;
  assessment_name?: string;
  timepoint?: string;
  total_score?: number;
  administered_date?: string;
}

interface ProgramRow {
  id: string;
  name?: string;
  schedule_type?: string;
  issue_date?: string;
  expiry_date?: string;
  is_active?: boolean;
  exercises?: { id: string }[];
}

function getCohortLabel(cohort?: string): string {
  switch (cohort) {
    case 'stroke': return 'Stroke 中風';
    case 'npc_active': return 'NPC Active 鼻咽癌治療中';
    case 'npc_post': return 'NPC Post 鼻咽癌治療後';
    default: return cohort || '';
  }
}

function getTimepointColor(tp?: string): string {
  switch (tp) {
    case 'baseline': return Colors.success;
    case 'week4': return Colors.warning;
    case 'endpoint': return Colors.danger;
    default: return Colors.textTertiary;
  }
}

export default function PatientDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const patientQuery = useQuery({
    queryKey: ['patient-dashboard', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, access_code, is_research_participant, research_cohort, research_participant_code, research_consent_date, research_baseline_date, research_endpoint_date')
          .eq('id', id)
          .single();
        if (error) throw error;
        return data as PatientData;
      } catch (e) {
        console.log('Patient dashboard fetch error:', e);
        return null;
      }
    },
    enabled: !!id,
  });

  const sessionsQuery = useQuery({
    queryKey: ['patient-sessions', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('research_session_logs')
          .select('*')
          .eq('patient_id', id)
          .order('session_start', { ascending: false })
          .limit(10);
        if (error) throw error;
        return (data || []) as SessionLog[];
      } catch (e) {
        console.log('Sessions fetch error:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const allSessionsStatsQuery = useQuery({
    queryKey: ['patient-sessions-stats', id],
    queryFn: async () => {
      try {
        const { data, error, count } = await supabase
          .from('research_session_logs')
          .select('completion_rate, duration_seconds, session_date', { count: 'exact' })
          .eq('patient_id', id);
        if (error) throw error;
        const rows = data || [];
        const totalCount = count || rows.length;
        const avgCompletion = rows.length > 0
          ? rows.reduce((s, r) => s + (r.completion_rate || 0), 0) / rows.length
          : 0;
        const totalDuration = rows.reduce((s, r) => s + (r.duration_seconds || 0), 0);
        const uniqueDays = new Set(rows.map(r => r.session_date).filter(Boolean)).size;
        return { totalCount, avgCompletion, totalDuration, uniqueDays };
      } catch (e) {
        console.log('Stats fetch error:', e);
        return { totalCount: 0, avgCompletion: 0, totalDuration: 0, uniqueDays: 0 };
      }
    },
    enabled: !!id,
  });

  const programsQuery = useQuery({
    queryKey: ['patient-programs', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_programs')
          .select('id, name, schedule_type, issue_date, expiry_date, is_active, exercises(id)')
          .eq('patient_id', id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as ProgramRow[];
      } catch (e) {
        console.log('Programs fetch error:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const assessmentsQuery = useQuery({
    queryKey: ['patient-assessments', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('research_assessments')
          .select('id, assessment_name, timepoint, total_score, administered_date')
          .eq('patient_id', id)
          .order('administered_date', { ascending: false });
        if (error) throw error;
        return (data || []) as AssessmentRow[];
      } catch (e) {
        console.log('Assessments fetch error:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const patient = patientQuery.data;
  const stats = allSessionsStatsQuery.data;
  const sessions = sessionsQuery.data || [];
  const programs = programsQuery.data || [];
  const assessments = assessmentsQuery.data || [];

  const durationFormatted = useMemo(() => {
    if (!stats) return '0m';
    const totalMin = Math.round(stats.totalDuration / 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }, [stats]);

  const isLoading = patientQuery.isLoading;

  const handleRefresh = () => {
    void patientQuery.refetch();
    void sessionsQuery.refetch();
    void allSessionsStatsQuery.refetch();
    void programsQuery.refetch();
    void assessmentsQuery.refetch();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={RESEARCH_GREEN} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Patient not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{patient.patient_name}</Text>
          <View style={styles.headerMetaRow}>
            <Text style={styles.headerCode}>{patient.access_code}</Text>
            {patient.is_research_participant && (
              <View style={styles.researchBadge}>
                <FlaskConical size={10} color={Colors.white} />
                <Text style={styles.researchBadgeText}>Research</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={patientQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={RESEARCH_GREEN}
          />
        }
      >
        <View style={styles.statsGrid}>
          <StatCard icon={<Activity size={16} color={RESEARCH_GREEN} />} value={String(stats?.totalCount || 0)} label="Sessions 訓練" />
          <StatCard icon={<BarChart3 size={16} color={RESEARCH_GREEN} />} value={`${Math.round(stats?.avgCompletion || 0)}%`} label="Avg Rate 平均率" />
          <StatCard icon={<Clock size={16} color={RESEARCH_GREEN} />} value={durationFormatted} label="Duration 時長" />
          <StatCard icon={<CalendarDays size={16} color={RESEARCH_GREEN} />} value={String(stats?.uniqueDays || 0)} label="Days 天數" />
        </View>

        {programs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Programs 訓練計劃</Text>
            {programs.map(p => {
              const isExpired = p.expiry_date ? new Date(p.expiry_date) < new Date() : false;
              const exCount = Array.isArray(p.exercises) ? p.exercises.length : 0;
              return (
                <View key={p.id} style={styles.programCard}>
                  <View style={styles.programHeader}>
                    <Text style={styles.programName} numberOfLines={1}>{p.name || 'Unnamed'}</Text>
                    <View style={[styles.programStatusBadge, {
                      backgroundColor: p.is_active && !isExpired ? '#E8F5EE' : Colors.frozenLight,
                    }]}>
                      <Text style={[styles.programStatusText, {
                        color: p.is_active && !isExpired ? RESEARCH_GREEN : Colors.frozen,
                      }]}>
                        {isExpired ? 'Expired' : p.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.programMeta}>
                    <Text style={styles.programMetaText}>{p.schedule_type || 'daily'}</Text>
                    <Text style={styles.programMetaText}>{exCount} exercises</Text>
                    {p.issue_date && <Text style={styles.programMetaText}>{p.issue_date} → {p.expiry_date || '—'}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sessions 最近訓練</Text>
            {sessions.map(s => {
              const date = s.session_start ? new Date(s.session_start).toLocaleDateString() : s.session_date || '—';
              const pStr = `${s.prescribed_sets || 0}×${s.prescribed_reps || 0}`;
              const cStr = `${s.completed_sets || 0}×${s.completed_reps || 0}`;
              const durMin = s.duration_seconds ? Math.round(s.duration_seconds / 60) : 0;
              const rate = s.completion_rate ? Math.round(s.completion_rate) : 0;
              return (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <Text style={styles.sessionDate}>{date}</Text>
                    <Text style={[styles.sessionRate, { color: rate >= 80 ? Colors.success : rate >= 50 ? Colors.warning : Colors.danger }]}>
                      {rate}%
                    </Text>
                  </View>
                  <Text style={styles.sessionExercise} numberOfLines={1}>{s.exercise_title_en || 'Unknown'}</Text>
                  <View style={styles.sessionMeta}>
                    <Text style={styles.sessionMetaText}>{pStr} → {cStr}</Text>
                    {durMin > 0 && <Text style={styles.sessionMetaText}>{durMin}m</Text>}
                    {s.self_rating != null && <Text style={styles.sessionMetaText}>⭐ {s.self_rating}/10</Text>}
                    {s.video_recorded && (
                      <View style={styles.videoBadge}>
                        <Video size={10} color={Colors.info} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {assessments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assessments 評估</Text>
            {assessments.map(a => (
              <View key={a.id} style={styles.assessmentCard}>
                <View style={styles.assessmentRow}>
                  <View style={[styles.timepointDot, { backgroundColor: getTimepointColor(a.timepoint) }]} />
                  <Text style={styles.assessmentName}>{a.assessment_name || '—'}</Text>
                  <Text style={styles.assessmentScore}>{a.total_score ?? '—'}</Text>
                </View>
                <View style={styles.assessmentMeta}>
                  <Text style={styles.assessmentTimepoint}>{a.timepoint || '—'}</Text>
                  <Text style={styles.assessmentDate}>{a.administered_date || '—'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {patient.is_research_participant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Research Info 研究資料</Text>
            <View style={styles.researchInfoCard}>
              {patient.research_cohort && (
                <View style={styles.researchInfoRow}>
                  <Text style={styles.researchLabel}>Cohort 組別</Text>
                  <View style={styles.cohortBadge}>
                    <Text style={styles.cohortBadgeText}>{getCohortLabel(patient.research_cohort)}</Text>
                  </View>
                </View>
              )}
              {patient.research_participant_code && (
                <View style={styles.researchInfoRow}>
                  <Text style={styles.researchLabel}>Code 代碼</Text>
                  <Text style={styles.researchValue}>{patient.research_participant_code}</Text>
                </View>
              )}
              {patient.research_consent_date && (
                <View style={styles.researchInfoRow}>
                  <Text style={styles.researchLabel}>Consent 同意日期</Text>
                  <Text style={styles.researchValue}>{patient.research_consent_date}</Text>
                </View>
              )}
              {patient.research_baseline_date && (
                <View style={styles.researchInfoRow}>
                  <Text style={styles.researchLabel}>Baseline 基線</Text>
                  <Text style={styles.researchValue}>{patient.research_baseline_date}</Text>
                </View>
              )}
              {patient.research_endpoint_date && (
                <View style={styles.researchInfoRow}>
                  <Text style={styles.researchLabel}>Endpoint 終點</Text>
                  <Text style={styles.researchValue}>{patient.research_endpoint_date}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0ED' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F0ED', gap: 12 },
  errorText: { fontSize: 15, color: Colors.danger },
  backButton: { backgroundColor: RESEARCH_GREEN, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backButtonText: { color: Colors.white, fontWeight: '600' as const },
  headerBar: {
    backgroundColor: RESEARCH_GREEN, paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerBackBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  headerCode: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  researchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  researchBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '48%' as unknown as number, backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800' as const, color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' as const },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 10 },
  programCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  programHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  programName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1, marginRight: 8 },
  programStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  programStatusText: { fontSize: 11, fontWeight: '600' as const },
  programMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  programMetaText: { fontSize: 12, color: Colors.textSecondary },
  sessionCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary },
  sessionRate: { fontSize: 14, fontWeight: '800' as const },
  sessionExercise: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, marginTop: 4 },
  sessionMeta: { flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' },
  sessionMetaText: { fontSize: 11, color: Colors.textTertiary },
  videoBadge: { backgroundColor: Colors.infoLight, borderRadius: 4, padding: 3 },
  assessmentCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  assessmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timepointDot: { width: 10, height: 10, borderRadius: 5 },
  assessmentName: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  assessmentScore: { fontSize: 16, fontWeight: '800' as const, color: RESEARCH_GREEN },
  assessmentMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  assessmentTimepoint: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const },
  assessmentDate: { fontSize: 12, color: Colors.textTertiary },
  researchInfoCard: {
    backgroundColor: RESEARCH_GREEN_LIGHT, borderRadius: 14, padding: 16, gap: 10,
  },
  researchInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  researchLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  researchValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  cohortBadge: { backgroundColor: RESEARCH_GREEN, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  cohortBadgeText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
});
