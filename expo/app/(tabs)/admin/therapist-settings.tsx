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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Therapist Settings</Text>
            <Text style={styles.headerSubtitle}>治療師設定</Text>
          </View>
        </View>
      </SafeAreaView>

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
          filtered.map(patient => (
            <TouchableOpacity key={patient.id} style={styles.card} onPress={() => openEdit(patient)} activeOpacity={0.7}>
              <View style={styles.cardRow}>
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
          ))
        )}
      </ScrollView>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  patientName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  therapistName: { fontSize: 13, color: Colors.textSecondary },
  notSet: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumbCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSecondary },
  thumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbSquare: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceSecondary },
  thumbPlaceholderSquare: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 6 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySubtext: { fontSize: 13, color: Colors.textTertiary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  saveText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  patientBannerText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accentDark },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignSelf: 'center',
  },
  previewCartoon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginTop: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignSelf: 'center',
  },
});
