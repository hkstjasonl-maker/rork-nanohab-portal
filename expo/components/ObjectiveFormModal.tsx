import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trad2simp } from '@/lib/trad2simp';

interface ObjectiveFormData {
  id?: string;
  objective_en: string;
  objective_zh_hant: string;
  objective_zh_hans: string;
  sort_order: number;
  is_active: boolean;
}

interface ObjectiveFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ObjectiveFormData) => void;
  isSaving: boolean;
  initialData?: ObjectiveFormData | null;
  title: string;
}

export default function ObjectiveFormModal({
  visible,
  onClose,
  onSave,
  isSaving,
  initialData,
  title,
}: ObjectiveFormModalProps) {
  const [objectiveEn, setObjectiveEn] = useState('');
  const [objectiveZhHant, setObjectiveZhHant] = useState('');
  const [objectiveZhHans, setObjectiveZhHans] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setObjectiveEn(initialData.objective_en || '');
        setObjectiveZhHant(initialData.objective_zh_hant || '');
        setObjectiveZhHans(initialData.objective_zh_hans || '');
        setSortOrder(String(initialData.sort_order ?? 0));
        setIsActive(initialData.is_active !== false);
      } else {
        setObjectiveEn('');
        setObjectiveZhHant('');
        setObjectiveZhHans('');
        setSortOrder('0');
        setIsActive(true);
      }
    }
  }, [visible, initialData]);

  const handleSave = () => {
    if (!objectiveEn.trim()) return;
    onSave({
      id: initialData?.id,
      objective_en: objectiveEn.trim(),
      objective_zh_hant: objectiveZhHant.trim(),
      objective_zh_hans: objectiveZhHans.trim(),
      sort_order: parseInt(sortOrder, 10) || 0,
      is_active: isActive,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving || !objectiveEn.trim()}>
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={[styles.saveText, !objectiveEn.trim() && { opacity: 0.4 }]}>
                Save 儲存
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>Objective (English) 目標 (英文) *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={objectiveEn}
              onChangeText={setObjectiveEn}
              placeholder="Enter objective in English..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Objective (繁中)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={objectiveZhHant}
              onChangeText={setObjectiveZhHant}
              placeholder="輸入目標（繁體中文）..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Objective (简中)</Text>
              <TouchableOpacity
                style={styles.convertBtn}
                onPress={() => setObjectiveZhHans(trad2simp(objectiveZhHant))}
                activeOpacity={0.7}
              >
                <Text style={styles.convertBtnText}>繁→简</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={objectiveZhHans}
              onChangeText={setObjectiveZhHans}
              placeholder="输入目标（简体中文）..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Sort Order 排序</Text>
              <TextInput
                style={styles.input}
                value={sortOrder}
                onChangeText={setSortOrder}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Active 啟用</Text>
              <View style={styles.switchRow}>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
                <Text style={styles.switchLabel}>{isActive ? 'Yes 是' : 'No 否'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  switchLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convertBtn: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  convertBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accentDark,
  },
});
