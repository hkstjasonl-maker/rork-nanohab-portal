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
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  User,
  Snowflake,
  Sun,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Patient } from '@/types';

export default function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, clinician } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['patients', isAdmin, clinician?.id],
    queryFn: async () => {
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && clinician?.id) {
        query = query.eq('clinician_id', clinician.id);
      }

      const { data, error } = await query;
      if (error) {
        console.log('Patients fetch error:', error);
        throw error;
      }
      return (data || []) as Patient[];
    },
  });

  const filteredPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!searchText.trim()) return patientsQuery.data;

    const lower = searchText.toLowerCase();
    return patientsQuery.data.filter(
      (p) =>
        p.patient_name?.toLowerCase().includes(lower) ||
        p.patient_name_zh?.toLowerCase().includes(lower) ||
        p.access_code?.toLowerCase().includes(lower) ||
        p.diagnosis?.toLowerCase().includes(lower)
    );
  }, [patientsQuery.data, searchText]);

  const freezeMutation = useMutation({
    mutationFn: async ({ id, isFrozen }: { id: string; isFrozen: boolean }) => {
      const { error } = await supabase
        .from('patients')
        .update({ is_frozen: isFrozen })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-patients'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleFreeze = useCallback(
    (patient: Patient) => {
      const action = patient.is_frozen ? 'unfreeze' : 'freeze';
      const actionZh = patient.is_frozen ? '解凍' : '凍結';
      Alert.alert(
        `${action.charAt(0).toUpperCase() + action.slice(1)} Patient ${actionZh}患者`,
        `Are you sure you want to ${action} ${patient.patient_name}?\n確定要${actionZh} ${patient.patient_name} 嗎？`,
        [
          { text: 'Cancel 取消', style: 'cancel' },
          {
            text: `${action.charAt(0).toUpperCase() + action.slice(1)} ${actionZh}`,
            style: patient.is_frozen ? 'default' : 'destructive',
            onPress: () =>
              freezeMutation.mutate({
                id: patient.id,
                isFrozen: !patient.is_frozen,
              }),
          },
        ]
      );
    },
    [freezeMutation]
  );

  const renderPatient = useCallback(
    ({ item }: { item: Patient }) => (
      <PatientCard
        patient={item}
        onPress={() => router.push(`/patient/${item.id}`)}
        onFreeze={() => handleFreeze(item)}
      />
    ),
    [router, handleFreeze]
  );

  const keyExtractor = useCallback((item: Patient) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients 患者</Text>
        <Text style={styles.headerCount}>
          {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, code, diagnosis..."
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            testID="patient-search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <X size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {patientsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading patients...</Text>
        </View>
      ) : patientsQuery.isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load patients</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void patientsQuery.refetch()}
          >
            <Text style={styles.retryText}>Retry 重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPatients}
          renderItem={renderPatient}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={patientsQuery.isRefetching}
              onRefresh={() => void patientsQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <User size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>No patients found</Text>
              <Text style={styles.emptyTextZh}>找不到患者</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
        testID="add-patient-button"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <AddPatientModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        clinicianId={isAdmin ? undefined : clinician?.id}
      />
    </View>
  );
}

const PatientCard = React.memo(function PatientCard({
  patient,
  onPress,
  onFreeze,
}: {
  patient: Patient;
  onPress: () => void;
  onFreeze: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.patientCard, patient.is_frozen && styles.patientCardFrozen]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`patient-card-${patient.id}`}
    >
      <View style={styles.patientCardLeft}>
        <View style={[styles.avatarCircle, patient.is_frozen && styles.avatarCircleFrozen]}>
          <Text style={styles.avatarText}>
            {(patient.patient_name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName} numberOfLines={1}>
            {patient.patient_name}
            {patient.patient_name_zh ? ` ${patient.patient_name_zh}` : ''}
          </Text>
          <Text style={styles.patientCode}>{patient.access_code}</Text>
          {patient.diagnosis && (
            <Text style={styles.patientDiagnosis} numberOfLines={1}>
              {patient.diagnosis}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.patientCardRight}>
        <View style={[styles.statusBadge, patient.is_frozen ? styles.frozenBadge : styles.activeBadge]}>
          <Text style={[styles.statusText, patient.is_frozen ? styles.frozenText : styles.activeText]}>
            {patient.is_frozen ? 'Frozen 凍結' : 'Active 活躍'}
          </Text>
        </View>

        <View style={styles.patientActions}>
          <TouchableOpacity
            onPress={onFreeze}
            style={styles.freezeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {patient.is_frozen ? (
              <Sun size={16} color={Colors.warning} />
            ) : (
              <Snowflake size={16} color={Colors.info} />
            )}
          </TouchableOpacity>
          <ChevronRight size={16} color={Colors.textTertiary} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

function AddPatientModal({
  visible,
  onClose,
  clinicianId,
}: {
  visible: boolean;
  onClose: () => void;
  clinicianId?: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = useCallback(() => {
    setName('');
    setNameZh('');
    setDiagnosis('');
    setGender('');
    setPhone('');
    setEmail('');
    setNotes('');
  }, []);

  const addMutation = useMutation({
    mutationFn: async () => {
      const accessCode = generateAccessCode();
      const { error } = await supabase.from('patients').insert({
        patient_name: name.trim(),
        patient_name_zh: nameZh.trim() || null,
        access_code: accessCode,
        diagnosis: diagnosis.trim() || null,
        gender: gender.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        is_frozen: false,
        clinician_id: clinicianId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-patients'] });
      resetForm();
      onClose();
      Alert.alert('Success 成功', 'Patient added successfully.\n患者已成功新增。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleAdd = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Name 姓名不完整', 'Please enter patient name.\n請輸入患者姓名。');
      return;
    }
    addMutation.mutate();
  }, [name, addMutation]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel 取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Patient 新增患者</Text>
          <TouchableOpacity onPress={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.modalSave}>Save 儲存</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <FormField label="Name 姓名 *" value={name} onChangeText={setName} placeholder="Patient name" />
          <FormField label="Chinese Name 中文名" value={nameZh} onChangeText={setNameZh} placeholder="中文姓名" />
          <FormField label="Diagnosis 診斷" value={diagnosis} onChangeText={setDiagnosis} placeholder="Primary diagnosis" />
          <FormField label="Gender 性別" value={gender} onChangeText={setGender} placeholder="M / F / Other" />
          <FormField label="Phone 電話" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
          <FormField label="Email 電郵" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" />
          <FormField label="Notes 備註" value={notes} onChangeText={setNotes} placeholder="Additional notes" multiline />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="words"
      />
    </View>
  );
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
    paddingVertical: 12,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  emptyTextZh: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  patientCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientCardFrozen: {
    opacity: 0.7,
  },
  patientCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleFrozen: {
    backgroundColor: Colors.frozenLight,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  patientInfo: {
    flex: 1,
    gap: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  patientCode: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  patientDiagnosis: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  patientCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
  },
  frozenBadge: {
    backgroundColor: Colors.frozenLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  activeText: {
    color: Colors.success,
  },
  frozenText: {
    color: Colors.frozen,
  },
  patientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freezeButton: {
    padding: 4,
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
});
