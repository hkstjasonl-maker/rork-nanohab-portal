import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  ClipboardList,
  ImagePlus,
  Package,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Notification } from '@/types';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, role, clinician, adminUser } = useAuth();

  const patientsQuery = useQuery({
    queryKey: ['dashboard-patients', role, clinician?.id],
    queryFn: async () => {
      let query = supabase
        .from('patients')
        .select('id, is_frozen', { count: 'exact' });

      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }

      const { count, error } = await query.eq('is_frozen', false);
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
      if (!isAdmin && clinician?.id) {
        const { data: patients, error: patientsError } = await supabase
          .from('patients')
          .select('id')
          .eq('clinician_id', clinician.id);
        if (patientsError) {
          console.log('Dashboard programs patients error:', patientsError);
          return 0;
        }
        const patientIds = (patients || []).map((p: { id: string }) => p.id);
        if (patientIds.length === 0) return 0;
        const { count, error } = await supabase
          .from('exercise_programs')
          .select('id', { count: 'exact' })
          .in('patient_id', patientIds);
        if (error) {
          console.log('Dashboard programs error:', error);
          return 0;
        }
        return count || 0;
      }

      const { count, error } = await supabase
        .from('exercise_programs')
        .select('id', { count: 'exact' });
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

  const rentalRequestsQuery = useQuery({
    queryKey: ['dashboard-rental-requests'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('marketplace_rentals')
        .select('id', { count: 'exact' })
        .in('status', ['pending', 'cooling_off']);
      if (error) {
        console.log('Dashboard rental requests error:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: isAdmin,
  });

  const notificationsQuery = useQuery({
    queryKey: ['dashboard-notifications', role, clinician?.id, adminUser?.id],
    queryFn: async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

          const { data, error } = await query;
        if (error) {
          console.log('Dashboard notifications error:', error);
          return [];
        }
        return (data || []) as Notification[];
      } catch (e) {
        console.log('Dashboard notifications exception:', e);
        return [];
      }
    },
  });

  const isRefreshing =
    patientsQuery.isRefetching ||
    programsQuery.isRefetching ||
    notificationsQuery.isRefetching;

  const onRefresh = useCallback(() => {
    void patientsQuery.refetch();
    void programsQuery.refetch();
    void notificationsQuery.refetch();
    if (isAdmin) {
      void mediaRequestsQuery.refetch();
      void rentalRequestsQuery.refetch();
    }
  }, [patientsQuery, programsQuery, notificationsQuery, isAdmin, mediaRequestsQuery, rentalRequestsQuery]);

  const userName = isAdmin
    ? 'Administrator'
    : clinician?.full_name || 'Clinician';

  const greeting = getGreeting();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {isAdmin ? 'Admin' : 'Clinician'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <Text style={styles.sectionTitle}>Overview 總覽</Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon={<Users size={22} color={Colors.accent} />}
            label="Active Patients 活躍患者"
            value={patientsQuery.data ?? '-'}
            isLoading={patientsQuery.isLoading}
            color={Colors.accent}
            bgColor={Colors.accentLight}
          />
          <StatCard
            icon={<ClipboardList size={22} color="#5B8DEF" />}
            label="Programs 計劃"
            value={programsQuery.data ?? '-'}
            isLoading={programsQuery.isLoading}
            color="#5B8DEF"
            bgColor="#E8F0FE"
          />
          {isAdmin && (
            <>
              <StatCard
                icon={<ImagePlus size={22} color="#E5A100" />}
                label="Media Requests 媒體請求"
                value={mediaRequestsQuery.data ?? '-'}
                isLoading={mediaRequestsQuery.isLoading}
                color="#E5A100"
                bgColor="#FFF8E5"
              />
              <StatCard
                icon={<Package size={22} color="#34C759" />}
                label="Rental Requests 租借請求"
                value={rentalRequestsQuery.data ?? '-'}
                isLoading={rentalRequestsQuery.isLoading}
                color="#34C759"
                bgColor="#E8F9ED"
              />
            </>
          )}
        </View>

        <View style={styles.notificationsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent 最新通知</Text>
            <Bell size={18} color={Colors.textTertiary} />
          </View>

          {notificationsQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : (notificationsQuery.data?.length ?? 0) === 0 ? (
            <View style={styles.emptyNotifications}>
              <Bell size={32} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No recent notifications</Text>
              <Text style={styles.emptyTextZh}>暫無最新通知</Text>
            </View>
          ) : (
            notificationsQuery.data?.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  isLoading,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  isLoading: boolean;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <View style={styles.statInfo}>
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Text style={[styles.statValue, { color }]}>{value}</Text>
        )}
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <TouchableOpacity style={styles.notificationItem} activeOpacity={0.6}>
      <View style={styles.notificationDot} />
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title_en}</Text>
        <Text style={styles.notificationBody} numberOfLines={2}>{notification.body_en}</Text>
        <Text style={styles.notificationTime}>{timeAgo}</Text>
      </View>
      <ChevronRight size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning 早安';
  if (hour < 18) return 'Good Afternoon 午安';
  return 'Good Evening 晚安';
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  roleBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    width: '47%' as unknown as number,
    flexGrow: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statInfo: {
    gap: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  notificationsSection: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyNotifications: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  emptyTextZh: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  notificationItem: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  notificationDotRead: {
    backgroundColor: Colors.borderLight,
  },
  notificationContent: {
    flex: 1,
    gap: 2,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  notificationBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  notificationTime: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
