import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle,
  Video,
  Star,
  Filter,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface SessionLog {
  id: string;
  patient_id: string;
  session_start: string | null;
  session_end: string | null;
  exercise_title_en: string | null;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  completed_sets: number | null;
  completed_reps: number | null;
  completion_rate: number | null;
  duration_seconds: number | null;
  self_rating: number | null;
  mirror_mode: boolean | null;
  video_recorded: boolean | null;
  patients: {
    patient_name: string;
    research_participant_code: string | null;
    research_cohort: string | null;
    is_research_participant: boolean;
  };
}

interface ResearchParticipantPicker {
  id: string;
  patient_name: string;
  research_participant_code: string | null;
}

const DATE_RANGES = [
  { key: '7', label: '7d' },
  { key: '14', label: '14d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: 'all', label: 'All' },
] as const;

type DateRangeKey = typeof DATE_RANGES[number]['key'];

function getDateFilter(rangeKey: DateRangeKey): string | null {
  if (rangeKey === 'all') return null;
  const days = parseInt(rangeKey, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function ResearchSessions() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeKey>('30');
  const [showPatientFilter, setShowPatientFilter] = useState(false);

  const participantsQuery = useQuery({
    queryKey: ['research-session-participants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, patient_name, research_participant_code')
        .eq('is_research_participant', true)
        .order('patient_name');
      if (error) throw error;
      return (data || []) as ResearchParticipantPicker[];
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ['research-sessions', selectedPatientId, dateRange],
    queryFn: async () => {
      console.log('Fetching research sessions...', { selectedPatientId, dateRange });
      let query = supabase
        .from('research_session_logs')
        .select('*, patients!inner(patient_name, research_participant_code, research_cohort, is_research_participant)')
        .eq('patients.is_research_participant', true)
        .order('session_start', { ascending: false })
        .limit(200);

      if (selectedPatientId) {
        query = query.eq('patient_id', selectedPatientId);
      }

      const dateFilter = getDateFilter(dateRange);
      if (dateFilter) {
        query = query.gte('session_start', dateFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.log('Error fetching sessions:', error);
        throw error;
      }
      console.log('Fetched sessions:', data?.length);
      return (data || []) as SessionLog[];
    },
  });

  const selectedParticipant = useMemo(() => {
    if (!selectedPatientId || !participantsQuery.data) return null;
    return participantsQuery.data.find(p => p.id === selectedPatientId) ?? null;
  }, [selectedPatientId, participantsQuery.data]);

  const onRefresh = useCallback(() => {
    void sessionsQuery.refetch();
  }, [sessionsQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.patientFilterBtn, selectedPatientId && styles.patientFilterBtnActive]}
          onPress={() => setShowPatientFilter(!showPatientFilter)}
          activeOpacity={0.7}
        >
          <Filter size={14} color={selectedPatientId ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.patientFilterText, selectedPatientId && styles.patientFilterTextActive]} numberOfLines={1}>
            {selectedParticipant?.research_participant_code || selectedParticipant?.patient_name || 'All Patients 全部'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dateRangeBar}>
          {DATE_RANGES.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.dateRangeBtn, dateRange === r.key && styles.dateRangeBtnActive]}
              onPress={() => setDateRange(r.key)}
            >
              <Text style={[styles.dateRangeText, dateRange === r.key && styles.dateRangeTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showPatientFilter && (
        <View style={styles.patientDropdown}>
          <TouchableOpacity
            style={[styles.patientOption, !selectedPatientId && styles.patientOptionActive]}
            onPress={() => { setSelectedPatientId(null); setShowPatientFilter(false); }}
          >
            <Text style={[styles.patientOptionText, !selectedPatientId && styles.patientOptionTextActive]}>All Participants 全部參與者</Text>
          </TouchableOpacity>
          {participantsQuery.data?.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.patientOption, selectedPatientId === p.id && styles.patientOptionActive]}
              onPress={() => { setSelectedPatientId(p.id); setShowPatientFilter(false); }}
            >
              <Text style={[styles.patientOptionText, selectedPatientId === p.id && styles.patientOptionTextActive]}>
                {p.research_participant_code ? `${p.research_participant_code} — ` : ''}{p.patient_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={sessionsQuery.isFetching} onRefresh={onRefresh} tintColor="#1B6B4A" />
        }
        showsVerticalScrollIndicator={false}
      >
        {sessionsQuery.isLoading ? (
          <ActivityIndicator size="large" color="#1B6B4A" style={{ marginTop: 40 }} />
        ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>No session logs found 未找到訓練記錄</Text>
        ) : (
          sessionsQuery.data?.map(session => {
            const completionPct = session.completion_rate != null
              ? Math.round(session.completion_rate * 100)
              : null;
            const durationMin = session.duration_seconds != null
              ? Math.round(session.duration_seconds / 60)
              : null;
            const sessionDate = session.session_start
              ? new Date(session.session_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
              : '—';

            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={styles.codeRow}>
                      <Text style={styles.participantCode}>
                        {session.patients?.research_participant_code || '—'}
                      </Text>
                      <Text style={styles.dateText}>{sessionDate}</Text>
                    </View>
                    <Text style={styles.exerciseTitle} numberOfLines={1}>
                      {session.exercise_title_en || 'Unknown exercise'}
                    </Text>
                  </View>
                  {completionPct !== null && (
                    <View style={[
                      styles.completionBadge,
                      { backgroundColor: completionPct >= 80 ? '#1B6B4A18' : completionPct >= 50 ? '#F59E0B18' : '#EF444418' }
                    ]}>
                      <Text style={[
                        styles.completionText,
                        { color: completionPct >= 80 ? '#1B6B4A' : completionPct >= 50 ? '#F59E0B' : '#EF4444' }
                      ]}>
                        {completionPct}%
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardMetrics}>
                  <View style={styles.metricItem}>
                    <CheckCircle size={12} color={Colors.textTertiary} />
                    <Text style={styles.metricText}>
                      {session.prescribed_sets ?? '?'}×{session.prescribed_reps ?? '?'} → {session.completed_sets ?? '?'}×{session.completed_reps ?? '?'}
                    </Text>
                  </View>

                  {durationMin !== null && (
                    <View style={styles.metricItem}>
                      <Clock size={12} color={Colors.textTertiary} />
                      <Text style={styles.metricText}>{durationMin} min</Text>
                    </View>
                  )}

                  {session.self_rating != null && (
                    <View style={styles.metricItem}>
                      <Star size={12} color="#F59E0B" />
                      <Text style={styles.metricText}>{session.self_rating}/10</Text>
                    </View>
                  )}

                  {session.mirror_mode && (
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagText}>Mirror</Text>
                    </View>
                  )}

                  {session.video_recorded && (
                    <View style={styles.metricItem}>
                      <Video size={12} color="#3B82F6" />
                      <Text style={[styles.metricText, { color: '#3B82F6' }]}>Recorded</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  patientFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 160,
  },
  patientFilterBtnActive: {
    backgroundColor: '#1B6B4A',
    borderColor: '#1B6B4A',
  },
  patientFilterText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  patientFilterTextActive: {
    color: Colors.white,
  },
  dateRangeBar: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateRangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateRangeBtnActive: {
    backgroundColor: '#1B6B4A',
    borderColor: '#1B6B4A',
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dateRangeTextActive: {
    color: Colors.white,
  },
  patientDropdown: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 220,
    overflow: 'hidden',
    marginBottom: 8,
  },
  patientOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  patientOptionActive: {
    backgroundColor: '#1B6B4A10',
  },
  patientOptionText: {
    fontSize: 14,
    color: Colors.text,
  },
  patientOptionTextActive: {
    color: '#1B6B4A',
    fontWeight: '600' as const,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardLeft: { flex: 1 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  participantCode: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1B6B4A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  completionBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  completionText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  cardMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tagBadge: {
    backgroundColor: '#8B5CF618',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#8B5CF6',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 40,
  },
});
