import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import {
  Plus,
  Check,
  Package,
  TrendingUp,
  DollarSign,
  Eye,
  CircleDot,
  ChevronLeft,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { MarketplaceListing, Exercise } from '@/types';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

function getApprovalInfo(status: ApprovalStatus) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', color: Colors.success, bg: Colors.successLight, icon: '🟢' };
    case 'rejected':
      return { label: 'Rejected', color: Colors.danger, bg: Colors.dangerLight, icon: '🔴' };
    case 'pending':
    default:
      return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight, icon: '🟡' };
  }
}

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clinician, isAdmin, clinicianCan } = useAuth();
  const canListMarketplace = isAdmin || clinicianCan('upload_exercises');
  const [showAddModal, setShowAddModal] = useState(false);

  const listingsQuery = useQuery({
    queryKey: ['my-listings', clinician?.id],
    queryFn: async () => {
      if (!clinician?.id) return [];
      console.log('Fetching my listings for clinician:', clinician.id);
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*, exercise_library(*)')
        .eq('clinician_id', clinician.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('My listings fetch error:', error);
        throw error;
      }
      return (data || []) as MarketplaceListing[];
    },
    enabled: !!clinician?.id,
  });

  const rentalCountsQuery = useQuery({
    queryKey: ['my-listing-rental-counts', clinician?.id],
    queryFn: async () => {
      if (!clinician?.id || !listingsQuery.data?.length) return {} as Record<string, number>;
      const listingIds = listingsQuery.data.map((l) => l.id);
      const { data, error } = await supabase
        .from('marketplace_rentals')
        .select('listing_id, status')
        .in('listing_id', listingIds)
        .eq('status', 'active');

      if (error) {
        console.log('Rental counts error:', error);
        return {} as Record<string, number>;
      }

      const counts: Record<string, number> = {};
      (data || []).forEach((r: { listing_id: string }) => {
        counts[r.listing_id] = (counts[r.listing_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!clinician?.id && !!listingsQuery.data?.length,
  });

  const stats = useMemo(() => {
    if (!listingsQuery.data) return { total: 0, approved: 0, totalEarned: 0 };
    const approved = listingsQuery.data.filter((l) => l.approval_status === 'approved').length;
    const totalRentals = listingsQuery.data.reduce((sum, l) => sum + (l.total_rentals || 0), 0);
    return { total: listingsQuery.data.length, approved, totalRentals };
  }, [listingsQuery.data]);

  const totalActiveRentals = useMemo(() => {
    if (!rentalCountsQuery.data) return 0;
    return Object.values(rentalCountsQuery.data).reduce((a, b) => a + b, 0);
  }, [rentalCountsQuery.data]);

  const renderListing = useCallback(
    ({ item }: { item: MarketplaceListing }) => {
      const activeRentals = rentalCountsQuery.data?.[item.id] || 0;
      return <MyListingCard listing={item} activeRentals={activeRentals} />;
    },
    [rentalCountsQuery.data]
  );

  const keyExtractor = useCallback((item: MarketplaceListing) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Listings 我的上架</Text>
          <Text style={styles.headerCount}>{stats.total} listing{stats.total !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Eye size={16} color={Colors.accent} />
          <Text style={styles.statValue}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingUp size={16} color={Colors.success} />
          <Text style={styles.statValue}>{totalActiveRentals}</Text>
          <Text style={styles.statLabel}>Renting</Text>
        </View>
        <View style={styles.statCard}>
          <DollarSign size={16} color="#F5A623" />
          <Text style={styles.statValue}>{stats.totalRentals}</Text>
          <Text style={styles.statLabel}>Rentals</Text>
        </View>
      </View>

      {listingsQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading listings...</Text>
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
          data={listingsQuery.data}
          renderItem={renderListing}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={listingsQuery.isRefetching}
              onRefresh={() => {
                void listingsQuery.refetch();
                void rentalCountsQuery.refetch();
              }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No listings yet</Text>
              <Text style={styles.emptyTextSub}>尚未上架任何項目</Text>
            </View>
          }
        />
      )}

      {canListMarketplace && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 24 }]}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
          testID="add-listing-button"
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}

      {!canListMarketplace && (
        <View style={styles.permissionBanner}>
          <ShieldAlert size={16} color={Colors.warning} />
          <Text style={styles.permissionBannerText}>
            You don't have permission to create listings. Contact admin.
            您沒有上架權限，請聯繫管理員。
          </Text>
        </View>
      )}

      <NewListingModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        clinicianId={clinician?.id}
      />
    </View>
  );
}

const MyListingCard = React.memo(function MyListingCard({
  listing,
  activeRentals,
}: {
  listing: MarketplaceListing;
  activeRentals: number;
}) {
  const title = listing.display_name || listing.exercise_library?.title_en || 'Untitled';
  const titleZh = listing.exercise_library?.title_zh_hant;
  const approvalInfo = getApprovalInfo(listing.approval_status);
  const rate = listing.daily_rate_hkd ?? 0;
  const totalRentals = listing.total_rentals ?? 0;

  return (
    <View style={styles.listingCard} testID={`my-listing-${listing.id}`}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          {titleZh ? <Text style={styles.cardTitleZh} numberOfLines={1}>{titleZh}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: approvalInfo.bg }]}>
          <Text style={[styles.statusText, { color: approvalInfo.color }]}>
            {approvalInfo.icon} {listing.approval_status}
          </Text>
        </View>
      </View>

      <View style={styles.cardMetaRow}>
        <View style={styles.cardMeta}>
          <DollarSign size={13} color={Colors.textSecondary} />
          <Text style={styles.cardMetaText}>HKD ${rate}/day</Text>
        </View>
        <View style={styles.cardMeta}>
          <CircleDot size={13} color={activeRentals > 0 ? Colors.success : Colors.textTertiary} />
          <Text style={[styles.cardMetaText, activeRentals > 0 && { color: Colors.success, fontWeight: '600' as const }]}>
            {activeRentals} active rental{activeRentals !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.earnedBadge}>
          <Text style={styles.earnedText}>Total Rentals: {totalRentals}</Text>
        </View>
        {!listing.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveText}>Inactive</Text>
          </View>
        )}
      </View>
    </View>
  );
});

function NewListingModal({
  visible,
  onClose,
  clinicianId,
}: {
  visible: boolean;
  onClose: () => void;
  clinicianId?: string;
}) {
  const queryClient = useQueryClient();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [title, setTitle] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [contraindications, setContraindications] = useState('');
  const [hkdPerDay, setHkdPerDay] = useState('');
  const [tags, setTags] = useState('');
  const [endDate, setEndDate] = useState('');

  const exercisesQuery = useQuery({
    queryKey: ['my-listable-exercises', clinicianId],
    queryFn: async () => {
      if (!clinicianId) return [];
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .eq('created_by_clinician_id', clinicianId)
        .eq('media_status', 'active')
        .order('title_en', { ascending: true });

      if (error) {
        console.log('Listable exercises error:', error);
        throw error;
      }
      return (data || []) as Exercise[];
    },
    enabled: visible && !!clinicianId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clinicianId || !selectedExercise) throw new Error('Missing data');

      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const end = endDate.trim() || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

      const { error } = await supabase.from('marketplace_listings').insert({
        exercise_library_id: selectedExercise.id,
        clinician_id: clinicianId,
        display_name: title.trim() || selectedExercise.title_en,
        introduction: description.trim() || null,
        contraindications_patients: contraindications.trim() || null,
        category: selectedExercise.category || null,
        tags: tagArray.length > 0 ? tagArray : null,
        daily_rate_hkd: parseFloat(hkdPerDay) || 0,
        approval_status: 'pending',
        is_active: true,
        listing_start_date: new Date().toISOString().split('T')[0],
        listing_end_date: end,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      resetForm();
      onClose();
      Alert.alert(
        'Listing Submitted 已提交上架',
        'Your listing is pending admin approval.\n您的上架申請正等待管理員批准。'
      );
    },
    onError: (error: Error) => {
      console.log('Create listing error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const resetForm = useCallback(() => {
    setSelectedExercise(null);
    setTitle('');
    setTitleZh('');
    setDescription('');
    setDescriptionZh('');
    setContraindications('');
    setHkdPerDay('');
    setTags('');
    setEndDate('');
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedExercise) {
      Alert.alert('Select Exercise', 'Please select an exercise to list.\n請選擇要上架的運動。');
      return;
    }
    if (!hkdPerDay || parseFloat(hkdPerDay) <= 0) {
      Alert.alert('Set Price', 'Please set a valid price per day.\n請設定有效的每日價格。');
      return;
    }
    createMutation.mutate();
  }, [selectedExercise, hkdPerDay, createMutation]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
            <Text style={styles.modalCancel}>Cancel 取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Listing 新上架</Text>
          <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.modalSave}>Submit 提交</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.formSectionTitle}>Select Exercise 選擇運動</Text>
          <Text style={styles.formHint}>Only your exercises with active media can be listed.</Text>

          {exercisesQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 12 }} />
          ) : exercisesQuery.data && exercisesQuery.data.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exercisePicker}>
              {exercisesQuery.data.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  style={[styles.exercisePickerItem, selectedExercise?.id === ex.id && styles.exercisePickerItemSelected]}
                  onPress={() => {
                    setSelectedExercise(ex);
                    if (!title.trim()) setTitle(ex.title_en || '');
                    if (!titleZh.trim()) setTitleZh(ex.title_zh_hant || '');
                  }}
                >
                  <Text
                    style={[styles.exercisePickerText, selectedExercise?.id === ex.id && styles.exercisePickerTextSelected]}
                    numberOfLines={2}
                  >
                    {ex.title_en}
                  </Text>
                  {selectedExercise?.id === ex.id && <Check size={14} color={Colors.white} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noExercisesBox}>
              <Text style={styles.noExercisesText}>No eligible exercises found. Create an exercise with active media status first.</Text>
            </View>
          )}

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Listing Title 標題</Text>
            <TextInput style={styles.formInput} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={Colors.textTertiary} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Chinese Title 中文標題</Text>
            <TextInput style={styles.formInput} value={titleZh} onChangeText={setTitleZh} placeholder="中文標題" placeholderTextColor={Colors.textTertiary} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Description 描述</Text>
            <TextInput style={[styles.formInput, styles.formInputMultiline]} value={description} onChangeText={setDescription} placeholder="Describe your exercise listing..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Chinese Description 中文描述</Text>
            <TextInput style={[styles.formInput, styles.formInputMultiline]} value={descriptionZh} onChangeText={setDescriptionZh} placeholder="中文描述..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Contraindications 禁忌</Text>
            <TextInput style={[styles.formInput, styles.formInputMultiline]} value={contraindications} onChangeText={setContraindications} placeholder="Any contraindications..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Price (HKD/day) 每日價格 *</Text>
            <TextInput style={styles.formInput} value={hkdPerDay} onChangeText={setHkdPerDay} placeholder="e.g. 15" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Tags 標籤 (comma separated)</Text>
            <TextInput style={styles.formInput} value={tags} onChangeText={setTags} placeholder="e.g. articulation, kids, beginner" placeholderTextColor={Colors.textTertiary} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>End Date 結束日期 (YYYY-MM-DD)</Text>
            <TextInput style={styles.formInput} value={endDate} onChangeText={setEndDate} placeholder="Default: 90 days from now" placeholderTextColor={Colors.textTertiary} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: 20,
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
  listingCard: {
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
  cardHeader: {
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
  cardMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  earnedBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  earnedText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#F5A623',
  },
  inactiveBadge: {
    backgroundColor: Colors.frozenLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.frozen,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  modalCancel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalSave: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  formHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: -10,
  },
  exercisePicker: {
    flexDirection: 'row',
  },
  exercisePickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    maxWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exercisePickerItemSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  exercisePickerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  exercisePickerTextSelected: {
    color: Colors.white,
  },
  noExercisesBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 14,
  },
  noExercisesText: {
    fontSize: 13,
    color: '#7A5A00',
    lineHeight: 18,
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  formInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  permissionBanner: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 12,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#7A5A00',
    lineHeight: 17,
  },
});
