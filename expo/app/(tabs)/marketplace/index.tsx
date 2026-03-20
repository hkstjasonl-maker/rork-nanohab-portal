import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  X,
  Star,
  Filter,
  ChevronDown,
  Check,
  ShoppingBag,
  ArrowUpDown,
  Tag,
  AlertTriangle,
  DollarSign,
  Store,
  Package,
  BookOpen,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { MarketplaceListing } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2;

const CATEGORIES = [
  'All',
  'Articulation',
  'Phonology',
  'Fluency',
  'Voice',
  'Language',
  'Swallowing',
  'Oral Motor',
  'Pragmatics',
  'Other',
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest 最新' },
  { key: 'price_low', label: 'Price: Low → High 價格低至高' },
  { key: 'price_high', label: 'Price: High → Low 價格高至低' },
  { key: 'rating', label: 'Top Rated 最高評分' },
];

export default function BrowseMarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isAdmin, clinician, clinicianCan } = useAuth();
  const canMarketplace = clinicianCan('marketplace');
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const listingsQuery = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: async () => {
      console.log('Fetching marketplace listings');
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*, exercise_library(*), clinicians(full_name, full_name_zh, organization)')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .gte('listing_end_date', today)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Marketplace listings fetch error:', error);
        throw error;
      }
      return (data || []) as MarketplaceListing[];
    },
  });

  const filteredListings = useMemo(() => {
    if (!listingsQuery.data) return [];
    let result = [...listingsQuery.data];

    if (selectedCategory !== 'All') {
      result = result.filter(
        (l) => l.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          l.exercise_library?.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (l) =>
          l.display_name?.toLowerCase().includes(lower) ||
          l.exercise_library?.title_en?.toLowerCase().includes(lower) ||
          l.exercise_library?.title_zh_hant?.toLowerCase().includes(lower) ||
          l.tags?.some((t) => t.toLowerCase().includes(lower))
      );
    }

    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => (a.daily_rate_hkd || 0) - (b.daily_rate_hkd || 0));
        break;
      case 'price_high':
        result.sort((a, b) => (b.daily_rate_hkd || 0) - (a.daily_rate_hkd || 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        break;
      default:
        break;
    }

    return result;
  }, [listingsQuery.data, searchText, selectedCategory, sortBy]);

  const rentMutation = useMutation({
    mutationFn: async ({ listingId, days }: { listingId: string; days: number }) => {
      if (!clinician?.id) throw new Error('Must be logged in as clinician');

      const listing = listingsQuery.data?.find((l) => l.id === listingId);
      if (!listing) throw new Error('Listing not found');

      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
      const rate = listing.daily_rate_hkd || 0;

      let discountPct = 0;
      if (listing.discount_tiers && listing.discount_tiers.length > 0) {
        const sorted = [...listing.discount_tiers].sort((a, b) => b.min_days - a.min_days);
        for (const tier of sorted) {
          if (days >= tier.min_days) {
            discountPct = tier.discount_pct;
            break;
          }
        }
      }

      const totalFee = Math.round(rate * days * (1 - discountPct / 100) * 100) / 100;

      const { error } = await supabase.from('marketplace_rentals').insert({
        listing_id: listingId,
        renting_clinician_id: clinician.id,
        owner_clinician_id: listing.clinician_id,
        status: 'pending',
        start_date: startDate,
        end_date: endDate,
        total_fee: totalFee,
        hkd_per_day: rate,
      });

      if (error) throw error;
      return { totalFee, days };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace-rentals'] });
      setSelectedListing(null);
      Alert.alert(
        'Request Sent 已發送請求',
        `Rental request for ${data.days} days submitted.\nTotal: HKD $${data.totalFee.toFixed(2)}\n\n租借請求已提交。`
      );
    },
    onError: (error: Error) => {
      console.log('Rent error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const renderListing = useCallback(
    ({ item }: { item: MarketplaceListing }) => (
      <ListingCard listing={item} onPress={() => setSelectedListing(item)} />
    ),
    []
  );

  const keyExtractor = useCallback((item: MarketplaceListing) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerRow}>
            <Store size={22} color={Colors.accent} />
            <Text style={styles.headerTitle}>Marketplace 市集</Text>
          </View>
          <View style={styles.navLinks}>
            {!isAdmin && canMarketplace && (
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => router.push('/marketplace/my-listings')}
                activeOpacity={0.7}
              >
                <Package size={14} color={Colors.accent} />
                <Text style={styles.navLinkText}>My Listings</Text>
                <ChevronRight size={12} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
            {!isAdmin && (
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => router.push('/marketplace/rental-logbook')}
                activeOpacity={0.7}
              >
                <BookOpen size={14} color={Colors.accent} />
                <Text style={styles.navLinkText}>Rentals</Text>
                <ChevronRight size={12} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.headerCount}>
          {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings 搜尋..."
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            testID="marketplace-search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <X size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedCategory !== 'All' && styles.filterChipActive]}
          onPress={() => setShowCategoryFilter(true)}
          activeOpacity={0.7}
        >
          <Filter size={13} color={selectedCategory !== 'All' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.filterChipText, selectedCategory !== 'All' && styles.filterChipTextActive]} numberOfLines={1}>
            {selectedCategory === 'All' ? 'Category' : selectedCategory}
          </Text>
          <ChevronDown size={12} color={selectedCategory !== 'All' ? Colors.white : Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => setShowSortModal(true)}
          activeOpacity={0.7}
        >
          <ArrowUpDown size={13} color={Colors.textSecondary} />
          <Text style={styles.filterChipText} numberOfLines={1}>
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label.split(' ')[0] || 'Sort'}
          </Text>
        </TouchableOpacity>
      </View>

      {listingsQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading marketplace...</Text>
        </View>
      ) : listingsQuery.isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load listings</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void listingsQuery.refetch()}>
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          renderItem={renderListing}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={listingsQuery.isRefetching}
              onRefresh={() => void listingsQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShoppingBag size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No listings found</Text>
              <Text style={styles.emptyTextSub}>找不到上架項目</Text>
            </View>
          }
        />
      )}

      <CategoryFilterModal
        visible={showCategoryFilter}
        selected={selectedCategory}
        onSelect={(cat) => { setSelectedCategory(cat); setShowCategoryFilter(false); }}
        onClose={() => setShowCategoryFilter(false)}
      />

      <SortModal
        visible={showSortModal}
        selected={sortBy}
        onSelect={(s) => { setSortBy(s); setShowSortModal(false); }}
        onClose={() => setShowSortModal(false)}
      />

      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          visible={true}
          onClose={() => setSelectedListing(null)}
          onRent={(days) => rentMutation.mutate({ listingId: selectedListing.id, days })}
          isRenting={rentMutation.isPending}
          isAdmin={isAdmin}
          clinicianId={clinician?.id}
        />
      )}
    </View>
  );
}

const ListingCard = React.memo(function ListingCard({
  listing,
  onPress,
}: {
  listing: MarketplaceListing;
  onPress: () => void;
}) {
  const title = listing.display_name || listing.exercise_library?.title_en || 'Untitled';
  const titleZh = listing.exercise_library?.title_zh_hant;
  const thumbnail = listing.screenshots?.[0];
  const rate = listing.daily_rate_hkd ?? 0;
  const rating = listing.avg_rating ?? 0;
  const ratingCount = listing.review_count ?? 0;

  return (
    <TouchableOpacity style={styles.listingCard} onPress={onPress} activeOpacity={0.7} testID={`listing-${listing.id}`}>
      <View style={styles.thumbnailContainer}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <ShoppingBag size={28} color={Colors.borderLight} />
          </View>
        )}
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>HKD ${rate}/day</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        {titleZh ? <Text style={styles.cardTitleZh} numberOfLines={1}>{titleZh}</Text> : null}

        {listing.tags && listing.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {listing.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{tag}</Text>
              </View>
            ))}
            {listing.tags.length > 2 && (
              <Text style={styles.tagMore}>+{listing.tags.length - 2}</Text>
            )}
          </View>
        )}

        <View style={styles.ratingRow}>
          {rating > 0 ? (
            <>
              <Star size={12} color="#F5A623" fill="#F5A623" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({ratingCount})</Text>
            </>
          ) : (
            <Text style={styles.noRating}>No reviews yet</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

function ListingDetailModal({
  listing,
  visible,
  onClose,
  onRent,
  isRenting,
  isAdmin,
  clinicianId,
}: {
  listing: MarketplaceListing;
  visible: boolean;
  onClose: () => void;
  onRent: (days: number) => void;
  isRenting: boolean;
  isAdmin: boolean;
  clinicianId?: string;
}) {
  const [rentalDays, setRentalDays] = useState('7');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const screenshots = listing.screenshots || [];
  const title = listing.display_name || listing.exercise_library?.title_en || 'Untitled';
  const titleZh = listing.exercise_library?.title_zh_hant;
  const desc = listing.introduction || '';
  const descZh = '';
  const contra = listing.contraindications_patients || listing.contraindications_clinicians || '';
  const rate = listing.daily_rate_hkd ?? 0;
  const rating = listing.avg_rating ?? 0;
  const ratingCount = listing.review_count ?? 0;
  const ownerName = listing.clinicians?.full_name || 'Unknown';
  const ownerClinic = listing.clinicians?.organization;
  const isOwn = listing.clinician_id === clinicianId;
  const days = parseInt(rentalDays, 10) || 0;

  let discountPct = 0;
  if (listing.discount_tiers && listing.discount_tiers.length > 0 && days > 0) {
    const sorted = [...listing.discount_tiers].sort((a, b) => b.min_days - a.min_days);
    for (const tier of sorted) {
      if (days >= tier.min_days) {
        discountPct = tier.discount_pct;
        break;
      }
    }
  }
  const totalFee = days > 0 ? Math.round(rate * days * (1 - discountPct / 100) * 100) / 100 : 0;

  const handleRent = useCallback(() => {
    if (days < 1) {
      Alert.alert('Invalid Days', 'Please enter at least 1 day.\n請輸入至少1天。');
      return;
    }
    Alert.alert(
      'Confirm Rental 確認租借',
      `Rent for ${days} days\nRate: HKD $${rate}/day${discountPct > 0 ? `\nDiscount: ${discountPct}%` : ''}\nTotal: HKD $${totalFee.toFixed(2)}`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Confirm 確認', onPress: () => onRent(days) },
      ]
    );
  }, [days, rate, discountPct, totalFee, onRent]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={onClose} style={styles.detailCloseBtn}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>Listing Details</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.detailBody} contentContainerStyle={styles.detailBodyContent} bounces showsVerticalScrollIndicator={false}>
          {screenshots.length > 0 && (
            <View style={styles.carouselContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40));
                  setCarouselIndex(idx);
                }}
              >
                {screenshots.map((uri, i) => (
                  <Image key={`ss-${i}`} source={{ uri }} style={styles.carouselImage} resizeMode="cover" />
                ))}
              </ScrollView>
              {screenshots.length > 1 && (
                <View style={styles.carouselDots}>
                  {screenshots.map((_, i) => (
                    <View key={`dot-${i}`} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.detailTitleSection}>
            <Text style={styles.detailTitle}>{title}</Text>
            {titleZh ? <Text style={styles.detailTitleZh}>{titleZh}</Text> : null}
          </View>

          <View style={styles.detailMeta}>
            <View style={styles.metaItem}>
              <DollarSign size={14} color={Colors.accent} />
              <Text style={styles.metaText}>HKD ${rate}/day</Text>
            </View>
            <View style={styles.metaItem}>
              <Star size={14} color="#F5A623" fill={rating > 0 ? "#F5A623" : "none"} />
              <Text style={styles.metaText}>
                {rating > 0 ? `${rating.toFixed(1)} (${ratingCount})` : 'No ratings'}
              </Text>
            </View>
          </View>

          <View style={styles.ownerSection}>
            <Text style={styles.ownerLabel}>Listed by 上架者</Text>
            <Text style={styles.ownerName}>{ownerName}</Text>
            {ownerClinic ? <Text style={styles.ownerClinic}>{ownerClinic}</Text> : null}
          </View>

          {listing.tags && listing.tags.length > 0 && (
            <View style={styles.detailTagsSection}>
              <Text style={styles.sectionLabel}>Tags 標籤</Text>
              <View style={styles.detailTagsRow}>
                {listing.tags.map((tag) => (
                  <View key={tag} style={styles.detailTag}>
                    <Tag size={10} color={Colors.accent} />
                    <Text style={styles.detailTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {desc ? (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>Description 描述</Text>
              <Text style={styles.descText}>{desc}</Text>
              {descZh ? <Text style={styles.descTextZh}>{descZh}</Text> : null}
            </View>
          ) : null}

          {contra ? (
            <View style={styles.contraSection}>
              <View style={styles.contraHeader}>
                <AlertTriangle size={14} color={Colors.warning} />
                <Text style={styles.contraLabel}>Contraindications 禁忌</Text>
              </View>
              <Text style={styles.contraText}>{contra}</Text>
            </View>
          ) : null}

          {listing.discount_tiers && listing.discount_tiers.length > 0 && (
            <View style={styles.discountSection}>
              <Text style={styles.sectionLabel}>Discount Tiers 折扣</Text>
              {listing.discount_tiers
                .sort((a, b) => a.min_days - b.min_days)
                .map((tier, i) => (
                  <View key={`tier-${i}`} style={styles.discountRow}>
                    <Text style={styles.discountDays}>{tier.min_days}+ days</Text>
                    <Text style={styles.discountPct}>{tier.discount_pct}% off</Text>
                  </View>
                ))}
            </View>
          )}

          {!isAdmin && !isOwn && (
            <View style={styles.rentSection}>
              <Text style={styles.sectionLabel}>Request to Rent 申請租借</Text>
              <View style={styles.rentInputRow}>
                <Text style={styles.rentInputLabel}>Days 天數</Text>
                <TextInput
                  style={styles.rentDaysInput}
                  value={rentalDays}
                  onChangeText={setRentalDays}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              {discountPct > 0 && (
                <Text style={styles.discountNote}>
                  {discountPct}% discount applied 已套用折扣
                </Text>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total 合計</Text>
                <Text style={styles.totalAmount}>HKD ${totalFee.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.rentButton, isRenting && styles.rentButtonDisabled]}
                onPress={handleRent}
                disabled={isRenting}
                activeOpacity={0.8}
              >
                {isRenting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.rentButtonText}>Request to Rent 申請租借</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isOwn && (
            <View style={styles.ownNotice}>
              <Text style={styles.ownNoticeText}>This is your listing 這是您的上架項目</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CategoryFilterModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string; onSelect: (cat: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.filterModal}>
          <Text style={styles.filterModalTitle}>Category 類別</Text>
          <ScrollView bounces={false} style={styles.filterList}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterOption, selected === cat && styles.filterOptionSelected]}
                onPress={() => onSelect(cat)}
              >
                <Text style={[styles.filterOptionText, selected === cat && styles.filterOptionTextSelected]}>
                  {cat}
                </Text>
                {selected === cat && <Check size={16} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function SortModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string; onSelect: (s: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.filterModal}>
          <Text style={styles.filterModalTitle}>Sort By 排序</Text>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterOption, selected === opt.key && styles.filterOptionSelected]}
              onPress={() => onSelect(opt.key)}
            >
              <Text style={[styles.filterOptionText, selected === opt.key && styles.filterOptionTextSelected]}>
                {opt.label}
              </Text>
              {selected === opt.key && <Check size={16} color={Colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navLinks: {
    flexDirection: 'row',
    gap: 6,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  navLinkText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
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
    maxWidth: 80,
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
    gap: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
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
  listingCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnailContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.7,
    backgroundColor: '#F0EDE8',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceTagText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 17,
  },
  cardTitleZh: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tagBadge: {
    backgroundColor: '#EDE9E3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tagMore: {
    fontSize: 9,
    color: Colors.textTertiary,
    alignSelf: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ratingCount: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  noRating: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  filterModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: 420,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  filterList: {
    maxHeight: 340,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  filterOptionSelected: {
    backgroundColor: Colors.accentLight + '40',
  },
  filterOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  filterOptionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  detailBody: {
    flex: 1,
  },
  detailBodyContent: {
    paddingBottom: 40,
  },
  carouselContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#F0EDE8',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: 220,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: Colors.white,
    width: 18,
  },
  detailTitleSection: {
    padding: 20,
    paddingBottom: 0,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  detailTitleZh: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  detailMeta: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ownerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  ownerLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 2,
  },
  ownerClinic: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  detailTagsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  detailTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight + '60',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailTagText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.accentDark,
  },
  descSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  descText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  descTextZh: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  contraSection: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
  },
  contraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  contraLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  contraText: {
    fontSize: 13,
    color: '#7A5A00',
    lineHeight: 19,
  },
  discountSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.successLight,
    borderRadius: 8,
    marginBottom: 6,
  },
  discountDays: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  discountPct: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  rentSection: {
    margin: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  rentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rentInputLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  rentDaysInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: 80,
    textAlign: 'center' as const,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discountNote: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.accent,
  },
  rentButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  rentButtonDisabled: {
    opacity: 0.6,
  },
  rentButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  ownNotice: {
    margin: 20,
    backgroundColor: Colors.infoLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  ownNoticeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.info,
  },
});
