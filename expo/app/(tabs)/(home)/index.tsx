import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  ClipboardList,
  ImagePlus,
  ShoppingBag,
  Bell,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Notification } from '@/types';

function getNotificationIcon(type?: string) {
  const size = 16;
  switch (type) {
    case 'warning':
      return <AlertTriangle size={size} color={Colors.warning} />;
    case 'success':
      return <CheckCircle size={size} color={Colors.success} />;
    case 'alert':
      return <AlertCircle size={size} color={Colors.danger} />;
    default:
      return <Info size={size} color={Colors.info} />;
  }
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, clinician } = useAuth();

  const patientsQuery = useQuery({
    queryKey: ['dashboard-patients', isAdmin, clinician?.id],
    queryFn: async () => {
      let query = supabase
        .from('patients')
        .select('id, patient_name, is_frozen, is_active', { count: 'exact' })
        .eq('is_frozen', false);

      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }

      const { count, error } = await query;
      if (error) {
        console.log('Dashboard patients error:', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  const programsQuery = useQuery({
    queryKey: ['dashboard-programs', isAdmin, clinician?.id],
    queryFn: async () => {
      let query = supabase
        .from('exercise_programs')
        .select('id', { count: 'exact' })
        .eq('is_active', true);

      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }

      const { count, error } = await query;
      if (error) {
        console.log('Dashboard programs error:', error);
        return 0;
      }
      return count ?? 0;
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
      return count ?? 0;
    },
    enabled: isAdmin,
  });

  const pendingRentalsQuery = useQuery({
    queryKey: ['dashboard-pending-rentals'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('marketplace_rentals')
        .select('id', { count: 'exact' })
        .in('status', ['pending', 'cooling_off']);
      if (error) {
        console.log('Dashboard pending rentals error:', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: isAdmin,
  });

  const notificationsQuery = useQuery({
    queryKey: ['dashboard-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title_en, body_en, type, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) {
        console.log('Dashboard notifications error:', error);
        return [];
      }
      return (data || []) as Pick<Notification, 'id' | 'title_en' | 'body_en' | 'type' | 'created_at'>[];
    },
  });

  const isRefreshing = patientsQuery.isRefetching || programsQuery.isRefetching || notificationsQuery.isRefetching;

  const handleRefresh = () => {
    void patientsQuery.refetch();
    void programsQuery.refetch();
    void notificationsQuery.refetch();
    if (isAdmin) {
      void mediaRequestsQuery.refetch();
      void pendingRentalsQuery.refetch();
    }
  };

  const userName = isAdmin
    ? 'Administrator'
    : clinician?.full_name || 'Clinician';

  const isLoading = patientsQuery.isLoading || programsQuery.isLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back 歡迎回來</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{isAdmin ? 'Admin' : 'Clinician'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Users size={22} color={Colors.accent} />}
                label="Active Patients"
                labelZh="活躍患者"
                value={patientsQuery.data ?? 0}
                color={Colors.accent}
              />
              <StatCard
                icon={<ClipboardList size={22} color={Colors.info} />}
                label="Programs"
                labelZh="計劃"
                value={programsQuery.data ?? 0}
                color={Colors.info}
              />
            </View>

            {isAdmin && (
              <View style={styles.statsGrid}>
                <StatCard
                  icon={<ImagePlus size={22} color={Colors.warning} />}
                  label="Media Requests"
                  labelZh="媒體申請"
                  value={mediaRequestsQuery.data ?? 0}
                  color={Colors.warning}
                  highlight={!!mediaRequestsQuery.data && mediaRequestsQuery.data > 0}
                />
                <StatCard
                  icon={<ShoppingBag size={22} color={Colors.success} />}
                  label="Pending Rentals"
                  labelZh="待處理租借"
                  value={pendingRentalsQuery.data ?? 0}
                  color={Colors.success}
                  highlight={!!pendingRentalsQuery.data && pendingRentalsQuery.data > 0}
                />
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Bell size={18} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Recent Notifications 最新通知</Text>
            </View>

            {notificationsQuery.isLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 12 }} />
            ) : notificationsQuery.data && notificationsQuery.data.length > 0 ? (
              <View style={styles.notificationsList}>
                {notificationsQuery.data.map((n) => (
                  <View key={n.id} style={styles.notificationCard}>
                    <View style={styles.notificationIcon}>
                      {getNotificationIcon(n.type)}
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {n.title_en}
                      </Text>
                      {n.body_en ? (
                        <Text style={styles.notificationBody} numberOfLines={2}>
                          {n.body_en}
                        </Text>
                      ) : null}
                      <Text style={styles.notificationDate}>
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyNotifications}>
                <Bell size={32} color={Colors.borderLight} />
                <Text style={styles.emptyText}>No notifications 沒有通知</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const StatCard = React.memo(function StatCard({
  icon,
  label,
  labelZh,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  labelZh: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statLabelZh}>{labelZh}</Text>
    </View>
  );
});

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
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  rolePill: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  statCardHighlight: {
    borderWidth: 1.5,
    borderColor: Colors.warning + '40',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  statLabelZh: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  notificationsList: {
    gap: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
  notificationDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
