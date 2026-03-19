import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Snowflake,
  Sun,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { Patient } from '@/types';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diagnosisZh, setDiagnosisZh] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isFormDirty, setIsFormDirty] = useState(false);

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      const p = data as Patient;
      setName(p.patient_name || '');
      setNameZh(p.patient_name_zh || '');
      setDiagnosis(p.diagnosis || '');
      setDiagnosisZh(p.diagnosis_zh || '');
      setGender(p.gender || '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setEmergencyContact(p.emergency_contact || '');
      setEmergencyPhone(p.emergency_phone || '');
      setNotes(p.notes || '');
      return p;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patients')
        .update({
          patient_name: name.trim(),
          patient_name_zh: nameZh.trim() || null,
          diagnosis: diagnosis.trim() || null,
          diagnosis_zh: diagnosisZh.trim() || null,
          gender: gender.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          emergency_phone: emergencyPhone.trim() || null,
          notes: notes.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setIsFormDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['patient', id] });
      Alert.alert('Saved 已儲存', 'Patient details updated.\n患者資料已更新。');
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const freezeMutation = useMutation({
    mutationFn: async (isFrozen: boolean) => {
      const { error } = await supabase
        .from('patients')
        .update({ is_frozen: isFrozen })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['patient', id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-patients'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Name 姓名不完整', 'Patient name is required.\n患者姓名為必填。');
      return;
    }
    updateMutation.mutate();
  }, [name, updateMutation]);

  const handleFreeze = useCallback(() => {
    if (!patientQuery.data) return;
    const isFrozen = patientQuery.data.is_frozen;
    const action = isFrozen ? 'unfreeze' : 'freeze';
    const actionZh = isFrozen ? '解凍' : '凍結';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Patient ${actionZh}患者`,
      `Are you sure?\n確定嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        {
          text: `Confirm 確認`,
          style: isFrozen ? 'default' : 'destructive',
          onPress: () => freezeMutation.mutate(!isFrozen),
        },
      ]
    );
  }, [patientQuery.data, freezeMutation]);

  const handleFieldChange = useCallback((setter: (v: string) => void) => {
    return (text: string) => {
      setter(text);
      setIsFormDirty(true);
    };
  }, []);

  const patient = patientQuery.data;

  if (patientQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Patient', headerShown: true }} />
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (patientQuery.isError || !patient) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Error', headerShown: true }} />
        <Text style={styles.errorText}>Failed to load patient</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: patient.patient_name || 'Patient',
          headerShown: true,
          headerStyle: { backgroundColor: '#F2F0ED' },
          headerTintColor: Colors.text,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateMutation.isPending || !isFormDirty}
              style={{ opacity: isFormDirty ? 1 : 0.4 }}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Save size={22} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {(patient.patient_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.accessCode}>{patient.access_code}</Text>
          <View style={[styles.statusBadgeLarge, patient.is_frozen ? styles.frozenBadge : styles.activeBadge]}>
            <Text style={[styles.statusTextLarge, patient.is_frozen ? styles.frozenText : styles.activeText]}>
              {patient.is_frozen ? 'Frozen 凍結' : 'Active 活躍'}
            </Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Basic Info 基本資料</Text>
          <EditField label="Name 姓名 *" value={name} onChangeText={handleFieldChange(setName)} placeholder="Patient name" />
          <EditField label="Chinese Name 中文名" value={nameZh} onChangeText={handleFieldChange(setNameZh)} placeholder="中文姓名" />
          <EditField label="Gender 性別" value={gender} onChangeText={handleFieldChange(setGender)} placeholder="M / F / Other" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Medical 醫療</Text>
          <EditField label="Diagnosis 診斷" value={diagnosis} onChangeText={handleFieldChange(setDiagnosis)} placeholder="Primary diagnosis" />
          <EditField label="Diagnosis (Chinese) 診斷中文" value={diagnosisZh} onChangeText={handleFieldChange(setDiagnosisZh)} placeholder="診斷中文" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Contact 聯絡</Text>
          <EditField label="Phone 電話" value={phone} onChangeText={handleFieldChange(setPhone)} placeholder="Phone number" keyboardType="phone-pad" />
          <EditField label="Email 電郵" value={email} onChangeText={handleFieldChange(setEmail)} placeholder="Email" keyboardType="email-address" />
          <EditField label="Emergency Contact 緊急聯絡人" value={emergencyContact} onChangeText={handleFieldChange(setEmergencyContact)} placeholder="Contact name" />
          <EditField label="Emergency Phone 緊急電話" value={emergencyPhone} onChangeText={handleFieldChange(setEmergencyPhone)} placeholder="Contact phone" keyboardType="phone-pad" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Notes 備註</Text>
          <EditField label="Notes 備註" value={notes} onChangeText={handleFieldChange(setNotes)} placeholder="Additional notes" multiline />
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, patient.is_frozen ? styles.unfreezeButton : styles.freezeButton]}
            onPress={handleFreeze}
            disabled={freezeMutation.isPending}
            activeOpacity={0.7}
          >
            {freezeMutation.isPending ? (
              <ActivityIndicator size="small" color={patient.is_frozen ? Colors.warning : Colors.info} />
            ) : patient.is_frozen ? (
              <>
                <Sun size={18} color={Colors.warning} />
                <Text style={[styles.actionButtonText, { color: Colors.warning }]}>Unfreeze Patient 解凍患者</Text>
              </>
            ) : (
              <>
                <Snowflake size={18} color={Colors.info} />
                <Text style={[styles.actionButtonText, { color: Colors.info }]}>Freeze Patient 凍結患者</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditField({
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
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F0ED',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
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
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLargeText: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  accessCode: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
  },
  frozenBadge: {
    backgroundColor: Colors.frozenLight,
  },
  statusTextLarge: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  activeText: {
    color: Colors.success,
  },
  frozenText: {
    color: Colors.frozen,
  },
  formSection: {
    marginBottom: 24,
    gap: 12,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 2,
  },
  editField: {
    gap: 5,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  editInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  editInputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  freezeButton: {
    backgroundColor: Colors.infoLight,
  },
  unfreezeButton: {
    backgroundColor: Colors.warningLight,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
