import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Crown,
  Plus,
  X,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Search,
  Shield,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface TierRecord {
  id: string;
  name: string;
  description?: string;
  can_manage_patients?: boolean;
  can_create_programs?: boolean;
  can_use_shared_exercises?: boolean;
  can_upload_exercises?: boolean;
  can_assign_assessments?: boolean;
  can_view_dashboard?: boolean;
  can_push_knowledge_videos?: boolean;
  can_push_feeding_skills?: boolean;
  can_manage_reinforcement?: boolean;
  can_send_notifications?: boolean;
  can_marketplace?: boolean;
  can_view_patients?: boolean;
  can_edit_patients?: boolean;
  can_create_patients?: boolean;
  can_view_exercises?: boolean;
  can_create_exercises?: boolean;
  can_view_programs?: boolean;
  max_patients?: number | null;
  max_exercises?: number | null;
  max_programs_per_patient?: number | null;
  [key: string]: unknown;
}

interface PermissionToggle {
  key: string;
  labelEn: string;
  labelZh: string;
}

interface QuotaField {
  key: string;
  labelEn: string;
  labelZh: string;
}

const PERMISSION_TOGGLES: PermissionToggle[] = [
  { key: 'can_manage_patients', labelEn: 'Manage Patients', labelZh: '管理病人' },
  { key: 'can_view_patients', labelEn: 'View Patients', labelZh: '查看病人' },
  { key: 'can_edit_patients', labelEn: 'Edit Patients', labelZh: '編輯病人' },
  { key: 'can_create_patients', labelEn: 'Create Patients', labelZh: '新增病人' },
  { key: 'can_view_programs', labelEn: 'View Programs', labelZh: '查看療程' },
  { key: 'can_create_programs', labelEn: 'Create Programs', labelZh: '建立療程' },
  { key: 'can_view_exercises', labelEn: 'View Exercises', labelZh: '查看運動' },
  { key: 'can_create_exercises', labelEn: 'Create Exercises', labelZh: '新增運動' },
  { key: 'can_use_shared_exercises', labelEn: 'Use Shared Exercises', labelZh: '使用共享運動' },
  { key: 'can_upload_exercises', labelEn: 'Upload Exercises', labelZh: '上傳運動' },
  { key: 'can_assign_assessments', labelEn: 'Assign Assessments', labelZh: '分配評估' },
  { key: 'can_view_dashboard', labelEn: 'View Dashboard', labelZh: '查看儀表板' },
  { key: 'can_push_knowledge_videos', labelEn: 'Push Knowledge Videos', labelZh: '推送知識影片' },
  { key: 'can_push_feeding_skills', labelEn: 'Push Feeding Skills', labelZh: '推送餵食技巧' },
  { key: 'can_manage_reinforcement', labelEn: 'Manage Reinforcement', labelZh: '管理強化' },
  { key: 'can_send_notifications', labelEn: 'Send Notifications', labelZh: '發送通知' },
  { key: 'can_marketplace', labelEn: 'Use Marketplace', labelZh: '使用市場' },
];

const QUOTA_FIELDS: QuotaField[] = [
  { key: 'max_patients', labelEn: 'Max Patients', labelZh: '最大病人數' },
  { key: 'max_exercises', labelEn: 'Max Exercises', labelZh: '最大運動數' },
  { key: 'max_programs_per_patient', labelEn: 'Max Programs Per Patient', labelZh: '每位病人最大療程數' },
];

export default function TierManagementScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [newTierDescription, setNewTierDescription] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, unknown>>>({});

  const tiersQuery = useQuery({
    queryKey: ['admin-tier-management'],
    queryFn: async () => {
      console.log('Fetching tiers for tier management');
      try {
        const { data, error } = await supabase
          .from('clinician_tiers')
          .select('*')
          .order('name');
        if (error) {
          console.log('Tiers fetch error:', error);
          throw error;
        }
        console.log('Tiers fetched:', data?.length);
        return (data || []) as TierRecord[];
      } catch (e) {
        console.log('Tiers query exception:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ tierId, updates }: { tierId: string; updates: Record<string, unknown> }) => {
      console.log('Saving tier:', tierId, updates);
      const { error } = await supabase
        .from('clinician_tiers')
        .update(updates)
        .eq('id', tierId);
      if (error) {
        console.log('Tier save error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tier-management'] });
      Alert.alert('Success 成功', 'Tier updated 級別已更新');
      setPendingChanges({});
    },
    onError: (error: Error) => {
      console.log('Tier save mutation error:', error);
      Alert.alert('Error 錯誤', error.message + '\n\nSome fields may not be available until the database is updated.\n部分欄位可能需要更新資料庫後才能使用。');
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      console.log('Adding new tier:', name);
      const { error } = await supabase
        .from('clinician_tiers')
        .insert({ name, description: description || null });
      if (error) {
        console.log('Tier add error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tier-management'] });
      Alert.alert('Success 成功', 'Tier created 級別已建立');
      setShowAddModal(false);
      setNewTierName('');
      setNewTierDescription('');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tierId: string) => {
      console.log('Deleting tier:', tierId);
      const { error } = await supabase
        .from('clinician_tiers')
        .delete()
        .eq('id', tierId);
      if (error) {
        console.log('Tier delete error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tier-management'] });
      Alert.alert('Success 成功', 'Tier deleted 級別已刪除');
      setExpandedTierId(null);
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const filteredTiers = useMemo(() => {
    if (!tiersQuery.data) return [];
    if (!search.trim()) return tiersQuery.data;
    const q = search.toLowerCase().trim();
    return tiersQuery.data.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [tiersQuery.data, search]);

  const onRefresh = useCallback(() => {
    void tiersQuery.refetch();
  }, [tiersQuery]);

  const handleTogglePermission = useCallback((tierId: string, key: string, currentValue: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] || {}),
        [key]: !currentValue,
      },
    }));
  }, []);

  const handleQuotaChange = useCallback((tierId: string, key: string, value: string) => {
    const numVal = value === '' ? null : parseInt(value, 10);
    setPendingChanges(prev => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] || {}),
        [key]: isNaN(numVal as number) ? null : numVal,
      },
    }));
  }, []);

  const handleNameChange = useCallback((tierId: string, name: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] || {}),
        name,
      },
    }));
  }, []);

  const handleDescriptionChange = useCallback((tierId: string, description: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] || {}),
        description,
      },
    }));
  }, []);

  const getEffectiveValue = useCallback((tier: TierRecord, key: string) => {
    if (pendingChanges[tier.id] && key in pendingChanges[tier.id]) {
      return pendingChanges[tier.id][key];
    }
    return tier[key];
  }, [pendingChanges]);

  const hasPendingChanges = useCallback((tierId: string) => {
    return pendingChanges[tierId] && Object.keys(pendingChanges[tierId]).length > 0;
  }, [pendingChanges]);

  const handleSaveTier = useCallback((tierId: string) => {
    setPendingChanges(prev => {
      const updates = prev[tierId];
      if (!updates || Object.keys(updates).length === 0) return prev;
      saveMutation.mutate({ tierId, updates });
      return prev;
    });
  }, [saveMutation]);

  const handleDeleteTier = useCallback((tier: TierRecord) => {
    Alert.alert(
      'Delete Tier 刪除級別',
      `Are you sure you want to delete "${tier.name}"?\n確定要刪除「${tier.name}」嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        {
          text: 'Delete 刪除',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(tier.id),
        },
      ]
    );
  }, [deleteMutation]);

  const handleAddTier = useCallback(() => {
    if (!newTierName.trim()) {
      Alert.alert('Error 錯誤', 'Tier name is required 級別名稱為必填');
      return;
    }
    addMutation.mutate({ name: newTierName.trim(), description: newTierDescription.trim() });
  }, [newTierName, newTierDescription, addMutation]);

  const countEnabled = useCallback((tier: TierRecord) => {
    let count = 0;
    for (const p of PERMISSION_TOGGLES) {
      const val = getEffectiveValue(tier, p.key);
      if (val === true) count++;
    }
    return count;
  }, [getEffectiveValue]);

  const renderTierCard = useCallback(({ item: tier }: { item: TierRecord }) => {
    const isExpanded = expandedTierId === tier.id;
    const enabledCount = countEnabled(tier);
    const hasChanges = hasPendingChanges(tier.id);
    const effectiveName = (getEffectiveValue(tier, 'name') as string) || tier.name;

    return (
      <View style={styles.tierCard}>
        <TouchableOpacity
          style={styles.tierHeader}
          activeOpacity={0.7}
          onPress={() => setExpandedTierId(isExpanded ? null : tier.id)}
          testID={`tier-card-${tier.id}`}
        >
          <View style={styles.tierHeaderLeft}>
            <View style={styles.tierIconBox}>
              <Crown size={20} color="#D4A030" />
            </View>
            <View style={styles.tierHeaderInfo}>
              <Text style={styles.tierName} numberOfLines={1}>{effectiveName}</Text>
              <Text style={styles.tierMeta}>
                {enabledCount} permissions enabled · {enabledCount}/{PERMISSION_TOGGLES.length}
              </Text>
            </View>
          </View>
          <View style={styles.tierHeaderRight}>
            {hasChanges && (
              <View style={styles.unsavedDot} />
            )}
            {isExpanded ? (
              <ChevronUp size={20} color={Colors.textTertiary} />
            ) : (
              <ChevronDown size={20} color={Colors.textTertiary} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.tierBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tier Name 級別名稱</Text>
              <TextInput
                style={styles.textInput}
                value={(getEffectiveValue(tier, 'name') as string) ?? tier.name}
                onChangeText={(v) => handleNameChange(tier.id, v)}
                placeholder="Tier name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description 說明</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={(getEffectiveValue(tier, 'description') as string) ?? tier.description ?? ''}
                onChangeText={(v) => handleDescriptionChange(tier.id, v)}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.sectionDivider}>
              <Shield size={14} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Permissions 權限</Text>
            </View>

            {PERMISSION_TOGGLES.map((perm) => {
              const val = getEffectiveValue(tier, perm.key) as boolean;
              return (
                <View key={perm.key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Text style={styles.permissionLabel}>{perm.labelEn}</Text>
                    <Text style={styles.permissionLabelZh}>{perm.labelZh}</Text>
                  </View>
                  <Switch
                    value={!!val}
                    onValueChange={() => handleTogglePermission(tier.id, perm.key, !!val)}
                    trackColor={{ false: Colors.border, true: Colors.accentLight }}
                    thumbColor={val ? Colors.accent : Colors.textTertiary}
                  />
                </View>
              );
            })}

            <View style={styles.sectionDivider}>
              <Crown size={14} color="#D4A030" />
              <Text style={styles.sectionTitle}>Quotas 配額</Text>
            </View>

            <Text style={styles.quotaHint}>Leave blank for unlimited 留空代表無限制</Text>

            {QUOTA_FIELDS.map((quota) => {
              const val = getEffectiveValue(tier, quota.key);
              return (
                <View key={quota.key} style={styles.quotaRow}>
                  <View style={styles.quotaInfo}>
                    <Text style={styles.quotaLabel}>{quota.labelEn}</Text>
                    <Text style={styles.quotaLabelZh}>{quota.labelZh}</Text>
                  </View>
                  <TextInput
                    style={styles.quotaInput}
                    value={val != null && val !== undefined ? String(Number(val)) : ''}
                    onChangeText={(v) => handleQuotaChange(tier.id, quota.key, v)}
                    keyboardType="number-pad"
                    placeholder="∞"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              );
            })}

            <View style={styles.tierActions}>
              <TouchableOpacity
                style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
                onPress={() => handleSaveTier(tier.id)}
                disabled={!hasChanges || saveMutation.isPending}
                activeOpacity={0.7}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Save size={16} color={Colors.white} />
                    <Text style={styles.saveBtnText}>Save 儲存</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteTier(tier)}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Delete 刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }, [expandedTierId, getEffectiveValue, hasPendingChanges, countEnabled, handleTogglePermission, handleQuotaChange, handleNameChange, handleDescriptionChange, handleSaveTier, handleDeleteTier, saveMutation.isPending]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required{'\n'}需要管理員權限</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Crown size={20} color={Colors.white} />
            <View>
              <Text style={styles.headerTitle}>Tier Management</Text>
              <Text style={styles.headerSubtitle}>級別管理</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchBar}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tiers... 搜尋級別..."
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      {tiersQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading tiers... 載入級別中...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTiers}
          keyExtractor={(item) => item.id}
          renderItem={renderTierCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={tiersQuery.isFetching && !tiersQuery.isLoading} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Crown size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No tiers found{'\n'}未找到級別</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
        testID="add-tier-fab"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Tier 新增級別</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tier Name 級別名稱 *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTierName}
                  onChangeText={setNewTierName}
                  placeholder="e.g. Basic, Standard, Premium"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description 說明</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={newTierDescription}
                  onChangeText={setNewTierDescription}
                  placeholder="Description (optional)"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <Text style={styles.addHint}>
                You can configure permissions and quotas after creating the tier.
                {'\n'}建立級別後即可設定權限與配額。
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel 取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleAddTier}
                disabled={addMutation.isPending}
                activeOpacity={0.7}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.createBtnText}>Create 建立</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: Colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  tierCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  tierHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tierIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FDF6E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierHeaderInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  tierMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tierHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  tierBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  fieldGroup: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  permissionLabelZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  quotaHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  quotaInfo: {
    flex: 1,
    marginRight: 12,
  },
  quotaLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  quotaLabelZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  quotaInput: {
    width: 80,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  tierActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.textTertiary,
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noAccessText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  addHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 16,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  createBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
