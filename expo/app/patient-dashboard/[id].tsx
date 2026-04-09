import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  TextInput,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Activity,
  Clock,
  Star,
  Flame,
  TrendingUp,
  BarChart3,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  ClipboardList,
  Dumbbell,
  Brain,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

interface ExerciseLog {
  id: string;
  patient_id: string;
  exercise_id?: string;
  completed_at?: string;
  self_rating?: number;
  stars_earned?: number;
  exercise_title?: string;
  title_en?: string;
}

interface AppSession {
  id: string;
  patient_id: string;
  opened_at?: string;
  closed_at?: string;
  duration_seconds?: number;
}

interface QuestionnaireResponse {
  id: string;
  patient_id?: string;
  created_at?: string;
  total_score?: number;
  questionnaire_templates?: { name?: string } | null;
}

interface PatientInfo {
  id: string;
  patient_name: string;
  access_code: string;
  diagnosis?: string;
}

const ACCENT = '#0F766E';
const PAGE_SIZE = 30;
const ACCENT_LIGHT = '#CCFBF1';
const ACCENT_BG = '#F0FDFA';
const WARM = '#E07A3A';
const CARD_BG = '#FFFFFF';
const PAGE_BG = '#F7F7F5';

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

function getPeriodDate(period: PeriodFilter): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  now.setHours(0, 0, 0, 0);
  return now;
}

function filterByDate<T>(items: T[], dateKey: string, period: PeriodFilter): T[] {
  const cutoff = getPeriodDate(period);
  if (!cutoff) return items;
  return items.filter(item => {
    const val = (item as Record<string, unknown>)[dateKey];
    if (!val || typeof val !== 'string') return false;
    return new Date(val) >= cutoff;
  });
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '—';
  }
}

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  } catch {
    return '—';
  }
}

export default function ClinicalDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [logsExpanded, setLogsExpanded] = useState<boolean>(false);
  const [logsSearch, setLogsSearch] = useState<string>('');
  const [logsDateFrom, setLogsDateFrom] = useState<string>('');
  const [logsDateTo, setLogsDateTo] = useState<string>('');
  const [logsDisplayCount, setLogsDisplayCount] = useState<number>(PAGE_SIZE);
  const [sessionsExpanded, setSessionsExpanded] = useState<boolean>(false);
  const [sessionsDisplayCount, setSessionsDisplayCount] = useState<number>(PAGE_SIZE);

  const patientQuery = useQuery({
    queryKey: ['clinical-dashboard-patient', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, access_code, diagnosis')
          .eq('id', id)
          .single();
        if (error) throw error;
        return data as PatientInfo;
      } catch (e) {
        console.log('Clinical dashboard patient fetch error:', e);
        return null;
      }
    },
    enabled: !!id,
  });

  const exerciseLogsQuery = useQuery({
    queryKey: ['clinical-exercise-logs', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('patient_id', id)
          .order('completed_at', { ascending: true });
        if (error) {
          console.log('Exercise logs fetch error:', error);
          return [];
        }
        return (data || []) as ExerciseLog[];
      } catch (e) {
        console.log('Exercise logs exception:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const appSessionsQuery = useQuery({
    queryKey: ['clinical-app-sessions', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_sessions')
          .select('*')
          .eq('patient_id', id)
          .order('opened_at', { ascending: true });
        if (error) {
          console.log('App sessions fetch error:', error);
          return [];
        }
        return (data || []) as AppSession[];
      } catch (e) {
        console.log('App sessions exception:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const questionnaireQuery = useQuery({
    queryKey: ['clinical-questionnaires', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('questionnaire_responses')
          .select('*, questionnaire_templates(name)')
          .eq('patient_id', id)
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Questionnaire responses fetch error:', error);
          return [];
        }
        return (data || []) as QuestionnaireResponse[];
      } catch (e) {
        console.log('Questionnaire responses exception:', e);
        return [];
      }
    },
    enabled: !!id,
  });

  const allLogs = exerciseLogsQuery.data || [];
  const allSessions = appSessionsQuery.data || [];
  const allQuestionnaires = questionnaireQuery.data || [];

  const filteredLogs = useMemo(() => filterByDate(allLogs, 'completed_at', period), [allLogs, period]);
  const filteredSessions = useMemo(() => filterByDate(allSessions, 'opened_at', period), [allSessions, period]);

  const stats = useMemo(() => {
    const sessionCount = filteredSessions.length;
    const totalSessionDuration = filteredSessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0);
    const avgSessionLength = sessionCount > 0 ? Math.round(totalSessionDuration / sessionCount) : 0;

    const logCount = filteredLogs.length;
    const daysWithLogs = new Set(
      filteredLogs
        .map(l => l.completed_at ? new Date(l.completed_at).toDateString() : null)
        .filter(Boolean)
    );
    const daysActive = daysWithLogs.size;
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : Math.max(1, daysActive);
    const exercisesPerDay = periodDays > 0 ? (logCount / periodDays) : 0;

    const ratingsArr = filteredLogs.filter(l => l.self_rating != null).map(l => l.self_rating!);
    const avgRating = ratingsArr.length > 0 ? ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length : 0;

    const totalStars = filteredLogs.reduce((s, l) => s + (l.stars_earned || 0), 0);

    const totalPracticeSeconds = filteredLogs.reduce((s, l) => {
      return s;
    }, 0);
    const totalPracticeMinutes = Math.round(totalSessionDuration / 60);

    let currentStreak = 0;
    let longestStreak = 0;
    if (daysWithLogs.size > 0) {
      const sortedDays = Array.from(daysWithLogs)
        .map(d => new Date(d!))
        .sort((a, b) => a.getTime() - b.getTime());

      let streak = 1;
      let maxStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const diff = (sortedDays[i].getTime() - sortedDays[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 1;
        }
      }
      longestStreak = maxStreak;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastDay = sortedDays[sortedDays.length - 1];
      lastDay.setHours(0, 0, 0, 0);
      const daysSinceLast = Math.round((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLast <= 1) {
        let cs = 1;
        for (let i = sortedDays.length - 2; i >= 0; i--) {
          const diff = (sortedDays[i + 1].getTime() - sortedDays[i].getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1) cs++;
          else break;
        }
        currentStreak = cs;
      }
    }

    return {
      sessionCount,
      avgSessionLength,
      logCount,
      exercisesPerDay,
      avgRating,
      totalStars,
      daysActive,
      currentStreak,
      longestStreak,
      totalPracticeMinutes,
    };
  }, [filteredLogs, filteredSessions, period]);

  const dailyActivity = useMemo(() => {
    const days = 14;
    const result: { date: string; label: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const count = filteredLogs.filter(l => {
        if (!l.completed_at) return false;
        return new Date(l.completed_at).toDateString() === dateStr;
      }).length;
      result.push({ date: dateStr, label, count });
    }
    return result;
  }, [filteredLogs]);

  const maxDailyCount = useMemo(() => Math.max(...dailyActivity.map(d => d.count), 1), [dailyActivity]);

  const exerciseBreakdown = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    filteredLogs.forEach(log => {
      const name = log.title_en || log.exercise_title || 'Unknown';
      const key = name.toLowerCase();
      if (!counts[key]) counts[key] = { name, count: 0 };
      counts[key].count++;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredLogs]);

  const maxExerciseCount = useMemo(() => Math.max(...exerciseBreakdown.map(e => e.count), 1), [exerciseBreakdown]);

  const ratingTrend = useMemo(() => {
    return filteredLogs
      .filter(l => l.self_rating != null)
      .slice(-20)
      .map(l => l.self_rating!);
  }, [filteredLogs]);

  const insights = useMemo(() => {
    const msgs: { type: 'positive' | 'warning' | 'info'; text: string }[] = [];

    if (stats.currentStreak >= 3) {
      msgs.push({ type: 'positive', text: `Great streak! ${stats.currentStreak} consecutive days active. 連續 ${stats.currentStreak} 天活躍！` });
    } else if (stats.currentStreak === 0 && stats.daysActive > 0) {
      msgs.push({ type: 'warning', text: 'Streak broken — consider encouraging patient to resume. 連續紀錄中斷，請鼓勵患者恢復訓練。' });
    }

    if (stats.avgRating >= 7) {
      msgs.push({ type: 'positive', text: `Patient feels positive (avg rating ${stats.avgRating.toFixed(1)}/10). 患者感覺良好。` });
    } else if (stats.avgRating > 0 && stats.avgRating < 5) {
      msgs.push({ type: 'warning', text: `Low self-rating (${stats.avgRating.toFixed(1)}/10) — consider adjusting difficulty. 自評偏低，考慮調整難度。` });
    }

    if (stats.exercisesPerDay < 1 && stats.logCount > 0) {
      msgs.push({ type: 'warning', text: `Low compliance (${stats.exercisesPerDay.toFixed(1)} exercises/day). Review exercise plan. 訓練頻率偏低，請檢視計劃。` });
    } else if (stats.exercisesPerDay >= 3) {
      msgs.push({ type: 'positive', text: `Strong compliance (${stats.exercisesPerDay.toFixed(1)} exercises/day). 訓練頻率良好。` });
    }

    if (exerciseBreakdown.length > 0) {
      msgs.push({ type: 'info', text: `Most practiced: "${exerciseBreakdown[0].name}" (${exerciseBreakdown[0].count}×). 最常練習：「${exerciseBreakdown[0].name}」` });
    }

    if (msgs.length === 0) {
      msgs.push({ type: 'info', text: 'Not enough data for insights yet. 目前資料不足以產生分析。' });
    }

    return msgs;
  }, [stats, exerciseBreakdown]);

  const recentLogs = useMemo(() => {
    return [...filteredLogs].reverse().slice(0, 15);
  }, [filteredLogs]);

  const fullLogsFiltered = useMemo(() => {
    let logs = [...allLogs].reverse();
    if (logsSearch.trim()) {
      const q = logsSearch.trim().toLowerCase();
      logs = logs.filter(l =>
        (l.title_en || l.exercise_title || '').toLowerCase().includes(q)
      );
    }
    if (logsDateFrom) {
      const from = new Date(logsDateFrom);
      from.setHours(0, 0, 0, 0);
      if (!isNaN(from.getTime())) {
        logs = logs.filter(l => l.completed_at && new Date(l.completed_at) >= from);
      }
    }
    if (logsDateTo) {
      const to = new Date(logsDateTo);
      to.setHours(23, 59, 59, 999);
      if (!isNaN(to.getTime())) {
        logs = logs.filter(l => l.completed_at && new Date(l.completed_at) <= to);
      }
    }
    return logs;
  }, [allLogs, logsSearch, logsDateFrom, logsDateTo]);

  const logsToShow = useMemo(() => {
    return fullLogsFiltered.slice(0, logsDisplayCount);
  }, [fullLogsFiltered, logsDisplayCount]);

  const hasMoreLogs = fullLogsFiltered.length > logsDisplayCount;

  const handleLoadMoreLogs = useCallback(() => {
    setLogsDisplayCount(prev => prev + PAGE_SIZE);
  }, []);

  const handleClearLogsSearch = useCallback(() => {
    setLogsSearch('');
    setLogsDateFrom('');
    setLogsDateTo('');
    setLogsDisplayCount(PAGE_SIZE);
  }, []);

  const sessionsFiltered = useMemo(() => {
    return [...allSessions].reverse();
  }, [allSessions]);

  const sessionsToShow = useMemo(() => {
    return sessionsFiltered.slice(0, sessionsDisplayCount);
  }, [sessionsFiltered, sessionsDisplayCount]);

  const hasMoreSessions = sessionsFiltered.length > sessionsDisplayCount;

  const handleLoadMoreSessions = useCallback(() => {
    setSessionsDisplayCount(prev => prev + PAGE_SIZE);
  }, []);

  const sessionsTotalCount = allSessions.length;
  const sessionsAvgDuration = useMemo(() => {
    if (allSessions.length === 0) return 0;
    const total = allSessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0);
    return Math.round(total / allSessions.length);
  }, [allSessions]);

  const patient = patientQuery.data;
  const isLoading = patientQuery.isLoading || exerciseLogsQuery.isLoading || appSessionsQuery.isLoading;

  const handleRefresh = useCallback(() => {
    void patientQuery.refetch();
    void exerciseLogsQuery.refetch();
    void appSessionsQuery.refetch();
    void questionnaireQuery.refetch();
  }, [patientQuery, exerciseLogsQuery, appSessionsQuery, questionnaireQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading dashboard... 載入儀表板...</Text>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Patient not found 找不到患者</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>Clinical Dashboard 臨床儀表板</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{patient.patient_name} · {patient.access_code}</Text>
        </View>
      </View>

      <View style={styles.periodBar}>
        {PERIOD_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.periodBtn, period === opt.key && styles.periodBtnActive]}
            onPress={() => setPeriod(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodBtnText, period === opt.key && styles.periodBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={patientQuery.isRefetching || exerciseLogsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      >
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Activity size={16} color={ACCENT} />}
            value={String(stats.sessionCount)}
            sub={`avg ${formatDuration(stats.avgSessionLength)}`}
            label="App Sessions 應用次數"
            bg={ACCENT_BG}
          />
          <StatCard
            icon={<Dumbbell size={16} color="#7C3AED" />}
            value={String(stats.logCount)}
            sub={`${stats.exercisesPerDay.toFixed(1)}/day`}
            label="Exercises 運動次數"
            bg="#F5F3FF"
          />
          <StatCard
            icon={<TrendingUp size={16} color="#0284C7" />}
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            sub="out of 10"
            label="Avg Rating 平均自評"
            bg="#F0F9FF"
          />
          <StatCard
            icon={<Star size={16} color="#D97706" />}
            value={String(stats.totalStars)}
            sub="earned"
            label="Stars 星星"
            bg="#FFFBEB"
          />
          <StatCard
            icon={<Flame size={16} color="#DC2626" />}
            value={`${stats.daysActive}d`}
            sub={`${stats.currentStreak}🔥 / ${stats.longestStreak} best`}
            label="Active Days 活躍天數"
            bg="#FEF2F2"
          />
          <StatCard
            icon={<Clock size={16} color={WARM} />}
            value={`${stats.totalPracticeMinutes}m`}
            sub="total"
            label="Practice Time 練習時間"
            bg="#FFF7ED"
          />
        </View>

        <SectionHeader icon={<BarChart3 size={16} color={ACCENT} />} title="Daily Activity (14 days) 每日活動" />
        <View style={styles.chartCard}>
          {dailyActivity.every(d => d.count === 0) ? (
            <View style={styles.emptyChart}>
              <Calendar size={24} color={Colors.textTertiary} />
              <Text style={styles.emptyChartText}>No activity data 無活動資料</Text>
            </View>
          ) : (
            <>
              <View style={styles.barChart}>
                {dailyActivity.map((day, i) => {
                  const height = Math.max(4, (day.count / maxDailyCount) * 100);
                  const isToday = i === dailyActivity.length - 1;
                  return (
                    <View key={day.date} style={styles.barCol}>
                      <Text style={styles.barValue}>{day.count > 0 ? day.count : ''}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${height}%` as unknown as number,
                              backgroundColor: isToday ? WARM : day.count > 0 ? ACCENT : '#E5E7EB',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{day.label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {exerciseBreakdown.length > 0 && (
          <>
            <SectionHeader icon={<Dumbbell size={16} color="#7C3AED" />} title="Top Exercises 熱門運動" />
            <View style={styles.card}>
              {exerciseBreakdown.map((ex, idx) => (
                <View key={ex.name} style={[styles.exerciseRow, idx < exerciseBreakdown.length - 1 && styles.exerciseRowBorder]}>
                  <View style={styles.exerciseInfo}>
                    <View style={styles.exerciseRank}>
                      <Text style={styles.exerciseRankText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                    <Text style={styles.exerciseCount}>{ex.count}</Text>
                  </View>
                  <View style={styles.exerciseBarTrack}>
                    <View
                      style={[
                        styles.exerciseBar,
                        { width: `${(ex.count / maxExerciseCount) * 100}%` as unknown as number },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {ratingTrend.length > 0 && (
          <>
            <SectionHeader icon={<TrendingUp size={16} color="#0284C7" />} title="Self-Rating Trend 自評趨勢" />
            <View style={styles.chartCard}>
              <View style={styles.ratingChart}>
                {ratingTrend.map((rating, i) => {
                  const height = Math.max(4, (rating / 10) * 80);
                  const color = rating >= 7 ? '#10B981' : rating >= 5 ? '#F59E0B' : '#EF4444';
                  return (
                    <View key={`r-${i}`} style={styles.ratingBarCol}>
                      <View style={styles.ratingBarTrack}>
                        <View style={[styles.ratingBar, { height, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.ratingLegend}>
                <View style={styles.ratingLegendItem}>
                  <View style={[styles.ratingDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.ratingLegendText}>7-10</Text>
                </View>
                <View style={styles.ratingLegendItem}>
                  <View style={[styles.ratingDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.ratingLegendText}>5-6</Text>
                </View>
                <View style={styles.ratingLegendItem}>
                  <View style={[styles.ratingDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.ratingLegendText}>1-4</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <SectionHeader icon={<Brain size={16} color={WARM} />} title="Clinical Insights 臨床觀察" />
        <View style={styles.card}>
          {insights.map((insight, i) => (
            <View key={`insight-${i}`} style={[styles.insightRow, i < insights.length - 1 && styles.insightRowBorder]}>
              {insight.type === 'positive' ? (
                <CheckCircle2 size={18} color="#10B981" />
              ) : insight.type === 'warning' ? (
                <AlertTriangle size={18} color="#F59E0B" />
              ) : (
                <ThumbsUp size={18} color="#6366F1" />
              )}
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))}
        </View>

        {allQuestionnaires.length > 0 && (
          <>
            <SectionHeader icon={<ClipboardList size={16} color="#059669" />} title="Assessment History 評估歷史" />
            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Assessment 評估</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' as const }]}>Score 分數</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' as const }]}>Date 日期</Text>
              </View>
              {allQuestionnaires.slice(0, 10).map((q, idx) => (
                <View key={q.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {q.questionnaire_templates?.name || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' as const, fontWeight: '700' as const, color: ACCENT }]}>
                    {q.total_score ?? '—'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' as const }]}>
                    {formatFullDate(q.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {recentLogs.length > 0 && !logsExpanded && (
          <>
            <SectionHeader icon={<Zap size={16} color="#DC2626" />} title="Recent Exercise Logs 最近訓練紀錄" />
            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date 日期</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Exercise 運動</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'center' as const }]}>Rating</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' as const }]}>⭐</Text>
              </View>
              {recentLogs.map((log, idx) => (
                <View key={log.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(log.completed_at)}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {log.title_en || log.exercise_title || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' as const }]}>
                    {log.self_rating != null ? (
                      <Text style={{ color: log.self_rating >= 7 ? '#10B981' : log.self_rating >= 5 ? '#F59E0B' : '#EF4444', fontWeight: '600' as const }}>
                        {log.self_rating}
                      </Text>
                    ) : '—'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center' as const }]}>
                    {log.stars_earned ?? 0}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.logsExpandToggle}
          onPress={() => {
            setLogsExpanded(!logsExpanded);
            if (!logsExpanded) setLogsDisplayCount(PAGE_SIZE);
          }}
          activeOpacity={0.7}
        >
          <FileText size={16} color={ACCENT} />
          <Text style={styles.logsExpandToggleText}>
            {logsExpanded ? 'Hide Full Exercise Logs 收起完整紀錄' : `View All Exercise Logs 查看全部紀錄 (${allLogs.length})`}
          </Text>
          {logsExpanded ? <ChevronUp size={16} color={ACCENT} /> : <ChevronDown size={16} color={ACCENT} />}
        </TouchableOpacity>

        {logsExpanded && (
          <View style={styles.logsSection}>
            <View style={styles.logsSearchRow}>
              <View style={styles.logsSearchInputWrap}>
                <Search size={14} color={Colors.textTertiary} />
                <TextInput
                  style={styles.logsSearchInput}
                  placeholder="Search exercise... 搜尋運動..."
                  placeholderTextColor={Colors.textTertiary}
                  value={logsSearch}
                  onChangeText={(t) => { setLogsSearch(t); setLogsDisplayCount(PAGE_SIZE); }}
                />
                {(logsSearch || logsDateFrom || logsDateTo) ? (
                  <TouchableOpacity onPress={handleClearLogsSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.logsDateRow}>
              <View style={styles.logsDateField}>
                <Text style={styles.logsDateLabel}>From 從</Text>
                <TextInput
                  style={styles.logsDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textTertiary}
                  value={logsDateFrom}
                  onChangeText={(t) => { setLogsDateFrom(t); setLogsDisplayCount(PAGE_SIZE); }}
                  maxLength={10}
                />
              </View>
              <View style={styles.logsDateField}>
                <Text style={styles.logsDateLabel}>To 至</Text>
                <TextInput
                  style={styles.logsDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textTertiary}
                  value={logsDateTo}
                  onChangeText={(t) => { setLogsDateTo(t); setLogsDisplayCount(PAGE_SIZE); }}
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.logsCountBar}>
              <Text style={styles.logsCountText}>
                Showing {logsToShow.length} of {fullLogsFiltered.length} logs
                {fullLogsFiltered.length !== allLogs.length ? ` (filtered from ${allLogs.length})` : ''}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Date/Time 日期時間</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Exercise 運動</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'center' as const }]}>Rating</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' as const }]}>⭐</Text>
              </View>
              {logsToShow.length === 0 ? (
                <View style={styles.logsEmpty}>
                  <Search size={20} color={Colors.textTertiary} />
                  <Text style={styles.logsEmptyText}>No logs match your filters 沒有符合篩選的紀錄</Text>
                </View>
              ) : (
                logsToShow.map((log, idx) => (
                  <View key={log.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 1.4, fontSize: 11 }]}>{formatDateTime(log.completed_at)}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                      {log.title_en || log.exercise_title || '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'center' as const }]}>
                      {log.self_rating != null ? (
                        <Text style={{ color: log.self_rating >= 7 ? '#10B981' : log.self_rating >= 5 ? '#F59E0B' : '#EF4444', fontWeight: '600' as const }}>
                          {log.self_rating}
                        </Text>
                      ) : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center' as const }]}>
                      {log.stars_earned ?? 0}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {hasMoreLogs && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMoreLogs} activeOpacity={0.7}>
                <Text style={styles.loadMoreText}>Load More 載入更多 ({fullLogsFiltered.length - logsDisplayCount} remaining)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.logsExpandToggle}
          onPress={() => {
            setSessionsExpanded(!sessionsExpanded);
            if (!sessionsExpanded) setSessionsDisplayCount(PAGE_SIZE);
          }}
          activeOpacity={0.7}
        >
          <Activity size={16} color={ACCENT} />
          <Text style={styles.logsExpandToggleText}>
            {sessionsExpanded ? 'Hide App Sessions 收起應用紀錄' : `View All App Sessions 查看全部應用紀錄 (${sessionsTotalCount})`}
          </Text>
          {sessionsExpanded ? <ChevronUp size={16} color={ACCENT} /> : <ChevronDown size={16} color={ACCENT} />}
        </TouchableOpacity>

        {sessionsExpanded && (
          <View style={styles.logsSection}>
            <View style={styles.logsCountBar}>
              <Text style={styles.logsCountText}>
                {sessionsTotalCount} total sessions · avg {formatDuration(sessionsAvgDuration)}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Opened 開啟時間</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Closed 關閉時間</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' as const }]}>Duration 時長</Text>
              </View>
              {sessionsToShow.length === 0 ? (
                <View style={styles.logsEmpty}>
                  <Activity size={20} color={Colors.textTertiary} />
                  <Text style={styles.logsEmptyText}>No app sessions 沒有應用紀錄</Text>
                </View>
              ) : (
                sessionsToShow.map((sess, idx) => {
                  const durationSec = sess.duration_seconds || 0;
                  const mins = Math.floor(durationSec / 60);
                  const secs = durationSec % 60;
                  const durationStr = `${mins}m ${secs}s`;
                  return (
                    <View key={sess.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                      <Text style={[styles.tableCell, { flex: 1.4, fontSize: 11 }]}>{formatDateTime(sess.opened_at)}</Text>
                      <Text style={[styles.tableCell, { flex: 1.4, fontSize: 11 }]}>{formatDateTime(sess.closed_at)}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right' as const, fontWeight: '600' as const, color: ACCENT }]}>{durationStr}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {hasMoreSessions && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMoreSessions} activeOpacity={0.7}>
                <Text style={styles.loadMoreText}>Load More 載入更多 ({sessionsFiltered.length - sessionsDisplayCount} remaining)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {filteredLogs.length === 0 && filteredSessions.length === 0 && (
          <View style={styles.emptyState}>
            <BarChart3 size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyStateTitle}>No data for this period 此期間無資料</Text>
            <Text style={styles.emptyStateText}>Try selecting a longer period or check if the patient has used the app.</Text>
          </View>
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, value, sub, label, bg }: {
  icon: React.ReactNode;
  value: string;
  sub: string;
  label: string;
  bg: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={styles.statCardTop}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statSub}>{sub}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PAGE_BG, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  errorText: { fontSize: 15, color: Colors.danger },
  backBtn: { backgroundColor: ACCENT, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#FFF', fontWeight: '600' as const },

  header: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  periodBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: ACCENT,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  periodBtnTextActive: {
    color: '#FFF',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 4 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '47.5%' as unknown as number,
    borderRadius: 14,
    padding: 14,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statSub: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  chartCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyChartText: { fontSize: 13, color: Colors.textTertiary },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 130,
    gap: 2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    height: 14,
  },
  barTrack: {
    flex: 1,
    width: '80%' as unknown as number,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  barLabelToday: {
    color: WARM,
    fontWeight: '700' as const,
  },

  exerciseRow: {
    paddingVertical: 10,
    gap: 6,
  },
  exerciseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  exerciseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRankText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#7C3AED',
  },
  exerciseName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  exerciseCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  exerciseBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 32,
  },
  exerciseBar: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },

  ratingChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 90,
    gap: 3,
  },
  ratingBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  ratingBarTrack: {
    width: '70%' as unknown as number,
    height: 80,
    justifyContent: 'flex-end',
  },
  ratingBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  ratingLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  ratingLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ratingLegendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },

  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
  },
  insightRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },

  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 12,
    color: Colors.text,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptyStateText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  logsExpandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT_LIGHT,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  logsExpandToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ACCENT,
  },
  logsSection: {
    marginTop: 10,
    gap: 10,
  },
  logsSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  logsSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 40,
  },
  logsSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 0,
  },
  logsDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logsDateField: {
    flex: 1,
    gap: 3,
  },
  logsDateLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  logsDateInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logsCountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logsCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  logsEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  logsEmptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  loadMoreBtn: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ACCENT,
  },
});

