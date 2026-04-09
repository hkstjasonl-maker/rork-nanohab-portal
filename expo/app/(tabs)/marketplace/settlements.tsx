import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Banknote,
  Calendar,
  User,
  ArrowDownRight,
  Minus,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface MarketplaceSettlement {
  id: string;
  rental_id: string;
  owner_clinician_id: string;
  amount_hkd: number;
  platform_fee_hkd: number;
  net_payout_hkd: number;
  status: string;
  settled_at: string | null;
  created_at: string;
  clinicians?: { full_name: string } | null;
}

type SettlementStatus = 'pending' | 'completed' | 'failed' | 'processing';

function getStatusInfo(status: string) {
  switch (status as SettlementStatus) {
    case 'completed':
      return { label: 'Completed', color: Colors.success, bg: Colors.successLight };
    case 'failed':
      return { label: 'Failed', color: Colors.danger, bg: Colors.dangerLight };
    case 'processing':
      return { label: 'Processing', color: Colors.info, bg: Colors.infoLight };
    case 'pending':
    default:
      return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight };
  }
}

export default function SettlementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();

  const settlementsQuery = useQuery({
    queryKey: ['marketplace-settlements'],
    queryFn: async () => {
      console.log('Fetching marketplace settlements');
      try {
        const { data, error } = await supabase
          .from('marketplace_settlements')
          .select('*, clinicians(full_name)')
          .order('created_at', { ascending: false });

        if (error) {
          console.log('Settlements fetch error:', error);
          const { data: fallback, error: fbErr } = await supabase
            .from('marketplace_settlements')
            .select('*')
            .order('created_at', { ascending: false });
          if (fbErr) throw fbErr;
          return (fallback || []) as MarketplaceSettlement[];
        }
        return (data || []) as MarketplaceSettlement[];
      } catch (e) {
        console.log('Settlements exception:', e);
        return [];
      }
    },
  });

  const totalStats = React.useMemo(() => {
    if (!settlementsQuery.data) return { count: 0, totalAmount: 0, totalFees: 0, totalNet: 0 };
    const items = settlementsQuery.data;
    return {
      count: items.length,
      totalAmount: items.reduce((s, i) => s + (i.amount_hkd || 0), 0),
      totalFees: items.reduce((s, i) => s + (i.platform_fee_hkd || 0), 0),
      totalNet: items.reduce((s, i) => s + (i.net_payout_hkd || 0), 0),
    };
  }, [settlementsQuery.data]);

  const renderItem = useCallback(
    ({ item }: { item: MarketplaceSettlement }) => <SettlementCard settlement={item} />,
    []
  );

  const keyExtractor = useCallback((item: MarketplaceSettlement) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Settlements 結算</Text>
          <Text style={styles.headerCount}>{totalStats.count} record{totalStats.count !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Banknote size={16} color={Colors.accent} />
          <Text style={styles.statValue}>${totalStats.totalAmount.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Minus size={16} color={Colors.danger} />
          <Text style={styles.statValue}>${totalStats.totalFees.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Fees</Text>
        </View>
        <View style={styles.statCard}>
          <ArrowDownRight size={16} color={Colors.success} />
          <Text style={styles.statValue}>${totalStats.totalNet.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Net</Text>
        </View>
      </View>

      {settlementsQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading settlements...</Text>
        </View>
      ) : settlementsQuery.isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load settlements</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void settlementsQuery.refetch()}>
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={settlementsQuery.data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={settlementsQuery.isRefetching}
              onRefresh={() => void settlementsQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Banknote size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No settlements yet</Text>
              <Text style={styles.emptyTextSub}>尚無結算記錄</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const SettlementCard = React.memo(function SettlementCard({
  settlement,
}: {
  settlement: MarketplaceSettlement;
}) {
  const statusInfo = getStatusInfo(settlement.status);
  const ownerName = settlement.clinicians?.full_name || 'Unknown';
  const createdDate = settlement.created_at
    ? new Date(settlement.created_at).toLocaleDateString()
    : '-';
  const settledDate = settlement.settled_at
    ? new Date(settlement.settled_at).toLocaleDateString()
    : '-';

  return (
    <View style={styles.card} testID={`settlement-${settlement.id}`}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.rentalRef}>
            <Text style={styles.refLabel}>Rental</Text>
            <Text style={styles.refValue} numberOfLines={1}>
              {settlement.rental_id ? settlement.rental_id.slice(0, 8) + '...' : '-'}
            </Text>
          </View>
          <View style={styles.ownerRow}>
            <User size={12} color={Colors.textSecondary} />
            <Text style={styles.ownerText}>{ownerName}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.amountsRow}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>HKD ${(settlement.amount_hkd ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Fee</Text>
          <Text style={[styles.amountValue, { color: Colors.danger }]}>
            -${(settlement.platform_fee_hkd ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Net Payout</Text>
          <Text style={[styles.amountValue, { color: Colors.success, fontWeight: '700' as const }]}>
            HKD ${(settlement.net_payout_hkd ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.datesRow}>
        <View style={styles.dateItem}>
          <Calendar size={11} color={Colors.textTertiary} />
          <Text style={styles.dateLabel}>Created: {createdDate}</Text>
        </View>
        <View style={styles.dateItem}>
          <Calendar size={11} color={settlement.settled_at ? Colors.success : Colors.textTertiary} />
          <Text style={styles.dateLabel}>Settled: {settledDate}</Text>
        </View>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    paddingVertical: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  rentalRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  refValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    maxWidth: 120,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ownerText: {
    fontSize: 13,
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
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF8',
    borderRadius: 10,
    padding: 10,
  },
  amountItem: {
    alignItems: 'center',
    gap: 2,
  },
  amountLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
});
