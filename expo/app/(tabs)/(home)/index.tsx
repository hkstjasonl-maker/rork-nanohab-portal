import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, ClipboardList, Bell, FileVideo, Store, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';

export default function DashboardScreen() {
  const { role, isAdmin, clinician } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const userName = isAdmin ? 'Admin' : clinician?.full_name || 'Clinician';

  const patientsQuery = useQuery({
    queryKey: ['dashboard-patients', role, clinician?.id],
    queryFn: async () => {
      let query = supabase.from('patients').select('id', { count: 'exact' }).eq('is_frozen', false);
      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }
      const { count, error } = await query;
      if (error) {
        console.log('Dashboard patients error:', error);
        return 0;
      }
      return count || 0;
    },
  });

  const programsQuery = useQuery({
    queryKey: ['dashboard-programs', role, clinician?.id],
    queryFn: async () => {
      let query = supabase.from('exercise_programs').select('id', { count: 'exact' }).eq('is_active', true);
      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }
      const { count, error } = await query;
      if (error) {
        console.log('Dashboard programs error:', error);
        return 0;
      }
      return count || 0;
    },
  });

  const mediaRequestsQuery = useQuery({
    queryKey: ['dashboard-media-requests'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('exercise_media_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');
      if (error) {
        console.log('Dashboard media requests error:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: isAdmin,
  });

  const notificationsQuery = useQuery({
    queryKey: ['dashboard-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) {
        console.log('Dashboard notifications error:', error);
        return [];
      }
      return (data || []) as Notification[];
    },
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-patients'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-programs'] });
    if (isAdmin) {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-media-requests'] });
    }
    await queryClient.invalidateQueries({ queryKey: ['dashboard-notifications'] });
    setRefreshing(false);
  }, [queryClient, isAdmin]);

  const isLoading = patientsQuery.isLoading || programsQuery.isLoading || notificationsQuery.isLoading;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{isAdmin ? 'Admin' : 'Clinician'}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Overview 概覽</Text>
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => router.push('/(tabs)/patients')}
                activeOpacity={0.7}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.infoLight }]}>
                  <Users size={20} color={Colors.info} />
                </View>
                <Text style={styles.statValue}>{patientsQuery.data ?? '—'}</Text>
                <Text style={styles.statLabel}>Active Patients{'\n'}活躍病人</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                onPress={() => router.push('/(tabs)/programs')}
                activeOpacity={0.7}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.successLight }]}>
                  <ClipboardList size={20} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{programsQuery.data ?? '—'}</Text>
                <Text style={styles.statLabel}>Active Programs{'\n'}活躍計劃</Text>
              </TouchableOpacity>
            </View>

            {isAdmin && (
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(tabs)/admin/media-requests')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIcon, { backgroundColor: Colors.warningLight }]}>
                    <FileVideo size={20} color={Colors.warning} />
                  </View>
                  <Text style={styles.statValue}>{mediaRequestsQuery.data ?? '—'}</Text>
                  <Text style={styles.statLabel}>Pending Media{'\n'}待審媒體</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(tabs)/marketplace')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                    <Store size={20} color={Colors.accent} />
                  </View>
                  <Text style={styles.statValue}>—</Text>
                  <Text style={styles.statLabel}>Marketplace{'\n'}市場</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.notificationsHeader}>
              <Text style={styles.sectionTitle}>Recent Notifications 最新通知</Text>
            </View>

            {notificationsQuery.data && notificationsQuery.data.length > 0 ? (
              notificationsQuery.data.map((notification) => (
                <View key={notification.id} style={styles.notificationCard}>
                  <View style={styles.notificationDot} />
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title_en}</Text>
                    <Text style={styles.notificationBody} numberOfLines={2}>{notification.body_en}</Text>
                    <Text style={styles.notificationDate}>
                      {new Date(notification.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={Colors.textTertiary} />
                </View>
              ))
            ) : (
              <View style={styles.emptyNotifications}>
                <Bell size={32} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No notifications 沒有通知</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  roleBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accentDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  notificationsHeader: {
    marginTop: 8,
    marginBottom: 0,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationDate: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
