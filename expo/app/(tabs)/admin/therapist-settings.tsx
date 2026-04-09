import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Shield,
  UserCog,
  User,
  ImageIcon,
  CheckSquare,
  Square,
  Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface PatientTherapist {
  id: string;
  patient_name: string;
  therapist_name_en: string | null;
  therapist_name_zh: string | null;
  therapist_photo_url: string | null;
  therapist_cartoon_url: string | null;
  clinician_id: string | null;
}

export default function TherapistSettingsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientTherapist | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [cartoonUrl, setCartoonUrl] = useState('');

  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchNameEn, setBatchNameEn] = useState('');
  const [batchNameZh, setBatchNameZh] = useState('');
  const [batchPhotoUrl, setBatchPhotoUrl] = useState('');
  const [batchCartoonUrl, setBatchCartoonUrl] = useState('');
  const [updateNameEn, setUpdateNameEn] = useState(true);
  const [updateNameZh, setUpdateNameZh] = useState(true);
  const [updatePhoto, setUpdatePhoto] = useState(false);
  const [updateCartoon, setUpdateCartoon] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['admin-therapist-settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, therapist_name_en, therapist_name_zh, therapist_photo_url, therapist_cartoon_url, clinician_id')
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientTherapist[];
      } catch (e) {
        console.log('Error fetching patients for therapist settings:', e);
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!search.trim()) return patientsQuery.data;
    const s = search.toLowerCase();
    return patientsQuery.data.filter(
      p =>
        p.patient_name?.toLowerCase().includes(s) ||
        p.therapist_name_en?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, search]);

  const openEdit = useCallback((patient: PatientTherapist) => {
    setEditingPatient(patient);
    setNameEn(patient.therapist_name_en || '');
    setNameZh(patient.therapist_name_zh || '');
    setPhotoUrl(patient.therapist_photo_url || '');
    setCartoonUrl(patient.therapist_cartoon_url || '');
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingPatient) throw new Error('No patient selected');
      const { error } = await supabase
        .from('patients')
        .update({
          therapist_name_en: nameEn.trim() || null,
          therapist_name_zh: nameZh.trim() || null,
          therapist_photo_url: photoUrl.trim() || null,
          therapist_cartoon_url: cartoonUrl.trim() || null,
        })
        .eq('id', editingPatient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-therapist-settings'] });
      setModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!filtered.length) return;
    const allIds = filtered.map(p => p.id);
    setSelectedIds(new Set(allIds));
  }, [filtered]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterBatchMode = useCallback(() => {
    setBatchMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const openBatchModal = useCallback(() => {
    if (selectedIds.size === 0) {
      Alert.alert('No Selection 未選擇', 'Please select at least one patient.\n請至少選擇一位患者。');
      return;
    }
    setBatchNameEn('');
    setBatchNameZh('');
    setBatchPhotoUrl('');
    setBatchCartoonUrl('');
    setUpdateNameEn(true);
    setUpdateNameZh(true);
    setUpdatePhoto(false);
    setUpdateCartoon(false);
    setBatchModalVisible(true);
  }, [selectedIds]);

  const batchMutation = useMutation({
    mutationFn: async () => {
      if (!updateNameEn && !updateNameZh && !updatePhoto && !updateCartoon) {
        throw new Error('Please select at least one field to update');
      }

      const updates: Record<string, unknown> = {};
      if (updateNameEn) updates.therapist_name_en = batchNameEn.trim() || null;
      if (updateNameZh) updates.therapist_name_zh = batchNameZh.trim() || null;
      if (updatePhoto) updates.therapist_photo_url = batchPhotoUrl.trim() || null;
      if (updateCartoon) updates.therapist_cartoon_url = batchCartoonUrl.trim() || null;

      const ids = Array.from(selectedIds);
      for (const patientId of ids) {
        const { error } = await supabase.from('patients').update(updates).eq('id', patientId);
        if (error) {
          console.log(`Batch update error for ${patientId}:`, error);
        }
      }
      return ids.length;
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-therapist-settings'] });
      setBatchModalVisible(false);
      exitBatchMode();
      Alert.alert(
        'Updated 已更新',
        `Updated ${count} patients 已更新 ${count} 位患者`
      );
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (batchMode) exitBatchMode(); else router.back(); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {batchMode ? 'Batch Edit 批量編輯' : 'Therapist Settings'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {batchMode ? `${selectedIds.size} selected 已選` : '治療師設定'}
            </Text>
          </View>
          {!batchMode ? (
            <TouchableOpacity onPress={enterBatchMode} style={styles.batchHeaderBtn}>
              <Users size={16} color={Colors.white} />
              <Text style={styles.batchHeaderBtnText}>Batch</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>

      {batchMode && (
        <View style={styles.batchBar}>
          <TouchableOpacity
            onPress={selectedIds.size === filtered.length ? deselectAll : selectAll}
            style={styles.batchSelectBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.batchSelectBtnText}>
              {selectedIds.size === filtered.length ? 'Deselect All 取消全選' : 'Select All 全選'}
            </Text>
          </TouchableOpacity>
          <View style={styles.batchCountBadge}>
            <Text style={styles.batchCountText}>{selectedIds.size}</Text>
          </View>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by patient or therapist name..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={patientsQuery.isFetching} onRefresh={() => void patientsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {patientsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <UserCog size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No patients found</Text>
            <Text style={styles.emptySubtext}>找不到患者</Text>
          </View>
        ) : (
          filtered.map(patient => {
            const isSelected = selectedIds.has(patient.id);
            return (
              <TouchableOpacity
                key={patient.id}
                style={[styles.card, batchMode && isSelected && styles.cardSelected]}
                onPress={() => batchMode ? toggleSelect(patient.id) : openEdit(patient)}
                activeOpacity={0.7}
              >
                <View style={styles.cardRow}>
                  {batchMode && (
                    <View style={styles.checkboxWrap}>
                      {isSelected ? (
                        <CheckSquare size={22} color={Colors.accent} />
                      ) : (
                        <Square size={22} color={Colors.border} />
                      )}
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.patientName} numberOfLines={1}>{patient.patient_name}</Text>
                    {patient.therapist_name_en || patient.therapist_name_zh ? (
                      <Text style={styles.therapistName} numberOfLines={1}>
                        {patient.therapist_name_en}{patient.therapist_name_zh ? ` / ${patient.therapist_name_zh}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.notSet}>Not set 未設定</Text>
                    )}
                  </View>
                  <View style={styles.thumbRow}>
                    {patient.therapist_photo_url ? (
                      <Image source={{ uri: patient.therapist_photo_url }} style={styles.thumbCircle} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <User size={18} color={Colors.textTertiary} />
                      </View>
                    )}
                    {patient.therapist_cartoon_url ? (
                      <Image source={{ uri: patient.therapist_cartoon_url }} style={styles.thumbSquare} />
                    ) : (
                      <View style={styles.thumbPlaceholderSquare}>
                        <ImageIcon size={18} color={Colors.textTertiary} />
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {batchMode && selectedIds.size > 0 && (
        <View style={styles.batchBottomBar}>
          <TouchableOpacity
            style={styles.batchApplyBtn}
            onPress={openBatchModal}
            activeOpacity={0.8}
          >
            <Text style={styles.batchApplyText}>
              Apply to {selectedIds.size} Selected 套用至 {selectedIds.size} 位
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Therapist</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.patientBanner}>
                <User size={20} color={Colors.accent} />
                <Text style={styles.patientBannerText}>{editingPatient?.patient_name}</Text>
              </View>

              <Text style={styles.fieldLabel}>Therapist Name (EN) 治療師名稱（英文）</Text>
              <TextInput style={styles.input} value={nameEn} onChangeText={setNameEn} placeholder="Dr. Jane Smith" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Therapist Name (ZH) 治療師名稱（中文）</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="陳醫生" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Photo URL 照片網址</Text>
              <TextInput style={styles.input} value={photoUrl} onChangeText={setPhotoUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
              {photoUrl.trim().length > 0 && (
                <Image source={{ uri: photoUrl }} style={styles.previewPhoto} resizeMode="cover" />
              )}

              <Text style={styles.fieldLabel}>Cartoon URL 卡通圖片網址</Text>
              <TextInput style={styles.input} value={cartoonUrl} onChangeText={setCartoonUrl} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="url" />
              {cartoonUrl.trim().length > 0 && (
                <Image source={{ uri: cartoonUrl }} style={styles.previewCartoon} resizeMode="cover" />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={batchModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setBatchModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Batch Update 批量更新</Text>
              <TouchableOpacity onPress={() => batchMutation.mutate()} disabled={batchMutation.isPending}>
                {batchMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.batchInfoBanner}>
                <Users size={18} color={Colors.accent} />
                <Text style={styles.batchInfoText}>
                  Updating {selectedIds.size} patients 更新 {selectedIds.size} 位患者
                </Text>
              </View>

              <Text style={styles.batchHint}>
                Check the fields you want to update. Unchecked fields will not be changed.
                {'\n'}勾選要更新的欄位。未勾選的欄位不會被更改。
              </Text>

              <BatchField
                label="Therapist Name (EN) 治療師名稱（英文）"
                checked={updateNameEn}
                onToggle={() => setUpdateNameEn(!updateNameEn)}
                value={batchNameEn}
                onChangeText={setBatchNameEn}
                placeholder="Dr. Jane Smith"
              />

              <BatchField
                label="Therapist Name (ZH) 治療師名稱（中文）"
                checked={updateNameZh}
                onToggle={() => setUpdateNameZh(!updateNameZh)}
                value={batchNameZh}
                onChangeText={setBatchNameZh}
                placeholder="陳醫生"
              />

              <BatchField
                label="Photo URL 照片網址"
                checked={updatePhoto}
                onToggle={() => setUpdatePhoto(!updatePhoto)}
                value={batchPhotoUrl}
                onChangeText={setBatchPhotoUrl}
                placeholder="https://..."
                keyboardType="url"
              />

              <BatchField
                label="Cartoon URL 卡通圖片網址"
                checked={updateCartoon}
                onToggle={() => setUpdateCartoon(!updateCartoon)}
                value={batchCartoonUrl}
                onChangeText={setBatchCartoonUrl}
                placeholder="https://..."
                keyboardType="url"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function BatchField({
  label, checked, onToggle, value, onChangeText, placeholder, keyboardType,
}: {
  label: string; checked: boolean; onToggle: () => void;
  value: string; onChangeText: (t: string) => void;
  placeholder: string; keyboardType?: 'default' | 'url';
}) {
  return (
    <View style={styles.batchFieldWrap}>
      <TouchableOpacity style={styles.batchFieldHeader} onPress={onToggle} activeOpacity={0.7}>
        {checked ? (
          <CheckSquare size={20} color={Colors.accent} />
        ) : (
          <Square size={20} color={Colors.border} />
        )}
        <Text style={[styles.batchFieldLabel, !checked && { color: Colors.textTertiary }]}>{label}</Text>
      </TouchableOpacity>
      {checked && (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          keyboardType={keyboardType || 'default'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  batchHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  batchHeaderBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.white },
  batchBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.accentLight,
  },
  batchSelectBtn: { paddingVertical: 4 },
  batchSelectBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  batchCountBadge: {
    backgroundColor: Colors.accent, borderRadius: 10, minWidth: 24, height: 24,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  batchCountText: { fontSize: 12, fontWeight: '700' as const, color: Colors.white },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10, padding: 14,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardSelected: { borderWidth: 2, borderColor: Colors.accent },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkboxWrap: { marginRight: 12 },
  cardInfo: { flex: 1, marginRight: 12 },
  patientName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  therapistName: { fontSize: 13, color: Colors.textSecondary },
  notSet: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' as const },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumbCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSecondary },
  thumbPlaceholder: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbSquare: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceSecondary },
  thumbPlaceholderSquare: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 6 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySubtext: { fontSize: 13, color: Colors.textTertiary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  batchBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
  },
  batchApplyBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  batchApplyText: { fontSize: 16, fontWeight: '700' as const, color: Colors.white },
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  saveText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accentLight,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  patientBannerText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accentDark },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  previewPhoto: {
    width: 80, height: 80, borderRadius: 40, marginTop: 10,
    backgroundColor: Colors.surfaceSecondary, alignSelf: 'center',
  },
  previewCartoon: {
    width: 80, height: 80, borderRadius: 16, marginTop: 10,
    backgroundColor: Colors.surfaceSecondary, alignSelf: 'center',
  },
  batchInfoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accentLight,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  batchInfoText: { fontSize: 15, fontWeight: '600' as const, color: Colors.accentDark },
  batchHint: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16,
  },
  batchFieldWrap: { marginBottom: 16 },
  batchFieldHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  batchFieldLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
});

