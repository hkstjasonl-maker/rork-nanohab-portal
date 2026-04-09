import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Flag,
  User,
  Calendar,
  CheckCircle,
  X,
  AlertTriangle,
  Package,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface MarketplaceReport {
  id: string;
  listing_id: string;
  reporter_clinician_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
  clinicians?: { full_name: string } | null;
  marketplace_listings?: { display_name: string } | null;
}

function getReportStatusInfo(status: string) {
  switch (status) {
    case 'resolved':
      return { label: 'Resolved', color: Colors.success, bg: Colors.successLight };
    case 'dismissed':
      return { label: 'Dismissed', color: Colors.frozen, bg: Colors.frozenLight };
    case 'investigating':
      return { label: 'Investigating', color: Colors.info, bg: Colors.infoLight };
    case 'pending':
    default:
      return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight };
  }
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [resolveTarget, setResolveTarget] = useState<MarketplaceReport | null>(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [statusFilter, setStatusFilter] = useState('all');

  const reportsQuery = useQuery({
    queryKey: ['marketplace-reports'],
    queryFn: async () => {
      console.log('Fetching marketplace reports');
      try {
        const { data, error } = await supabase
          .from('marketplace_reports')
          .select('*, clinicians(full_name), marketplace_listings(display_name)')
          .order('created_at', { ascending: false });

        if (error) {
          console.log('Reports fetch error:', error);
          const { data: fallback, error: fbErr } = await supabase
            .from('marketplace_reports')
            .select('*')
            .order('created_at', { ascending: false });
          if (fbErr) throw fbErr;
          return (fallback || []) as MarketplaceReport[];
        }
        return (data || []) as MarketplaceReport[];
      } catch (e) {
        console.log('Reports exception:', e);
        return [];
      }
    },
  });

  const filteredReports = React.useMemo(() => {
    if (!reportsQuery.data) return [];
    if (statusFilter === 'all') return reportsQuery.data;
    return reportsQuery.data.filter((r) => r.status === statusFilter);
  }, [reportsQuery.data, statusFilter]);

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      console.log('Resolving report:', id, 'to status:', status);
      const { error } = await supabase
        .from('marketplace_reports')
        .update({
          status,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace-reports'] });
      setResolveTarget(null);
      Alert.alert('Updated 已更新', 'Report status updated.\n報告狀態已更新。');
    },
    onError: (error: Error) => {
      console.log('Resolve report error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleResolve = useCallback(() => {
    if (!resolveTarget) return;
    resolveMutation.mutate({ id: resolveTarget.id, status: resolveStatus });
  }, [resolveTarget, resolveStatus, resolveMutation]);

  const renderItem = useCallback(
    ({ item }: { item: MarketplaceReport }) => (
      <ReportCard report={item} onResolve={() => { setResolveTarget(item); setResolveStatus('resolved'); }} />
    ),
    []
  );

  const keyExtractor = useCallback((item: MarketplaceReport) => item.id, []);

  const pendingCount = React.useMemo(() => {
    return (reportsQuery.data || []).filter((r) => r.status === 'pending' || r.status === 'investigating').length;
  }, [reportsQuery.data]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Reports 報告</Text>
          <Text style={styles.headerCount}>
            {pendingCount > 0 ? `${pendingCount} pending · ` : ''}{filteredReports.length} total
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {reportsQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : reportsQuery.isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load reports</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void reportsQuery.refetch()}>
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={reportsQuery.isRefetching}
              onRefresh={() => void reportsQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Flag size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No reports found</Text>
              <Text style={styles.emptyTextSub}>找不到報告</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!resolveTarget} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.resolveModal}>
            <View style={styles.resolveHeader}>
              <Text style={styles.resolveTitle}>Update Report 更新報告</Text>
              <TouchableOpacity onPress={() => setResolveTarget(null)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {resolveTarget && (
              <View style={styles.resolveInfo}>
                <Text style={styles.resolveInfoLabel}>Listing</Text>
                <Text style={styles.resolveInfoValue}>
                  {resolveTarget.marketplace_listings?.display_name || resolveTarget.listing_id?.slice(0, 8) + '...'}
                </Text>
                <Text style={styles.resolveInfoLabel}>Reason</Text>
                <Text style={styles.resolveInfoValue}>{resolveTarget.reason}</Text>
                {resolveTarget.details && (
                  <>
                    <Text style={styles.resolveInfoLabel}>Details</Text>
                    <Text style={styles.resolveInfoValue}>{resolveTarget.details}</Text>
                  </>
                )}
              </View>
            )}

            <Text style={styles.resolveFieldLabel}>Set Status 設定狀態</Text>
            <View style={styles.statusOptions}>
              {['resolved', 'dismissed', 'investigating'].map((s) => {
                const info = getReportStatusInfo(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusOption,
                      { borderColor: info.color },
                      resolveStatus === s && { backgroundColor: info.bg },
                    ]}
                    onPress={() => setResolveStatus(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.statusOptionText, { color: info.color }]}>
                      {info.label}
                    </Text>
                    {resolveStatus === s && <CheckCircle size={14} color={info.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.resolveButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResolveTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel 取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, resolveMutation.isPending && { opacity: 0.6 }]}
                onPress={handleResolve}
                disabled={resolveMutation.isPending}
              >
                {resolveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>Update 更新</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ReportCard = React.memo(function ReportCard({
  report,
  onResolve,
}: {
  report: MarketplaceReport;
  onResolve: () => void;
}) {
  const statusInfo = getReportStatusInfo(report.status);
  const reporterName = report.clinicians?.full_name || 'Unknown';
  const listingName = report.marketplace_listings?.display_name || report.listing_id?.slice(0, 8) + '...';
  const createdDate = report.created_at ? new Date(report.created_at).toLocaleDateString() : '-';
  const isOpen = report.status === 'pending' || report.status === 'investigating';

  return (
    <View style={[styles.card, !isOpen && styles.cardFaded]} testID={`report-${report.id}`}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.listingRow}>
            <Package size={13} color={Colors.accent} />
            <Text style={styles.listingName} numberOfLines={1}>{listingName}</Text>
          </View>
          <View style={styles.reporterRow}>
            <User size={12} color={Colors.textSecondary} />
            <Text style={styles.reporterText}>Reported by {reporterName}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.reasonSection}>
        <View style={styles.reasonHeader}>
          <AlertTriangle size={12} color={Colors.warning} />
          <Text style={styles.reasonLabel}>Reason</Text>
        </View>
        <Text style={styles.reasonText}>{report.reason}</Text>
      </View>

      {report.details && (
        <Text style={styles.detailsText} numberOfLines={3}>{report.details}</Text>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.dateItem}>
          <Calendar size={11} color={Colors.textTertiary} />
          <Text style={styles.dateText}>{createdDate}</Text>
        </View>
        {isOpen && (
          <TouchableOpacity style={styles.resolveBtn} onPress={onResolve} activeOpacity={0.7}>
            <CheckCircle size={13} color={Colors.white} />
            <Text style={styles.resolveBtnText}>Resolve</Text>
          </TouchableOpacity>
        )}
        {report.resolved_at && (
          <Text style={styles.resolvedDate}>
            Resolved: {new Date(report.resolved_at).toLocaleDateString()}
          </Text>
        )}
      </View>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 4,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  emptyTextSub: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  cardFaded: {
    opacity: 0.65,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  listingName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reporterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  reasonSection: {
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    padding: 10,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.warning,
    textTransform: 'uppercase' as const,
  },
  reasonText: {
    fontSize: 13,
    color: '#7A5A00',
    lineHeight: 18,
  },
  detailsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  resolvedDate: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  resolveModal: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  resolveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resolveTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  resolveInfo: {
    gap: 4,
    marginBottom: 16,
    backgroundColor: '#FAFAF8',
    borderRadius: 10,
    padding: 12,
  },
  resolveInfoLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    marginTop: 4,
  },
  resolveInfoValue: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  resolveFieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  resolveButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
