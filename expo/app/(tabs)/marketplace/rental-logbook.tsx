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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  BookOpen,
  Calendar,
  DollarSign,
  Star,
  Clock,
  XCircle,
  RefreshCw,
  AlertOctagon,
  X,
  Send,
  ChevronLeft,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { MarketplaceRental } from '@/types';

type RentalStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'disputed';

function getStatusInfo(status: RentalStatus) {
  switch (status) {
    case 'active':
      return { color: Colors.success, bg: Colors.successLight, icon: '🟢' };
    case 'expired':
      return { color: Colors.frozen, bg: Colors.frozenLight, icon: '⚪' };
    case 'cancelled':
      return { color: Colors.danger, bg: Colors.dangerLight, icon: '🔴' };
    case 'disputed':
      return { color: Colors.warning, bg: Colors.warningLight, icon: '🟠' };
    case 'pending':
    default:
      return { color: Colors.warning, bg: Colors.warningLight, icon: '🟡' };
  }
}

export default function RentalLogbookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clinician } = useAuth();
  const [activeTab, setActiveTab] = useState<'renting' | 'listings'>('renting');

  const myRentalsQuery = useQuery({
    queryKey: ['my-rentals', clinician?.id],
    queryFn: async () => {
      if (!clinician?.id) return [];
      console.log('Fetching my rentals for:', clinician.id);
      const { data, error } = await supabase
        .from('marketplace_rentals')
        .select('*, marketplace_listings(*, exercise_library(title_en, title_zh_hant, category), clinicians(full_name, full_name_zh))')
        .eq('renting_clinician_id', clinician.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('My rentals fetch error:', error);
        throw error;
      }
      return (data || []) as MarketplaceRental[];
    },
    enabled: !!clinician?.id,
  });

  const listingRentalsQuery = useQuery({
    queryKey: ['listing-rentals', clinician?.id],
    queryFn: async () => {
      if (!clinician?.id) return [];
      console.log('Fetching listing rentals for:', clinician.id);

      const { data: myListings, error: listingsError } = await supabase
        .from('marketplace_listings')
        .select('id')
        .eq('clinician_id', clinician.id);

      if (listingsError || !myListings?.length) {
        if (listingsError) console.log('Listing IDs fetch error:', listingsError);
        return [];
      }

      const listingIds = myListings.map((l: { id: string }) => l.id);

      const { data, error } = await supabase
        .from('marketplace_rentals')
        .select('*, marketplace_listings(*, exercise_library(title_en, title_zh_hant, category))')
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Listing rentals fetch error:', error);
        throw error;
      }
      return (data || []) as MarketplaceRental[];
    },
    enabled: !!clinician?.id,
  });

  const currentData = activeTab === 'renting' ? myRentalsQuery.data : listingRentalsQuery.data;
  const currentQuery = activeTab === 'renting' ? myRentalsQuery : listingRentalsQuery;

  const renderRental = useCallback(
    ({ item }: { item: MarketplaceRental }) => (
      <RentalCard rental={item} tab={activeTab} clinicianId={clinician?.id} />
    ),
    [activeTab, clinician?.id]
  );

  const keyExtractor = useCallback((item: MarketplaceRental) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rental Logbook 租借記錄</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'renting' && styles.tabActive]}
          onPress={() => setActiveTab('renting')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'renting' && styles.tabTextActive]}>
            My Rentals 我的租借
          </Text>
          {myRentalsQuery.data && myRentalsQuery.data.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'renting' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'renting' && styles.tabBadgeTextActive]}>
                {myRentalsQuery.data.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'listings' && styles.tabActive]}
          onPress={() => setActiveTab('listings')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'listings' && styles.tabTextActive]}>
            My Listings 我的上架
          </Text>
          {listingRentalsQuery.data && listingRentalsQuery.data.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'listings' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'listings' && styles.tabBadgeTextActive]}>
                {listingRentalsQuery.data.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {currentQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading rentals...</Text>
        </View>
      ) : currentQuery.isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load rentals</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void currentQuery.refetch()}>
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentData || []}
          renderItem={renderRental}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={currentQuery.isRefetching}
              onRefresh={() => void currentQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <BookOpen size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>
                {activeTab === 'renting' ? 'No rentals yet' : 'No rental requests'}
              </Text>
              <Text style={styles.emptyTextSub}>
                {activeTab === 'renting' ? '尚無租借記錄' : '尚無租借請求'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const RentalCard = React.memo(function RentalCard({
  rental,
  tab,
  clinicianId,
}: {
  rental: MarketplaceRental;
  tab: 'renting' | 'listings';
  clinicianId?: string;
}) {
  const queryClient = useQueryClient();
  const [showReviewModal, setShowReviewModal] = useState(false);

  const listing = rental.marketplace_listings;
  const title = listing?.display_name || listing?.exercise_library?.title_en || 'Untitled';
  const titleZh = listing?.exercise_library?.title_zh_hant;
  const category = listing?.category || listing?.exercise_library?.category;
  const statusInfo = getStatusInfo(rental.status);
  const fee = rental.total_fee ?? 0;
  const rate = rental.hkd_per_day ?? rental.total_fee ? Math.round((rental.total_fee || 0) / Math.max(1, Math.ceil((new Date(rental.end_date).getTime() - new Date(rental.start_date).getTime()) / 86400000))) : 0;
  const startDate = rental.start_date ? new Date(rental.start_date).toLocaleDateString() : '-';
  const endDate = rental.end_date ? new Date(rental.end_date).toLocaleDateString() : '-';
  const isExpired = rental.end_date ? new Date(rental.end_date) < new Date() : false;
  const canReview = tab === 'renting' && (rental.status === 'active' || rental.status === 'expired') && !rental.review_rating;
  const canExtend = tab === 'renting' && rental.status === 'active' && !isExpired;
  const canCancel = rental.status === 'pending';
  const canDispute = tab === 'renting' && rental.status === 'active';

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketplace_rentals')
        .update({ status: 'cancelled' })
        .eq('id', rental.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-rentals'] });
      void queryClient.invalidateQueries({ queryKey: ['listing-rentals'] });
      Alert.alert('Cancelled 已取消', 'Rental has been cancelled.\n租借已取消。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketplace_rentals')
        .update({ status: 'disputed' })
        .eq('id', rental.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-rentals'] });
      Alert.alert('Dispute Filed 已提出爭議', 'An admin will review this dispute.\n管理員將審查此爭議。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const extendMutation = useMutation({
    mutationFn: async (extraDays: number) => {
      const currentEnd = new Date(rental.end_date);
      const newEnd = new Date(currentEnd.getTime() + extraDays * 86400000).toISOString().split('T')[0];
      const extraFee = rate * extraDays;
      const { error } = await supabase
        .from('marketplace_rentals')
        .update({
          end_date: newEnd,
          total_fee: fee + extraFee,
        })
        .eq('id', rental.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-rentals'] });
      Alert.alert('Extended 已延長', 'Rental period has been extended.\n租借期限已延長。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Rental 取消租借', 'Are you sure?\n確定取消？', [
      { text: 'No 否', style: 'cancel' },
      { text: 'Yes 是', style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  }, [cancelMutation]);

  const handleExtend = useCallback(() => {
    Alert.alert('Extend Rental 延長租借', 'Extend by how many days?\n延長多少天？', [
      { text: 'Cancel 取消', style: 'cancel' },
      { text: '7 days', onPress: () => extendMutation.mutate(7) },
      { text: '14 days', onPress: () => extendMutation.mutate(14) },
      { text: '30 days', onPress: () => extendMutation.mutate(30) },
    ]);
  }, [extendMutation]);

  const handleDispute = useCallback(() => {
    Alert.alert(
      'File Dispute 提出爭議',
      'Are you sure you want to file a dispute? An admin will review it.\n確定要提出爭議嗎？管理員將審查。',
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'File Dispute 提出', style: 'destructive', onPress: () => disputeMutation.mutate() },
      ]
    );
  }, [disputeMutation]);

  return (
    <>
      <View style={styles.rentalCard} testID={`rental-${rental.id}`}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            {titleZh ? <Text style={styles.cardTitleZh} numberOfLines={1}>{titleZh}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.icon} {rental.status}
            </Text>
          </View>
        </View>

        {category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{category}</Text>
          </View>
        )}

        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <Calendar size={12} color={Colors.textSecondary} />
            <Text style={styles.dateLabel}>Start:</Text>
            <Text style={styles.dateValue}>{startDate}</Text>
          </View>
          <View style={styles.dateItem}>
            <Clock size={12} color={isExpired ? Colors.danger : Colors.textSecondary} />
            <Text style={[styles.dateLabel, isExpired && { color: Colors.danger }]}>End:</Text>
            <Text style={[styles.dateValue, isExpired && { color: Colors.danger }]}>{endDate}</Text>
          </View>
        </View>

        <View style={styles.feeRow}>
          <View style={styles.feeItem}>
            <DollarSign size={13} color={Colors.accent} />
            <Text style={styles.feeValue}>HKD ${rate}/day</Text>
          </View>
          <View style={styles.feeItem}>
            <Text style={styles.feeTotal}>Total: HKD ${fee.toFixed(2)}</Text>
          </View>
        </View>

        {rental.review_rating && (
          <View style={styles.reviewRow}>
            <Star size={12} color="#F5A623" fill="#F5A623" />
            <Text style={styles.reviewRating}>{rental.review_rating}/5</Text>
            {rental.review_text ? (
              <Text style={styles.reviewText} numberOfLines={1}>{rental.review_text}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.actionsRow}>
          {canExtend && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleExtend} activeOpacity={0.7}>
              <RefreshCw size={13} color={Colors.info} />
              <Text style={styles.actionBtnText}>Extend</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleCancel} activeOpacity={0.7}>
              <XCircle size={13} color={Colors.danger} />
              <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          {canReview && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAccent]}
              onPress={() => setShowReviewModal(true)}
              activeOpacity={0.7}
            >
              <Star size={13} color={Colors.accent} />
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Review</Text>
            </TouchableOpacity>
          )}
          {canDispute && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarning]} onPress={handleDispute} activeOpacity={0.7}>
              <AlertOctagon size={13} color={Colors.warning} />
              <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Dispute</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showReviewModal && (
        <ReviewModal
          rentalId={rental.id}
          listingId={rental.listing_id}
          clinicianId={clinicianId}
          visible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </>
  );
});

function ReviewModal({
  rentalId,
  listingId,
  clinicianId,
  visible,
  onClose,
}: {
  rentalId: string;
  listingId: string;
  clinicianId?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!clinicianId) throw new Error('Not authenticated');

      const { error: reviewError } = await supabase.from('marketplace_reviews').insert({
        rental_id: rentalId,
        listing_id: listingId,
        reviewer_clinician_id: clinicianId,
        rating,
        review_text: reviewText.trim() || null,
      });

      if (reviewError) {
        console.log('Review insert error (table may not exist):', reviewError);
      }

      const { error: rentalError } = await supabase
        .from('marketplace_rentals')
        .update({
          review_rating: rating,
          review_text: reviewText.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rentalId);

      if (rentalError) throw rentalError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-rentals'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      onClose();
      Alert.alert('Review Submitted 已提交評價', 'Thank you for your review.\n感謝您的評價。');
    },
    onError: (error: Error) => {
      console.log('Review submit error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.reviewOverlay}>
        <View style={styles.reviewModal}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewHeaderTitle}>Leave a Review 留下評價</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                <Star
                  size={32}
                  color="#F5A623"
                  fill={s <= rating ? '#F5A623' : 'none'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.starsLabel}>{rating}/5</Text>

          <TextInput
            style={styles.reviewInput}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Write your review (optional)... 寫下評價（選填）..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />

          <View style={styles.reviewButtons}>
            <TouchableOpacity style={styles.reviewCancelBtn} onPress={onClose}>
              <Text style={styles.reviewCancelText}>Cancel 取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewSubmitBtn, submitMutation.isPending && { opacity: 0.6 }]}
              onPress={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Send size={14} color={Colors.white} />
                  <Text style={styles.reviewSubmitText}>Submit 提交</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  tabBadgeTextActive: {
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
    paddingTop: 6,
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
  rentalCard: {
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
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  cardTitleZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  categoryBadge: {
    backgroundColor: '#EDE9E3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
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
  dateValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  feeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  feeTotal: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewRating: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#F5A623',
  },
  reviewText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnDanger: {
    backgroundColor: Colors.dangerLight,
  },
  actionBtnAccent: {
    backgroundColor: Colors.accentLight + '60',
  },
  actionBtnWarning: {
    backgroundColor: Colors.warningLight,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.info,
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  reviewModal: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  reviewHeaderTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starsLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  reviewInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  reviewCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  reviewSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  reviewSubmitText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
