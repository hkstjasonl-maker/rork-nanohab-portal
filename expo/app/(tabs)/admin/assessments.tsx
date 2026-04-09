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
  FlatList,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronLeft,
  Plus,
  Shield,
  ClipboardCheck,
  UserPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  Users,
  Calendar,
  FileText,
  ArrowUp,
  ArrowDown,
  Eye,
  ListChecks,
  Send,
  ClipboardList,
  Edit3,
  ToggleLeft,
  Hash,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { trad2simp } from '@/lib/trad2simp';

interface Assessment {
  id: string;
  name_en: string;
  name_zh?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  type?: string | null;
  reference?: string | null;
  scoring_config?: Record<string, unknown> | null;
  items?: AssessmentItems | null;
  is_active?: boolean;
  key?: string | null;
  interpretation_en?: string | null;
  interpretation_zh?: string | null;
  created_at?: string;
}

interface AssessmentItems {
  questions?: QuestionItem[];
}

interface QuestionItem {
  id: string;
  text_en: string;
  text_zh: string;
  type: 'likert' | 'number' | 'boolean' | 'text';
  options?: QuestionOption[];
}

interface QuestionOption {
  value: number;
  label_en: string;
  label_zh: string;
}

interface AssignedAssessment {
  id: string;
  patient_id: string;
  assessment_id: string;
  assigned_by?: string | null;
  assigned_at?: string;
  scheduled_date?: string | null;
  status?: string;
  language?: string | null;
  total_score?: number | null;
  notes?: string | null;
  created_at?: string;
  patients?: {
    patient_name: string;
  } | null;
  assessment_library?: {
    name_en: string;
    name_zh?: string;
  } | null;
}

interface PatientPick {
  id: string;
  patient_name: string;
  access_code: string;
}

interface QChoice {
  value: string;
  label_en: string;
  label_zh_hant: string;
  label_zh_hans: string;
}

interface QQuestion {
  id: string;
  type: 'numeric_scale' | 'single_choice';
  en: string;
  zh_hant: string;
  zh_hans: string;
  min?: number;
  max?: number;
  step?: number;
  min_label_en?: string;
  max_label_en?: string;
  positive?: boolean;
  choices?: QChoice[];
}

interface QTemplate {
  id: string;
  name: string;
  description_en?: string | null;
  description_zh_hant?: string | null;
  description_zh_hans?: string | null;
  questions?: QQuestion[] | null;
  scoring_method?: string | null;
  is_active?: boolean;
  created_at?: string;
}

interface QAssignment {
  id: string;
  patient_id: string;
  questionnaire_template_id: string;
  assigned_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  completed_date?: string | null;
  score?: number | null;
  notes?: string | null;
  created_at?: string;
  patients?: { patient_name: string } | null;
  questionnaire_templates?: { name: string } | null;
}

interface QResponse {
  id: string;
  assignment_id?: string | null;
  patient_id: string;
  questionnaire_template_id: string;
  answers?: Record<string, unknown> | null;
  total_score?: number | null;
  completed_at?: string | null;
  created_at?: string;
  patients?: { patient_name: string } | null;
  questionnaire_templates?: { name: string } | null;
}

type TabType = 'library' | 'assigned' | 'templates' | 'q_assignments' | 'q_responses';

const ASSESSMENT_TYPES = ['Swallowing', 'Dysarthria', 'Communication', 'Usability', 'General', 'Other'];
const QUESTION_TYPES: QuestionItem['type'][] = ['likert', 'number', 'boolean', 'text'];
const Q_QUESTION_TYPES: QQuestion['type'][] = ['numeric_scale', 'single_choice'];
const SCORING_METHODS = ['sum', 'average', 'weighted', 'custom'];

function generateId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const TAB_CONFIG: { key: TabType; label: string }[] = [
  { key: 'library', label: 'Library 評估庫' },
  { key: 'assigned', label: 'Assigned 已分配' },
  { key: 'templates', label: 'Templates 問卷' },
  { key: 'q_assignments', label: 'Q-Assign 問卷分配' },
  { key: 'q_responses', label: 'Responses 回覆' },
];

export default function AssessmentsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningAssessment, setAssigningAssessment] = useState<Assessment | null>(null);
  const [assignFromTab, setAssignFromTab] = useState(false);

  const [formId, setFormId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descZh, setDescZh] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [reference, setReference] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const [assignPatientId, setAssignPatientId] = useState<string | null>(null);
  const [assignNotes, setAssignNotes] = useState('');
  const [assignAssessmentId, setAssignAssessmentId] = useState<string>('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);

  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchAssessmentId, setBatchAssessmentId] = useState('');
  const [batchSelectedPatients, setBatchSelectedPatients] = useState<string[]>([]);
  const [batchDeadline, setBatchDeadline] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [showBatchAssessmentPicker, setShowBatchAssessmentPicker] = useState(false);
  const [batchPatientSearch, setBatchPatientSearch] = useState('');

  const [itemsEditorVisible, setItemsEditorVisible] = useState(false);
  const [editingItemsAssessmentId, setEditingItemsAssessmentId] = useState<string | null>(null);
  const [editingQuestions, setEditingQuestions] = useState<QuestionItem[]>([]);
  const [showNewQuestionForm, setShowNewQuestionForm] = useState(false);
  const [newQTextEn, setNewQTextEn] = useState('');
  const [newQTextZh, setNewQTextZh] = useState('');
  const [newQType, setNewQType] = useState<QuestionItem['type']>('likert');
  const [newQOptions, setNewQOptions] = useState<QuestionOption[]>([]);
  const [showNewQTypePicker, setShowNewQTypePicker] = useState(false);

  const [tplModalVisible, setTplModalVisible] = useState(false);
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDescEn, setTplDescEn] = useState('');
  const [tplDescZhHant, setTplDescZhHant] = useState('');
  const [tplDescZhHans, setTplDescZhHans] = useState('');
  const [tplScoringMethod, setTplScoringMethod] = useState('');
  const [tplIsActive, setTplIsActive] = useState(true);
  const [tplQuestions, setTplQuestions] = useState<QQuestion[]>([]);
  const [showScoringPicker, setShowScoringPicker] = useState(false);

  const [showTplQuestionForm, setShowTplQuestionForm] = useState(false);
  const [tplNewQType, setTplNewQType] = useState<QQuestion['type']>('numeric_scale');
  const [tplNewQEn, setTplNewQEn] = useState('');
  const [tplNewQZhHant, setTplNewQZhHant] = useState('');
  const [tplNewQZhHans, setTplNewQZhHans] = useState('');
  const [tplNewQMin, setTplNewQMin] = useState('0');
  const [tplNewQMax, setTplNewQMax] = useState('10');
  const [tplNewQStep, setTplNewQStep] = useState('1');
  const [tplNewQMinLabel, setTplNewQMinLabel] = useState('');
  const [tplNewQMaxLabel, setTplNewQMaxLabel] = useState('');
  const [tplNewQPositive, setTplNewQPositive] = useState(true);
  const [tplNewQChoices, setTplNewQChoices] = useState<QChoice[]>([]);
  const [showTplNewQTypePicker, setShowTplNewQTypePicker] = useState(false);

  const [qAssignModalVisible, setQAssignModalVisible] = useState(false);
  const [qAssignPatientId, setQAssignPatientId] = useState<string | null>(null);
  const [qAssignTemplateId, setQAssignTemplateId] = useState<string | null>(null);
  const [qAssignDueDate, setQAssignDueDate] = useState('');
  const [qAssignNotes, setQAssignNotes] = useState('');
  const [showQAssignPatientPicker, setShowQAssignPatientPicker] = useState(false);
  const [showQAssignTemplatePicker, setShowQAssignTemplatePicker] = useState(false);
  const [qAssignPatientSearch, setQAssignPatientSearch] = useState('');

  const [responseDetailVisible, setResponseDetailVisible] = useState(false);
  const [viewingResponse, setViewingResponse] = useState<QResponse | null>(null);

  const assessmentsQuery = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          if (error.message?.includes('does not exist') || error.code === '42P01') {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data || []) as Assessment[];
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string };
        console.log('Error fetching assessments:', e);
        if (err?.message?.includes('does not exist') || err?.code === '42P01') {
          setTableExists(false);
        }
        return [];
      }
    },
    enabled: isAdmin,
  });

  const assignedQuery = useQuery({
    queryKey: ['admin-assigned-assessments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_submissions')
          .select('*, patients(patient_name), assessment_library(name_en, name_zh)')
          .order('assigned_at', { ascending: false });
        if (error) {
          console.log('Assigned assessments error (with join):', error);
          const { data: fallback, error: fallbackError } = await supabase
            .from('assessment_submissions')
            .select('*, patients(patient_name)')
            .order('assigned_at', { ascending: false });
          if (fallbackError) {
            console.log('Assigned assessments fallback error:', fallbackError);
            return [];
          }
          return (fallback || []) as AssignedAssessment[];
        }
        return (data || []) as AssignedAssessment[];
      } catch (e) {
        console.log('Assigned assessments exception:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'assigned',
  });

  const patientsQuery = useQuery({
    queryKey: ['assign-patients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, patient_name, access_code')
          .eq('is_frozen', false)
          .order('patient_name', { ascending: true });
        if (error) throw error;
        return (data || []) as PatientPick[];
      } catch (e) {
        console.log('Error fetching patients for assign:', e);
        return [];
      }
    },
    enabled: isAdmin && (assignModalVisible || batchModalVisible || qAssignModalVisible),
  });

  const assessmentOptionsQuery = useQuery({
    queryKey: ['assessment-options-for-assign'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assessment_library')
          .select('id, name_en, name_zh')
          .eq('is_active', true)
          .order('name_en');
        if (error) throw error;
        return (data || []) as { id: string; name_en: string; name_zh?: string }[];
      } catch (e) {
        console.log('Error fetching assessment options:', e);
        return [];
      }
    },
    enabled: isAdmin && (assignModalVisible || batchModalVisible),
  });

  const templatesQuery = useQuery({
    queryKey: ['admin-questionnaire-templates'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('questionnaire_templates')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Templates fetch error:', error);
          return [];
        }
        return (data || []) as QTemplate[];
      } catch (e) {
        console.log('Templates exception:', e);
        return [];
      }
    },
    enabled: isAdmin && (activeTab === 'templates' || qAssignModalVisible),
  });

  const qAssignmentsQuery = useQuery({
    queryKey: ['admin-questionnaire-assignments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('questionnaire_assignments')
          .select('*, patients(patient_name), questionnaire_templates(name)')
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Q assignments fetch error:', error);
          return [];
        }
        return (data || []) as QAssignment[];
      } catch (e) {
        console.log('Q assignments exception:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'q_assignments',
  });

  const qResponsesQuery = useQuery({
    queryKey: ['admin-questionnaire-responses'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('questionnaire_responses')
          .select('*, patients(patient_name), questionnaire_templates(name)')
          .order('created_at', { ascending: false });
        if (error) {
          console.log('Q responses fetch error:', error);
          return [];
        }
        return (data || []) as QResponse[];
      } catch (e) {
        console.log('Q responses exception:', e);
        return [];
      }
    },
    enabled: isAdmin && activeTab === 'q_responses',
  });

  const filteredPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!patientSearch.trim()) return patientsQuery.data;
    const s = patientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, patientSearch]);

  const batchFilteredPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!batchPatientSearch.trim()) return patientsQuery.data;
    const s = batchPatientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, batchPatientSearch]);

  const qAssignFilteredPatients = useMemo(() => {
    if (!patientsQuery.data) return [];
    if (!qAssignPatientSearch.trim()) return patientsQuery.data;
    const s = qAssignPatientSearch.toLowerCase();
    return patientsQuery.data.filter(p =>
      p.patient_name?.toLowerCase().includes(s) || p.access_code?.toLowerCase().includes(s)
    );
  }, [patientsQuery.data, qAssignPatientSearch]);

  const selectedPatient = useMemo(() => {
    return patientsQuery.data?.find(p => p.id === assignPatientId) || null;
  }, [patientsQuery.data, assignPatientId]);

  const selectedAssessmentOption = useMemo(() => {
    return assessmentOptionsQuery.data?.find(a => a.id === assignAssessmentId) || null;
  }, [assessmentOptionsQuery.data, assignAssessmentId]);

  const batchSelectedAssessment = useMemo(() => {
    return assessmentOptionsQuery.data?.find(a => a.id === batchAssessmentId) || null;
  }, [assessmentOptionsQuery.data, batchAssessmentId]);

  const qAssignSelectedPatient = useMemo(() => {
    return patientsQuery.data?.find(p => p.id === qAssignPatientId) || null;
  }, [patientsQuery.data, qAssignPatientId]);

  const qAssignSelectedTemplate = useMemo(() => {
    return templatesQuery.data?.find(t => t.id === qAssignTemplateId) || null;
  }, [templatesQuery.data, qAssignTemplateId]);

  const filteredLibrary = useMemo(() => {
    if (!assessmentsQuery.data) return [];
    if (!search.trim()) return assessmentsQuery.data;
    const s = search.toLowerCase();
    return assessmentsQuery.data.filter(a =>
      a.name_en?.toLowerCase().includes(s) ||
      a.name_zh?.toLowerCase().includes(s) ||
      a.type?.toLowerCase().includes(s)
    );
  }, [assessmentsQuery.data, search]);

  const filteredAssigned = useMemo(() => {
    if (!assignedQuery.data) return [];
    if (!search.trim()) return assignedQuery.data;
    const s = search.toLowerCase();
    return assignedQuery.data.filter(a =>
      a.assessment_id?.toLowerCase().includes(s) ||
      a.patients?.patient_name?.toLowerCase().includes(s) ||
      a.status?.toLowerCase().includes(s)
    );
  }, [assignedQuery.data, search]);

  const filteredTemplates = useMemo(() => {
    if (!templatesQuery.data) return [];
    if (!search.trim()) return templatesQuery.data;
    const s = search.toLowerCase();
    return templatesQuery.data.filter(t =>
      t.name?.toLowerCase().includes(s) ||
      t.description_en?.toLowerCase().includes(s) ||
      t.scoring_method?.toLowerCase().includes(s)
    );
  }, [templatesQuery.data, search]);

  const filteredQAssignments = useMemo(() => {
    if (!qAssignmentsQuery.data) return [];
    if (!search.trim()) return qAssignmentsQuery.data;
    const s = search.toLowerCase();
    return qAssignmentsQuery.data.filter(a =>
      a.patients?.patient_name?.toLowerCase().includes(s) ||
      a.questionnaire_templates?.name?.toLowerCase().includes(s) ||
      a.status?.toLowerCase().includes(s)
    );
  }, [qAssignmentsQuery.data, search]);

  const filteredQResponses = useMemo(() => {
    if (!qResponsesQuery.data) return [];
    if (!search.trim()) return qResponsesQuery.data;
    const s = search.toLowerCase();
    return qResponsesQuery.data.filter(r =>
      r.patients?.patient_name?.toLowerCase().includes(s) ||
      r.questionnaire_templates?.name?.toLowerCase().includes(s)
    );
  }, [qResponsesQuery.data, search]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setFormId('');
    setNameEn(''); setNameZh(''); setDescEn(''); setDescZh('');
    setSelectedType(''); setReference(''); setIsActive(true);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((a: Assessment) => {
    setEditingId(a.id);
    setFormId(a.id);
    setNameEn(a.name_en || '');
    setNameZh(a.name_zh || '');
    setDescEn(a.description_en || '');
    setDescZh(a.description_zh || '');
    setSelectedType(a.type || '');
    setReference(a.reference || '');
    setIsActive(a.is_active !== false);
    setModalVisible(true);
  }, []);

  const openAssignFromLibrary = useCallback((a: Assessment) => {
    setAssigningAssessment(a);
    setAssignFromTab(false);
    setAssignPatientId(null);
    setAssignNotes('');
    setAssignAssessmentId(a.id);
    setAssignDeadline('');
    setPatientSearch('');
    setAssignModalVisible(true);
  }, []);

  const openAssignNew = useCallback(() => {
    setAssigningAssessment(null);
    setAssignFromTab(true);
    setAssignPatientId(null);
    setAssignNotes('');
    setAssignAssessmentId('');
    setAssignDeadline('');
    setPatientSearch('');
    setAssignModalVisible(true);
  }, []);

  const openBatchAssign = useCallback(() => {
    setBatchAssessmentId('');
    setBatchSelectedPatients([]);
    setBatchDeadline('');
    setBatchNotes('');
    setBatchPatientSearch('');
    setBatchModalVisible(true);
  }, []);

  const openItemsEditor = useCallback((a: Assessment) => {
    setEditingItemsAssessmentId(a.id);
    const existing = (a.items as AssessmentItems)?.questions || [];
    setEditingQuestions(existing.map(q => ({ ...q })));
    setShowNewQuestionForm(false);
    setNewQTextEn('');
    setNewQTextZh('');
    setNewQType('likert');
    setNewQOptions([]);
    setItemsEditorVisible(true);
  }, []);

  const resetNewQuestion = useCallback(() => {
    setNewQTextEn('');
    setNewQTextZh('');
    setNewQType('likert');
    setNewQOptions([]);
  }, []);

  const handleNameEnChange = useCallback((text: string) => {
    setNameEn(text);
    if (!editingId) {
      setFormId(generateId(text));
    }
  }, [editingId]);

  const openNewTemplate = useCallback(() => {
    setEditingTplId(null);
    setTplName(''); setTplDescEn(''); setTplDescZhHant(''); setTplDescZhHans('');
    setTplScoringMethod(''); setTplIsActive(true); setTplQuestions([]);
    setShowTplQuestionForm(false);
    setTplModalVisible(true);
  }, []);

  const openEditTemplate = useCallback((t: QTemplate) => {
    setEditingTplId(t.id);
    setTplName(t.name || '');
    setTplDescEn(t.description_en || '');
    setTplDescZhHant(t.description_zh_hant || '');
    setTplDescZhHans(t.description_zh_hans || '');
    setTplScoringMethod(t.scoring_method || '');
    setTplIsActive(t.is_active !== false);
    setTplQuestions(Array.isArray(t.questions) ? t.questions.map(q => ({ ...q })) : []);
    setShowTplQuestionForm(false);
    setTplModalVisible(true);
  }, []);

  const openQAssign = useCallback(() => {
    setQAssignPatientId(null);
    setQAssignTemplateId(null);
    setQAssignDueDate('');
    setQAssignNotes('');
    setQAssignPatientSearch('');
    setQAssignModalVisible(true);
  }, []);

  const resetTplNewQuestion = useCallback(() => {
    setTplNewQType('numeric_scale');
    setTplNewQEn(''); setTplNewQZhHant(''); setTplNewQZhHans('');
    setTplNewQMin('0'); setTplNewQMax('10'); setTplNewQStep('1');
    setTplNewQMinLabel(''); setTplNewQMaxLabel('');
    setTplNewQPositive(true); setTplNewQChoices([]);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim()) throw new Error('English name is required');
      const finalId = editingId || formId.trim();
      if (!finalId) throw new Error('Assessment ID is required');

      const payload: Record<string, unknown> = {
        name_en: nameEn.trim(),
        name_zh: nameZh.trim() || null,
        description_en: descEn.trim() || null,
        description_zh: descZh.trim() || null,
        type: selectedType || null,
        reference: reference.trim() || null,
        is_active: isActive,
      };

      if (editingId) {
        const { error } = await supabase.from('assessment_library').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const insertPayload = { ...payload, id: finalId };
        const { error } = await supabase.from('assessment_library').insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['assessment-options-for-assign'] });
      setModalVisible(false);
      Alert.alert('Success 成功', editingId ? 'Assessment updated 評估已更新' : 'Assessment created 評估已建立');
    },
    onError: (error: Error) => {
      console.log('Save assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignPatientId) throw new Error('Please select a patient 請選擇患者');
      const assessmentId = assignFromTab ? assignAssessmentId : (assigningAssessment?.id || assignAssessmentId);
      if (!assessmentId) throw new Error('Please select an assessment 請選擇評估');

      const insertData: Record<string, unknown> = {
        patient_id: assignPatientId,
        assessment_id: assessmentId,
        assigned_at: new Date().toISOString(),
        status: 'pending',
        notes: assignNotes.trim() || null,
      };

      if (assignDeadline.trim()) {
        try {
          const d = new Date(assignDeadline.trim());
          if (!isNaN(d.getTime())) {
            insertData.scheduled_date = d.toISOString();
          }
        } catch (e) {
          console.log('Invalid deadline date:', e);
        }
      }

      const { error } = await supabase.from('assessment_submissions').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      setAssignModalVisible(false);
      Alert.alert('Assigned 已指派', 'Assessment assigned to patient successfully.\n已成功指派評估給患者。');
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Assign assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const batchAssignMutation = useMutation({
    mutationFn: async () => {
      if (!batchAssessmentId) throw new Error('Please select an assessment 請選擇評估');
      if (batchSelectedPatients.length === 0) throw new Error('Please select at least one patient 請至少選擇一位患者');

      let scheduledDate: string | null = null;
      if (batchDeadline.trim()) {
        try {
          const d = new Date(batchDeadline.trim());
          if (!isNaN(d.getTime())) {
            scheduledDate = d.toISOString();
          }
        } catch (e) {
          console.log('Invalid batch deadline:', e);
        }
      }

      const errors: string[] = [];
      for (const patientId of batchSelectedPatients) {
        try {
          const { error } = await supabase.from('assessment_submissions').insert({
            patient_id: patientId,
            assessment_id: batchAssessmentId,
            assigned_at: new Date().toISOString(),
            status: 'pending',
            scheduled_date: scheduledDate,
            notes: batchNotes.trim() || null,
          });
          if (error) {
            console.log('Batch assign error for patient', patientId, error);
            errors.push(patientId);
          }
        } catch (e) {
          console.log('Batch assign exception for patient', patientId, e);
          errors.push(patientId);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Failed for ${errors.length} patient(s). ${batchSelectedPatients.length - errors.length} succeeded.`);
      }

      return batchSelectedPatients.length;
    },
    onSuccess: (count: number) => {
      setBatchModalVisible(false);
      Alert.alert('Success 成功', `Assigned to ${count} patients 已分配至 ${count} 位患者`);
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Batch assign error:', error);
      Alert.alert('Partial Error 部分錯誤', error.message);
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
    },
  });

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      if (!editingItemsAssessmentId) throw new Error('No assessment selected');
      const itemsPayload: AssessmentItems = { questions: editingQuestions };
      const { error } = await supabase
        .from('assessment_library')
        .update({ items: itemsPayload })
        .eq('id', editingItemsAssessmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      setItemsEditorVisible(false);
      Alert.alert('Success 成功', 'Questions saved 題目已儲存');
    },
    onError: (error: Error) => {
      console.log('Save items error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteAssignedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-assessments'] });
    },
    onError: (error: Error) => {
      console.log('Delete assigned assessment error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteAssigned = useCallback((item: AssignedAssessment) => {
    const name = item.assessment_library?.name_en || item.assessment_id;
    Alert.alert(
      'Delete Assessment 刪除評估',
      `Remove "${name}" for ${item.patients?.patient_name || 'this patient'}?\n確定要刪除此評估嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteAssignedMutation.mutate(item.id) },
      ]
    );
  }, [deleteAssignedMutation]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['assessment-options-for-assign'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteLibrary = useCallback((a: Assessment) => {
    Alert.alert(
      'Delete Assessment 刪除評估',
      `Delete "${a.name_en}"?\n確定要刪除 "${a.name_en}" 嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteMutation.mutate(a.id) },
      ]
    );
  }, [deleteMutation]);

  const toggleBatchPatient = useCallback((patientId: string) => {
    setBatchSelectedPatients(prev =>
      prev.includes(patientId)
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  }, []);

  const selectAllPatients = useCallback(() => {
    const all = patientsQuery.data?.map(p => p.id) || [];
    setBatchSelectedPatients(all);
  }, [patientsQuery.data]);

  const deselectAllPatients = useCallback(() => {
    setBatchSelectedPatients([]);
  }, []);

  const addNewQuestion = useCallback(() => {
    if (!newQTextEn.trim()) {
      Alert.alert('Error', 'English question text is required');
      return;
    }
    const newQ: QuestionItem = {
      id: `q${editingQuestions.length + 1}_${Date.now()}`,
      text_en: newQTextEn.trim(),
      text_zh: newQTextZh.trim(),
      type: newQType,
      options: newQType === 'likert' ? [...newQOptions] : undefined,
    };
    setEditingQuestions(prev => [...prev, newQ]);
    resetNewQuestion();
    setShowNewQuestionForm(false);
  }, [newQTextEn, newQTextZh, newQType, newQOptions, editingQuestions.length, resetNewQuestion]);

  const removeQuestion = useCallback((index: number) => {
    setEditingQuestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setEditingQuestions(prev => {
      const arr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return prev;
      const temp = arr[index];
      arr[index] = arr[targetIndex];
      arr[targetIndex] = temp;
      return arr;
    });
  }, []);

  const addOption = useCallback(() => {
    setNewQOptions(prev => [...prev, { value: prev.length, label_en: '', label_zh: '' }]);
  }, []);

  const updateOption = useCallback((index: number, field: 'label_en' | 'label_zh' | 'value', val: string) => {
    setNewQOptions(prev => {
      const updated = [...prev];
      if (field === 'value') {
        updated[index] = { ...updated[index], value: parseInt(val) || 0 };
      } else {
        updated[index] = { ...updated[index], [field]: val };
      }
      return updated;
    });
  }, []);

  const removeOption = useCallback((index: number) => {
    setNewQOptions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const saveTplMutation = useMutation({
    mutationFn: async () => {
      if (!tplName.trim()) throw new Error('Template name is required 問卷名稱為必填');

      const payload: Record<string, unknown> = {
        name: tplName.trim(),
        description_en: tplDescEn.trim() || null,
        description_zh_hant: tplDescZhHant.trim() || null,
        description_zh_hans: tplDescZhHans.trim() || null,
        scoring_method: tplScoringMethod || null,
        is_active: tplIsActive,
        questions: tplQuestions,
      };

      if (editingTplId) {
        const { error } = await supabase.from('questionnaire_templates').update(payload).eq('id', editingTplId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questionnaire_templates').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-questionnaire-templates'] });
      setTplModalVisible(false);
      Alert.alert('Success 成功', editingTplId ? 'Template updated 問卷已更新' : 'Template created 問卷已建立');
    },
    onError: (error: Error) => {
      console.log('Save template error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteTplMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questionnaire_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-questionnaire-templates'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteTemplate = useCallback((t: QTemplate) => {
    Alert.alert(
      'Delete Template 刪除問卷',
      `Delete "${t.name}"?\n確定要刪除 "${t.name}" 嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteTplMutation.mutate(t.id) },
      ]
    );
  }, [deleteTplMutation]);

  const addTplQuestion = useCallback(() => {
    if (!tplNewQEn.trim()) {
      Alert.alert('Error', 'English question text is required');
      return;
    }
    const newQ: QQuestion = {
      id: `tq${tplQuestions.length + 1}_${Date.now()}`,
      type: tplNewQType,
      en: tplNewQEn.trim(),
      zh_hant: tplNewQZhHant.trim(),
      zh_hans: tplNewQZhHans.trim(),
    };
    if (tplNewQType === 'numeric_scale') {
      newQ.min = parseInt(tplNewQMin) || 0;
      newQ.max = parseInt(tplNewQMax) || 10;
      newQ.step = parseInt(tplNewQStep) || 1;
      newQ.min_label_en = tplNewQMinLabel.trim() || undefined;
      newQ.max_label_en = tplNewQMaxLabel.trim() || undefined;
      newQ.positive = tplNewQPositive;
    }
    if (tplNewQType === 'single_choice') {
      newQ.choices = [...tplNewQChoices];
    }
    setTplQuestions(prev => [...prev, newQ]);
    resetTplNewQuestion();
    setShowTplQuestionForm(false);
  }, [tplNewQType, tplNewQEn, tplNewQZhHant, tplNewQZhHans, tplNewQMin, tplNewQMax, tplNewQStep, tplNewQMinLabel, tplNewQMaxLabel, tplNewQPositive, tplNewQChoices, tplQuestions.length, resetTplNewQuestion]);

  const removeTplQuestion = useCallback((index: number) => {
    setTplQuestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveTplQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setTplQuestions(prev => {
      const arr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return prev;
      const temp = arr[index];
      arr[index] = arr[targetIndex];
      arr[targetIndex] = temp;
      return arr;
    });
  }, []);

  const addTplChoice = useCallback(() => {
    setTplNewQChoices(prev => [...prev, { value: String(prev.length), label_en: '', label_zh_hant: '', label_zh_hans: '' }]);
  }, []);

  const updateTplChoice = useCallback((index: number, field: keyof QChoice, val: string) => {
    setTplNewQChoices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  }, []);

  const removeTplChoice = useCallback((index: number) => {
    setTplNewQChoices(prev => prev.filter((_, i) => i !== index));
  }, []);

  const qAssignMutation = useMutation({
    mutationFn: async () => {
      if (!qAssignPatientId) throw new Error('Please select a patient 請選擇患者');
      if (!qAssignTemplateId) throw new Error('Please select a template 請選擇問卷');

      const insertData: Record<string, unknown> = {
        patient_id: qAssignPatientId,
        questionnaire_template_id: qAssignTemplateId,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: qAssignNotes.trim() || null,
      };

      if (qAssignDueDate.trim()) {
        insertData.due_date = qAssignDueDate.trim();
      }

      const { error } = await supabase.from('questionnaire_assignments').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      setQAssignModalVisible(false);
      Alert.alert('Success 成功', 'Questionnaire assigned 問卷已分配');
      void queryClient.invalidateQueries({ queryKey: ['admin-questionnaire-assignments'] });
    },
    onError: (error: Error) => {
      console.log('Q assign error:', error);
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const deleteQAssignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questionnaire_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-questionnaire-assignments'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error 錯誤', error.message);
    },
  });

  const handleDeleteQAssign = useCallback((item: QAssignment) => {
    Alert.alert(
      'Delete Assignment 刪除分配',
      `Remove this questionnaire assignment?\n確定要刪除此問卷分配嗎？`,
      [
        { text: 'Cancel 取消', style: 'cancel' },
        { text: 'Delete 刪除', style: 'destructive', onPress: () => deleteQAssignMutation.mutate(item.id) },
      ]
    );
  }, [deleteQAssignMutation]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Shield size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  const isLibraryTab = activeTab === 'library';
  const isAssignedTab = activeTab === 'assigned';
  const isTemplatesTab = activeTab === 'templates';
  const isQAssignTab = activeTab === 'q_assignments';
  const isQResponsesTab = activeTab === 'q_responses';

  const showLibraryPlaceholder = !tableExists && isLibraryTab;

  const getCurrentLoading = () => {
    if (isLibraryTab) return assessmentsQuery.isLoading;
    if (isAssignedTab) return assignedQuery.isLoading;
    if (isTemplatesTab) return templatesQuery.isLoading;
    if (isQAssignTab) return qAssignmentsQuery.isLoading;
    if (isQResponsesTab) return qResponsesQuery.isLoading;
    return false;
  };

  const getCurrentFetching = () => {
    if (isLibraryTab) return assessmentsQuery.isFetching;
    if (isAssignedTab) return assignedQuery.isFetching;
    if (isTemplatesTab) return templatesQuery.isFetching;
    if (isQAssignTab) return qAssignmentsQuery.isFetching;
    if (isQResponsesTab) return qResponsesQuery.isFetching;
    return false;
  };

  const handleRefresh = () => {
    if (isLibraryTab) void assessmentsQuery.refetch();
    else if (isAssignedTab) void assignedQuery.refetch();
    else if (isTemplatesTab) void templatesQuery.refetch();
    else if (isQAssignTab) void qAssignmentsQuery.refetch();
    else if (isQResponsesTab) void qResponsesQuery.refetch();
  };

  const handleFabPress = () => {
    if (isLibraryTab) openNew();
    else if (isAssignedTab) openAssignNew();
    else if (isTemplatesTab) openNewTemplate();
    else if (isQAssignTab) openQAssign();
  };

  const showFab = activeTab !== 'q_responses';

  const renderLibraryContent = () => (
    showLibraryPlaceholder ? (
      <View style={styles.placeholderCenter}>
        <ClipboardCheck size={56} color={Colors.textTertiary} />
        <Text style={styles.placeholderTitle}>Assessment Library Not Configured</Text>
        <Text style={styles.placeholderSubtitle}>評估庫尚未配置</Text>
        <Text style={styles.placeholderDesc}>
          You can still add assessments via the Research tab.{'\n'}您仍可透過研究分頁新增評估。
        </Text>
        <TouchableOpacity
          style={styles.goResearchBtn}
          onPress={() => router.push('/(tabs)/research')}
          activeOpacity={0.7}
        >
          <Text style={styles.goResearchText}>Go to Research 前往研究</Text>
        </TouchableOpacity>
      </View>
    ) : filteredLibrary.length === 0 ? (
      <Text style={styles.emptyText}>No assessments found{'\n'}未找到評估</Text>
    ) : (
      filteredLibrary.map(a => (
        <View key={a.id} style={styles.card}>
          <TouchableOpacity onPress={() => openEdit(a)} activeOpacity={0.7} style={styles.cardTouchable}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{a.name_en}</Text>
                {a.name_zh && <Text style={styles.cardNameZh}>{a.name_zh}</Text>}
                <Text style={styles.cardId}>ID: {a.id}</Text>
              </View>
              <View style={styles.cardActions}>
                {a.type && (
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{a.type}</Text>
                  </View>
                )}
                {a.is_active === false && (
                  <View style={[styles.catBadge, { backgroundColor: Colors.dangerLight }]}>
                    <Text style={[styles.catBadgeText, { color: Colors.danger }]}>Inactive</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => handleDeleteLibrary(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
            {a.description_en && <Text style={styles.cardDesc} numberOfLines={2}>{a.description_en}</Text>}
            {a.reference && <Text style={styles.cardRef} numberOfLines={1}>Ref: {a.reference}</Text>}
          </TouchableOpacity>
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.cardFooterBtn}
              onPress={() => openAssignFromLibrary(a)}
              activeOpacity={0.7}
            >
              <UserPlus size={14} color={Colors.accent} />
              <Text style={styles.cardFooterBtnText}>Assign 指派</Text>
            </TouchableOpacity>
            <View style={styles.cardFooterDivider} />
            <TouchableOpacity
              style={styles.cardFooterBtn}
              onPress={() => openItemsEditor(a)}
              activeOpacity={0.7}
            >
              <FileText size={14} color={Colors.info} />
              <Text style={[styles.cardFooterBtnText, { color: Colors.info }]}>Questions 題目</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))
    )
  );

  const renderAssignedContent = () => (
    filteredAssigned.length === 0 ? (
      <Text style={styles.emptyText}>No assigned assessments found{'\n'}尚無已分配的評估</Text>
    ) : (
      filteredAssigned.map(item => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardTouchable}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.patients?.patient_name || 'Unknown Patient'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteAssigned(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.assignedMeta}>
              <View style={styles.assessmentNameBadge}>
                <Text style={styles.assessmentNameText}>
                  {item.assessment_library?.name_en || item.assessment_id}
                </Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: item.status === 'completed' ? Colors.successLight : item.status === 'pending' ? Colors.warningLight : Colors.surfaceSecondary
              }]}>
                <View style={[styles.statusDot, {
                  backgroundColor: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary
                }]} />
                <Text style={[styles.statusBadgeText, {
                  color: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary
                }]}>
                  {item.status || 'unknown'}
                </Text>
              </View>
            </View>

            <View style={styles.assignedDetails}>
              {item.total_score != null && (
                <Text style={styles.scoreText}>Score: {item.total_score}</Text>
              )}
              {item.assigned_at && (
                <Text style={styles.dateText}>Assigned: {item.assigned_at.split('T')[0]}</Text>
              )}
              {item.scheduled_date && (
                <View style={styles.deadlineBadge}>
                  <Calendar size={11} color={Colors.warning} />
                  <Text style={styles.deadlineText}>Due: {item.scheduled_date.split('T')[0]}</Text>
                </View>
              )}
            </View>

            {item.notes && <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>}
          </View>
        </View>
      ))
    )
  );

  const renderTemplatesContent = () => (
    filteredTemplates.length === 0 ? (
      <Text style={styles.emptyText}>No questionnaire templates found{'\n'}未找到問卷範本</Text>
    ) : (
      filteredTemplates.map(t => (
        <View key={t.id} style={styles.card}>
          <TouchableOpacity onPress={() => openEditTemplate(t)} activeOpacity={0.7} style={styles.cardTouchable}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{t.name}</Text>
                {t.description_en && <Text style={styles.cardNameZh} numberOfLines={1}>{t.description_en}</Text>}
              </View>
              <View style={styles.cardActions}>
                {t.scoring_method && (
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{t.scoring_method}</Text>
                  </View>
                )}
                {t.is_active === false && (
                  <View style={[styles.catBadge, { backgroundColor: Colors.dangerLight }]}>
                    <Text style={[styles.catBadgeText, { color: Colors.danger }]}>Inactive</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => handleDeleteTemplate(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.tplMeta}>
              <View style={styles.tplMetaItem}>
                <ListChecks size={12} color={Colors.textTertiary} />
                <Text style={styles.tplMetaText}>{Array.isArray(t.questions) ? t.questions.length : 0} questions</Text>
              </View>
              {t.created_at && (
                <Text style={styles.tplMetaText}>{t.created_at.split('T')[0]}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      ))
    )
  );

  const renderQAssignmentsContent = () => (
    filteredQAssignments.length === 0 ? (
      <Text style={styles.emptyText}>No questionnaire assignments found{'\n'}未找到問卷分配</Text>
    ) : (
      filteredQAssignments.map(item => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardTouchable}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.patients?.patient_name || 'Unknown'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteQAssign(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.assignedMeta}>
              <View style={styles.assessmentNameBadge}>
                <Text style={styles.assessmentNameText}>
                  {item.questionnaire_templates?.name || item.questionnaire_template_id}
                </Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: item.status === 'completed' ? Colors.successLight : item.status === 'pending' ? Colors.warningLight : Colors.surfaceSecondary
              }]}>
                <View style={[styles.statusDot, {
                  backgroundColor: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary
                }]} />
                <Text style={[styles.statusBadgeText, {
                  color: item.status === 'completed' ? Colors.success : item.status === 'pending' ? Colors.warning : Colors.textTertiary
                }]}>
                  {item.status || 'pending'}
                </Text>
              </View>
            </View>

            <View style={styles.assignedDetails}>
              {item.score != null && (
                <Text style={styles.scoreText}>Score: {item.score}</Text>
              )}
              {item.assigned_date && (
                <Text style={styles.dateText}>Assigned: {item.assigned_date}</Text>
              )}
              {item.due_date && (
                <View style={styles.deadlineBadge}>
                  <Calendar size={11} color={Colors.warning} />
                  <Text style={styles.deadlineText}>Due: {item.due_date}</Text>
                </View>
              )}
              {item.completed_date && (
                <Text style={[styles.dateText, { color: Colors.success }]}>Completed: {item.completed_date}</Text>
              )}
            </View>
            {item.notes && <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>}
          </View>
        </View>
      ))
    )
  );

  const renderQResponsesContent = () => (
    filteredQResponses.length === 0 ? (
      <Text style={styles.emptyText}>No questionnaire responses found{'\n'}未找到問卷回覆</Text>
    ) : (
      filteredQResponses.map(r => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardTouchable}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.patients?.patient_name || 'Unknown'}</Text>
                <Text style={styles.cardNameZh}>{r.questionnaire_templates?.name || r.questionnaire_template_id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setViewingResponse(r); setResponseDetailVisible(true); }}
                style={styles.viewBtn}
                activeOpacity={0.7}
              >
                <Eye size={14} color={Colors.info} />
                <Text style={styles.viewBtnText}>View 檢視</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.assignedDetails}>
              {r.total_score != null && (
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillText}>Score: {r.total_score}</Text>
                </View>
              )}
              {r.completed_at && (
                <Text style={styles.dateText}>Completed: {r.completed_at.split('T')[0]}</Text>
              )}
            </View>
          </View>
        </View>
      ))
    )
  );

  const renderContent = () => {
    if (isLibraryTab) return renderLibraryContent();
    if (isAssignedTab) return renderAssignedContent();
    if (isTemplatesTab) return renderTemplatesContent();
    if (isQAssignTab) return renderQAssignmentsContent();
    if (isQResponsesTab) return renderQResponsesContent();
    return null;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Assessments & Questionnaires</Text>
            <Text style={styles.headerSubtitle}>評估與問卷</Text>
          </View>
          {isAssignedTab && (
            <TouchableOpacity onPress={openBatchAssign} style={styles.headerAction}>
              <Users size={18} color={Colors.white} />
              <Text style={styles.headerActionText}>Batch 批量</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBarContent}>
        {TAB_CONFIG.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => { setActiveTab(tab.key); setSearch(''); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
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

      {isAssignedTab && (
        <View style={styles.infoBanner}>
          <Info size={16} color={Colors.info} />
          <Text style={styles.infoBannerText}>
            Assessments assigned here will be visible to patients. Research assessments remain in the Research tab.{'\n'}此處分配的評估將對患者可見。研究評估仍在研究標籤中。
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={getCurrentFetching()} onRefresh={handleRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {getCurrentLoading() ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : renderContent()}
      </ScrollView>

      {showFab && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleFabPress}
          activeOpacity={0.8}
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}

      {/* Library Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Assessment 編輯評估' : 'New Assessment 新增評估'}</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>ID (auto-generated) 識別碼</Text>
              <TextInput
                style={[styles.input, editingId ? styles.inputDisabled : null]}
                value={formId}
                onChangeText={editingId ? undefined : setFormId}
                editable={!editingId}
                placeholder="e.g. eat_10"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
              />
              {!editingId && (
                <Text style={styles.fieldHint}>Auto-generated from name. Must be unique snake_case.{'\n'}從名稱自動產生，必須唯一。</Text>
              )}

              <Text style={styles.fieldLabel}>Name (English) 英文名稱 *</Text>
              <TextInput
                style={styles.input}
                value={nameEn}
                onChangeText={handleNameEnChange}
                placeholder="Assessment name"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Name (Chinese) 中文名稱</Text>
              <TextInput
                style={styles.input}
                value={nameZh}
                onChangeText={setNameZh}
                placeholder="評估名稱"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Description (English) 英文描述</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={descEn}
                onChangeText={setDescEn}
                placeholder="Description"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>Description (Chinese) 中文描述</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={descZh}
                onChangeText={setDescZh}
                placeholder="描述"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>Type 類別</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowTypePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !selectedType && { color: Colors.textTertiary }]}>
                  {selectedType || 'Select type...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Reference 參考文獻</Text>
              <TextInput
                style={styles.input}
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. Belafsky et al. 2008"
                placeholderTextColor={Colors.textTertiary}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showTypePicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Type 選擇類別</Text>
              <FlatList
                data={ASSESSMENT_TYPES}
                keyExtractor={t => t}
                style={styles.pickerList}
                renderItem={({ item: t }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, selectedType === t && styles.pickerItemSelected]}
                    onPress={() => { setSelectedType(t); setShowTypePicker(false); }}
                  >
                    <Text style={styles.pickerItemName}>{t}</Text>
                    {selectedType === t && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Individual Assign Modal */}
      <Modal visible={assignModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Assign Assessment 指派評估</Text>
              <TouchableOpacity onPress={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                {assignMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Assign 指派</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {assigningAssessment && !assignFromTab && (
                <View style={styles.assignBanner}>
                  <ClipboardCheck size={18} color={Colors.accent} />
                  <View>
                    <Text style={styles.assignBannerText}>{assigningAssessment.name_en}</Text>
                    <Text style={styles.assignBannerId}>ID: {assigningAssessment.id}</Text>
                  </View>
                </View>
              )}

              {assignFromTab && (
                <>
                  <Text style={styles.fieldLabel}>Assessment 評估 *</Text>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => setShowAssessmentPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerBtnText, !selectedAssessmentOption && { color: Colors.textTertiary }]}>
                      {selectedAssessmentOption
                        ? `${selectedAssessmentOption.name_en}${selectedAssessmentOption.name_zh ? ` ${selectedAssessmentOption.name_zh}` : ''}`
                        : 'Select assessment...'}
                    </Text>
                    <ChevronDown size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.fieldLabel}>Patient 患者 *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => { setPatientSearch(''); setShowPatientPicker(true); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !selectedPatient && { color: Colors.textTertiary }]}>
                  {selectedPatient ? `${selectedPatient.patient_name} (${selectedPatient.access_code})` : 'Select patient...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Deadline 截止日期</Text>
              <TextInput
                style={styles.input}
                value={assignDeadline}
                onChangeText={setAssignDeadline}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
              />
              <Text style={styles.fieldHint}>Leave empty for no deadline. 留空表示無截止日期。</Text>

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showPatientPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPatientPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Patient 選擇患者</Text>
              <View style={styles.pickerSearchRow}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={filteredPatients}
                keyExtractor={p => p.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, assignPatientId === item.id && styles.pickerItemSelected]}
                    onPress={() => { setAssignPatientId(item.id); setShowPatientPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.patient_name}</Text>
                      <Text style={styles.pickerItemCode}>{item.access_code}</Text>
                    </View>
                    {assignPatientId === item.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No patients found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showAssessmentPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowAssessmentPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Assessment 選擇評估</Text>
              <FlatList
                data={assessmentOptionsQuery.data || []}
                keyExtractor={a => a.id}
                style={styles.pickerList}
                renderItem={({ item: a }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, assignAssessmentId === a.id && styles.pickerItemSelected]}
                    onPress={() => { setAssignAssessmentId(a.id); setShowAssessmentPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{a.name_en}</Text>
                      {a.name_zh ? <Text style={styles.pickerItemCode}>{a.name_zh}</Text> : null}
                    </View>
                    {assignAssessmentId === a.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No assessments found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Batch Assign Modal */}
      <Modal visible={batchModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setBatchModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Batch Assign 批量分配</Text>
              <TouchableOpacity onPress={() => batchAssignMutation.mutate()} disabled={batchAssignMutation.isPending}>
                {batchAssignMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Assign 分配</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Assessment 評估 *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowBatchAssessmentPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !batchSelectedAssessment && { color: Colors.textTertiary }]}>
                  {batchSelectedAssessment
                    ? `${batchSelectedAssessment.name_en}${batchSelectedAssessment.name_zh ? ` ${batchSelectedAssessment.name_zh}` : ''}`
                    : 'Select assessment...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Deadline 截止日期</Text>
              <TextInput
                style={styles.input}
                value={batchDeadline}
                onChangeText={setBatchDeadline}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={batchNotes}
                onChangeText={setBatchNotes}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <View style={styles.batchPatientsHeader}>
                <Text style={styles.fieldLabel}>
                  Patients 患者 * ({batchSelectedPatients.length} selected)
                </Text>
                <View style={styles.batchSelectActions}>
                  <TouchableOpacity onPress={selectAllPatients} style={styles.batchSelectBtn}>
                    <Text style={styles.batchSelectBtnText}>Select All 全選</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deselectAllPatients} style={styles.batchSelectBtn}>
                    <Text style={[styles.batchSelectBtnText, { color: Colors.danger }]}>Deselect 取消</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.batchSearchRow}>
                <Search size={14} color={Colors.textTertiary} />
                <TextInput
                  style={styles.batchSearchInput}
                  value={batchPatientSearch}
                  onChangeText={setBatchPatientSearch}
                  placeholder="Search patients..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                />
              </View>

              {patientsQuery.isLoading ? (
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 12 }} />
              ) : (
                batchFilteredPatients.map(p => {
                  const isSelected = batchSelectedPatients.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.batchPatientRow, isSelected && styles.batchPatientRowSelected]}
                      onPress={() => toggleBatchPatient(p.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.batchCheckbox, isSelected && styles.batchCheckboxChecked]}>
                        {isSelected && <Check size={12} color={Colors.white} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.batchPatientName}>{p.patient_name}</Text>
                        <Text style={styles.batchPatientCode}>{p.access_code}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showBatchAssessmentPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowBatchAssessmentPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Assessment 選擇評估</Text>
              <FlatList
                data={assessmentOptionsQuery.data || []}
                keyExtractor={a => a.id}
                style={styles.pickerList}
                renderItem={({ item: a }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, batchAssessmentId === a.id && styles.pickerItemSelected]}
                    onPress={() => { setBatchAssessmentId(a.id); setShowBatchAssessmentPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{a.name_en}</Text>
                      {a.name_zh ? <Text style={styles.pickerItemCode}>{a.name_zh}</Text> : null}
                    </View>
                    {batchAssessmentId === a.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No assessments found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Items/Questions Editor Modal */}
      <Modal visible={itemsEditorVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setItemsEditorVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Questions 編輯題目</Text>
              <TouchableOpacity onPress={() => saveItemsMutation.mutate()} disabled={saveItemsMutation.isPending}>
                {saveItemsMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>
                Questions ({editingQuestions.length}) 題目
              </Text>

              {editingQuestions.length === 0 && (
                <Text style={styles.emptyQText}>No questions yet. Add one below.{'\n'}尚無題目，請在下方新增。</Text>
              )}

              {editingQuestions.map((q, index) => (
                <View key={q.id} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.questionNum}>Q{index + 1}</Text>
                      <Text style={styles.questionText}>{q.text_en}</Text>
                      {q.text_zh ? <Text style={styles.questionTextZh}>{q.text_zh}</Text> : null}
                    </View>
                    <View style={styles.questionTypeBadge}>
                      <Text style={styles.questionTypeText}>{q.type}</Text>
                    </View>
                  </View>

                  {q.options && q.options.length > 0 && (
                    <View style={styles.questionOptions}>
                      {q.options.map((opt, oi) => (
                        <Text key={oi} style={styles.questionOptionText}>
                          {opt.value}: {opt.label_en}{opt.label_zh ? ` / ${opt.label_zh}` : ''}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.questionActions}>
                    <TouchableOpacity
                      onPress={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      style={[styles.qActionBtn, index === 0 && styles.qActionBtnDisabled]}
                    >
                      <ArrowUp size={14} color={index === 0 ? Colors.textTertiary : Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveQuestion(index, 'down')}
                      disabled={index === editingQuestions.length - 1}
                      style={[styles.qActionBtn, index === editingQuestions.length - 1 && styles.qActionBtnDisabled]}
                    >
                      <ArrowDown size={14} color={index === editingQuestions.length - 1 ? Colors.textTertiary : Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeQuestion(index)}
                      style={styles.qActionBtn}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addQuestionBtn}
                onPress={() => { resetNewQuestion(); setShowNewQuestionForm(!showNewQuestionForm); }}
                activeOpacity={0.7}
              >
                <Plus size={16} color={Colors.accent} />
                <Text style={styles.addQuestionBtnText}>
                  {showNewQuestionForm ? 'Hide Form 隱藏表單' : 'Add Question 新增題目'}
                </Text>
                {showNewQuestionForm ? <ChevronUp size={16} color={Colors.accent} /> : <ChevronDown size={16} color={Colors.accent} />}
              </TouchableOpacity>

              {showNewQuestionForm && (
                <View style={styles.newQuestionForm}>
                  <Text style={styles.fieldLabel}>Question (English) 英文題目 *</Text>
                  <TextInput
                    style={styles.input}
                    value={newQTextEn}
                    onChangeText={setNewQTextEn}
                    placeholder="Question text"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Question (Chinese) 中文題目</Text>
                  <TextInput
                    style={styles.input}
                    value={newQTextZh}
                    onChangeText={setNewQTextZh}
                    placeholder="題目"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Type 類型</Text>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => setShowNewQTypePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerBtnText}>{newQType}</Text>
                    <ChevronDown size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {newQType === 'likert' && (
                    <View style={styles.optionsSection}>
                      <View style={styles.optionsHeader}>
                        <Text style={styles.fieldLabel}>Options 選項</Text>
                        <TouchableOpacity onPress={addOption} style={styles.addOptionBtn}>
                          <Plus size={14} color={Colors.accent} />
                          <Text style={styles.addOptionText}>Add 新增</Text>
                        </TouchableOpacity>
                      </View>
                      {newQOptions.map((opt, oi) => (
                        <View key={oi} style={styles.optionRow}>
                          <TextInput
                            style={[styles.input, styles.optionValueInput]}
                            value={String(opt.value)}
                            onChangeText={v => updateOption(oi, 'value', v)}
                            keyboardType="number-pad"
                            placeholder="Val"
                            placeholderTextColor={Colors.textTertiary}
                          />
                          <TextInput
                            style={[styles.input, styles.optionLabelInput]}
                            value={opt.label_en}
                            onChangeText={v => updateOption(oi, 'label_en', v)}
                            placeholder="English"
                            placeholderTextColor={Colors.textTertiary}
                          />
                          <TextInput
                            style={[styles.input, styles.optionLabelInput]}
                            value={opt.label_zh}
                            onChangeText={v => updateOption(oi, 'label_zh', v)}
                            placeholder="中文"
                            placeholderTextColor={Colors.textTertiary}
                          />
                          <TouchableOpacity onPress={() => removeOption(oi)} style={styles.removeOptionBtn}>
                            <X size={14} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.confirmAddBtn}
                    onPress={addNewQuestion}
                    activeOpacity={0.7}
                  >
                    <Check size={16} color={Colors.white} />
                    <Text style={styles.confirmAddText}>Add Question 新增題目</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showNewQTypePicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowNewQTypePicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Question Type 題目類型</Text>
              <FlatList
                data={QUESTION_TYPES}
                keyExtractor={t => t}
                style={styles.pickerList}
                renderItem={({ item: t }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, newQType === t && styles.pickerItemSelected]}
                    onPress={() => { setNewQType(t); setShowNewQTypePicker(false); }}
                  >
                    <Text style={styles.pickerItemName}>{t}</Text>
                    {newQType === t && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Questionnaire Template Add/Edit Modal */}
      <Modal visible={tplModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setTplModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingTplId ? 'Edit Template 編輯問卷' : 'New Template 新增問卷'}</Text>
              <TouchableOpacity onPress={() => saveTplMutation.mutate()} disabled={saveTplMutation.isPending}>
                {saveTplMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save 儲存</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Template Name 問卷名稱 *</Text>
              <TextInput
                style={styles.input}
                value={tplName}
                onChangeText={setTplName}
                placeholder="e.g. Patient Satisfaction Survey"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Description (English) 英文描述</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={tplDescEn}
                onChangeText={setTplDescEn}
                placeholder="Description"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>Description (繁體中文)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={tplDescZhHant}
                onChangeText={setTplDescZhHant}
                placeholder="描述（繁體）"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <View style={styles.convertLabelRow}>
                <Text style={styles.fieldLabel}>Description (简体中文)</Text>
                <TouchableOpacity style={styles.convertBtn} onPress={() => setTplDescZhHans(trad2simp(tplDescZhHant))} activeOpacity={0.7}>
                  <Text style={styles.convertBtnText}>繁→简</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={tplDescZhHans}
                onChangeText={setTplDescZhHans}
                placeholder="描述（简体）"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <Text style={styles.fieldLabel}>Scoring Method 計分方式</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowScoringPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !tplScoringMethod && { color: Colors.textTertiary }]}>
                  {tplScoringMethod || 'Select scoring method...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active 啟用</Text>
                <Switch
                  value={tplIsActive}
                  onValueChange={setTplIsActive}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                />
              </View>

              <View style={styles.tplQuestionsSection}>
                <Text style={styles.sectionTitle}>
                  Questions ({tplQuestions.length}) 題目
                </Text>

                {tplQuestions.length === 0 && (
                  <Text style={styles.emptyQText}>No questions yet. Add below.{'\n'}尚無題目。</Text>
                )}

                {tplQuestions.map((q, index) => (
                  <View key={q.id} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.questionNum}>Q{index + 1}</Text>
                        <Text style={styles.questionText}>{q.en}</Text>
                        {q.zh_hant ? <Text style={styles.questionTextZh}>{q.zh_hant}</Text> : null}
                      </View>
                      <View style={styles.questionTypeBadge}>
                        <Text style={styles.questionTypeText}>{q.type}</Text>
                      </View>
                    </View>

                    {q.type === 'numeric_scale' && (
                      <View style={styles.questionOptions}>
                        <Text style={styles.questionOptionText}>
                          Range: {q.min ?? 0} - {q.max ?? 10} (step {q.step ?? 1})
                        </Text>
                        {q.min_label_en && <Text style={styles.questionOptionText}>Min: {q.min_label_en}</Text>}
                        {q.max_label_en && <Text style={styles.questionOptionText}>Max: {q.max_label_en}</Text>}
                        <Text style={styles.questionOptionText}>Positive: {q.positive ? 'Yes' : 'No'}</Text>
                      </View>
                    )}

                    {q.type === 'single_choice' && q.choices && q.choices.length > 0 && (
                      <View style={styles.questionOptions}>
                        {q.choices.map((c, ci) => (
                          <Text key={ci} style={styles.questionOptionText}>
                            {c.value}: {c.label_en}{c.label_zh_hant ? ` / ${c.label_zh_hant}` : ''}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.questionActions}>
                      <TouchableOpacity
                        onPress={() => moveTplQuestion(index, 'up')}
                        disabled={index === 0}
                        style={[styles.qActionBtn, index === 0 && styles.qActionBtnDisabled]}
                      >
                        <ArrowUp size={14} color={index === 0 ? Colors.textTertiary : Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveTplQuestion(index, 'down')}
                        disabled={index === tplQuestions.length - 1}
                        style={[styles.qActionBtn, index === tplQuestions.length - 1 && styles.qActionBtnDisabled]}
                      >
                        <ArrowDown size={14} color={index === tplQuestions.length - 1 ? Colors.textTertiary : Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeTplQuestion(index)}
                        style={styles.qActionBtn}
                      >
                        <Trash2 size={14} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addQuestionBtn}
                  onPress={() => { resetTplNewQuestion(); setShowTplQuestionForm(!showTplQuestionForm); }}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={Colors.accent} />
                  <Text style={styles.addQuestionBtnText}>
                    {showTplQuestionForm ? 'Hide Form 隱藏' : 'Add Question 新增題目'}
                  </Text>
                  {showTplQuestionForm ? <ChevronUp size={16} color={Colors.accent} /> : <ChevronDown size={16} color={Colors.accent} />}
                </TouchableOpacity>

                {showTplQuestionForm && (
                  <View style={styles.newQuestionForm}>
                    <Text style={styles.fieldLabel}>Type 類型</Text>
                    <TouchableOpacity
                      style={styles.pickerBtn}
                      onPress={() => setShowTplNewQTypePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickerBtnText}>{tplNewQType}</Text>
                      <ChevronDown size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <Text style={styles.fieldLabel}>Question (English) 英文題目 *</Text>
                    <TextInput
                      style={styles.input}
                      value={tplNewQEn}
                      onChangeText={setTplNewQEn}
                      placeholder="Question text"
                      placeholderTextColor={Colors.textTertiary}
                    />

                    <Text style={styles.fieldLabel}>Question (繁體中文)</Text>
                    <TextInput
                      style={styles.input}
                      value={tplNewQZhHant}
                      onChangeText={setTplNewQZhHant}
                      placeholder="題目（繁體）"
                      placeholderTextColor={Colors.textTertiary}
                    />

                    <View style={styles.convertLabelRow}>
                      <Text style={styles.fieldLabel}>Question (简体中文)</Text>
                      <TouchableOpacity style={styles.convertBtn} onPress={() => setTplNewQZhHans(trad2simp(tplNewQZhHant))} activeOpacity={0.7}>
                        <Text style={styles.convertBtnText}>繁→简</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={tplNewQZhHans}
                      onChangeText={setTplNewQZhHans}
                      placeholder="题目（简体）"
                      placeholderTextColor={Colors.textTertiary}
                    />

                    {tplNewQType === 'numeric_scale' && (
                      <>
                        <View style={styles.numericRow}>
                          <View style={styles.numericField}>
                            <Text style={styles.fieldLabel}>Min 最小</Text>
                            <TextInput
                              style={styles.input}
                              value={tplNewQMin}
                              onChangeText={setTplNewQMin}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor={Colors.textTertiary}
                            />
                          </View>
                          <View style={styles.numericField}>
                            <Text style={styles.fieldLabel}>Max 最大</Text>
                            <TextInput
                              style={styles.input}
                              value={tplNewQMax}
                              onChangeText={setTplNewQMax}
                              keyboardType="number-pad"
                              placeholder="10"
                              placeholderTextColor={Colors.textTertiary}
                            />
                          </View>
                          <View style={styles.numericField}>
                            <Text style={styles.fieldLabel}>Step 步長</Text>
                            <TextInput
                              style={styles.input}
                              value={tplNewQStep}
                              onChangeText={setTplNewQStep}
                              keyboardType="number-pad"
                              placeholder="1"
                              placeholderTextColor={Colors.textTertiary}
                            />
                          </View>
                        </View>

                        <Text style={styles.fieldLabel}>Min Label (EN)</Text>
                        <TextInput
                          style={styles.input}
                          value={tplNewQMinLabel}
                          onChangeText={setTplNewQMinLabel}
                          placeholder="e.g. Not at all"
                          placeholderTextColor={Colors.textTertiary}
                        />

                        <Text style={styles.fieldLabel}>Max Label (EN)</Text>
                        <TextInput
                          style={styles.input}
                          value={tplNewQMaxLabel}
                          onChangeText={setTplNewQMaxLabel}
                          placeholder="e.g. Extremely"
                          placeholderTextColor={Colors.textTertiary}
                        />

                        <View style={styles.switchRow}>
                          <Text style={styles.switchLabel}>Positive Direction 正向計分</Text>
                          <Switch
                            value={tplNewQPositive}
                            onValueChange={setTplNewQPositive}
                            trackColor={{ false: Colors.border, true: Colors.accent }}
                          />
                        </View>
                      </>
                    )}

                    {tplNewQType === 'single_choice' && (
                      <View style={styles.optionsSection}>
                        <View style={styles.optionsHeader}>
                          <Text style={styles.fieldLabel}>Choices 選項</Text>
                          <TouchableOpacity onPress={addTplChoice} style={styles.addOptionBtn}>
                            <Plus size={14} color={Colors.accent} />
                            <Text style={styles.addOptionText}>Add 新增</Text>
                          </TouchableOpacity>
                        </View>
                        {tplNewQChoices.map((c, ci) => (
                          <View key={ci} style={styles.choiceEditRow}>
                            <TextInput
                              style={[styles.input, styles.optionValueInput]}
                              value={c.value}
                              onChangeText={v => updateTplChoice(ci, 'value', v)}
                              placeholder="Val"
                              placeholderTextColor={Colors.textTertiary}
                            />
                            <TextInput
                              style={[styles.input, { flex: 1 }]}
                              value={c.label_en}
                              onChangeText={v => updateTplChoice(ci, 'label_en', v)}
                              placeholder="EN"
                              placeholderTextColor={Colors.textTertiary}
                            />
                            <TextInput
                              style={[styles.input, { flex: 1 }]}
                              value={c.label_zh_hant}
                              onChangeText={v => updateTplChoice(ci, 'label_zh_hant', v)}
                              placeholder="繁"
                              placeholderTextColor={Colors.textTertiary}
                            />
                            <TouchableOpacity onPress={() => removeTplChoice(ci)} style={styles.removeOptionBtn}>
                              <X size={14} color={Colors.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.confirmAddBtn}
                      onPress={addTplQuestion}
                      activeOpacity={0.7}
                    >
                      <Check size={16} color={Colors.white} />
                      <Text style={styles.confirmAddText}>Add Question 新增題目</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showScoringPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowScoringPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Scoring Method 計分方式</Text>
              <FlatList
                data={SCORING_METHODS}
                keyExtractor={m => m}
                style={styles.pickerList}
                renderItem={({ item: m }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, tplScoringMethod === m && styles.pickerItemSelected]}
                    onPress={() => { setTplScoringMethod(m); setShowScoringPicker(false); }}
                  >
                    <Text style={styles.pickerItemName}>{m}</Text>
                    {tplScoringMethod === m && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showTplNewQTypePicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTplNewQTypePicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Question Type 題目類型</Text>
              <FlatList
                data={Q_QUESTION_TYPES}
                keyExtractor={t => t}
                style={styles.pickerList}
                renderItem={({ item: t }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, tplNewQType === t && styles.pickerItemSelected]}
                    onPress={() => { setTplNewQType(t); setShowTplNewQTypePicker(false); }}
                  >
                    <Text style={styles.pickerItemName}>{t}</Text>
                    {tplNewQType === t && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Questionnaire Assign Modal */}
      <Modal visible={qAssignModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setQAssignModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Assign Questionnaire 分配問卷</Text>
              <TouchableOpacity onPress={() => qAssignMutation.mutate()} disabled={qAssignMutation.isPending}>
                {qAssignMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Assign 分配</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Template 問卷範本 *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowQAssignTemplatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !qAssignSelectedTemplate && { color: Colors.textTertiary }]}>
                  {qAssignSelectedTemplate ? qAssignSelectedTemplate.name : 'Select template...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Patient 患者 *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => { setQAssignPatientSearch(''); setShowQAssignPatientPicker(true); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !qAssignSelectedPatient && { color: Colors.textTertiary }]}>
                  {qAssignSelectedPatient ? `${qAssignSelectedPatient.patient_name} (${qAssignSelectedPatient.access_code})` : 'Select patient...'}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Due Date 截止日期</Text>
              <TextInput
                style={styles.input}
                value={qAssignDueDate}
                onChangeText={setQAssignDueDate}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Notes 備註</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={qAssignNotes}
                onChangeText={setQAssignNotes}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showQAssignPatientPicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowQAssignPatientPicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Patient 選擇患者</Text>
              <View style={styles.pickerSearchRow}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={qAssignPatientSearch}
                  onChangeText={setQAssignPatientSearch}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={qAssignFilteredPatients}
                keyExtractor={p => p.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, qAssignPatientId === item.id && styles.pickerItemSelected]}
                    onPress={() => { setQAssignPatientId(item.id); setShowQAssignPatientPicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.patient_name}</Text>
                      <Text style={styles.pickerItemCode}>{item.access_code}</Text>
                    </View>
                    {qAssignPatientId === item.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No patients found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showQAssignTemplatePicker} animationType="fade" transparent>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowQAssignTemplatePicker(false)}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerModalTitle}>Select Template 選擇問卷</Text>
              <FlatList
                data={(templatesQuery.data || []).filter(t => t.is_active !== false)}
                keyExtractor={t => t.id}
                style={styles.pickerList}
                renderItem={({ item: t }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, qAssignTemplateId === t.id && styles.pickerItemSelected]}
                    onPress={() => { setQAssignTemplateId(t.id); setShowQAssignTemplatePicker(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{t.name}</Text>
                      {t.description_en ? <Text style={styles.pickerItemCode} numberOfLines={1}>{t.description_en}</Text> : null}
                    </View>
                    {qAssignTemplateId === t.id && <Check size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No templates found</Text>}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Response Detail Modal */}
      <Modal visible={responseDetailVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResponseDetailVisible(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Response Detail 回覆詳情</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {viewingResponse && (
              <>
                <View style={styles.responseDetailHeader}>
                  <Text style={styles.responseDetailPatient}>{viewingResponse.patients?.patient_name || 'Unknown'}</Text>
                  <Text style={styles.responseDetailTemplate}>{viewingResponse.questionnaire_templates?.name || viewingResponse.questionnaire_template_id}</Text>
                  {viewingResponse.total_score != null && (
                    <View style={styles.responseScoreBig}>
                      <Text style={styles.responseScoreBigLabel}>Total Score 總分</Text>
                      <Text style={styles.responseScoreBigValue}>{viewingResponse.total_score}</Text>
                    </View>
                  )}
                  {viewingResponse.completed_at && (
                    <Text style={styles.responseDetailDate}>Completed: {viewingResponse.completed_at.split('T')[0]}</Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Answers 回答</Text>
                {viewingResponse.answers ? (
                  Object.entries(viewingResponse.answers).map(([key, val]) => (
                    <View key={key} style={styles.answerRow}>
                      <Text style={styles.answerKey}>{key}</Text>
                      <Text style={styles.answerValue}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyQText}>No answer data available{'\n'}無回答資料</Text>
                )}
              </>
            )}
          </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: { fontSize: 13, fontWeight: '600' as const, color: Colors.white },
  tabBarScroll: {
    maxHeight: 52,
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabBarContent: {
    padding: 4,
    gap: 4,
    alignItems: 'center',
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  tabTextActive: {
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    margin: 12, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.infoLight,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.info,
    lineHeight: 17,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10, overflow: 'hidden' as const,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardTouchable: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardNameZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardId: { fontSize: 11, color: Colors.textTertiary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  catBadge: { backgroundColor: Colors.infoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
  cardRef: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, fontStyle: 'italic' as const },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cardFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  cardFooterDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
  cardFooterBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  assignedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  assessmentNameBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assessmentNameText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accentDark },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' as const },
  assignedDetails: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  scoreText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  dateText: { fontSize: 13, color: Colors.textSecondary },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deadlineText: { fontSize: 11, fontWeight: '500' as const, color: Colors.warning },
  notesText: { fontSize: 12, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' as const },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  placeholderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  placeholderTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginTop: 12, textAlign: 'center' },
  placeholderSubtitle: { fontSize: 16, color: Colors.textSecondary },
  placeholderDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  goResearchBtn: {
    backgroundColor: '#1B6B4A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
  },
  goResearchText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
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
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, lineHeight: 15 },
  input: {
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textTertiary,
  },
  multilineInput: { height: 80, textAlignVertical: 'top' as const },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  assignBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accentLight,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  assignBannerText: { fontSize: 16, fontWeight: '600' as const, color: Colors.accentDark },
  assignBannerId: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerBtnText: { fontSize: 15, color: Colors.text, flex: 1 },
  pickerOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 30 },
  pickerModal: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, width: '100%', maxHeight: 500 },
  pickerModalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  pickerSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  pickerList: { maxHeight: 340 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 2,
  },
  pickerItemSelected: { backgroundColor: Colors.accentLight + '40' },
  pickerItemName: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  pickerItemCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  pickerEmpty: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: 20 },
  batchPatientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  batchSelectActions: {
    flexDirection: 'row',
    gap: 8,
  },
  batchSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  batchSelectBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  batchSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  batchSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  batchPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  batchPatientRowSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight + '20',
  },
  batchCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchCheckboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  batchPatientName: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  batchPatientCode: { fontSize: 12, color: Colors.textSecondary },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  emptyQText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
  questionCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  questionNum: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.accent,
    marginBottom: 4,
  },
  questionText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, lineHeight: 20 },
  questionTextZh: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  questionTypeBadge: {
    backgroundColor: Colors.infoLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  questionTypeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.info },
  questionOptions: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 3,
  },
  questionOptionText: { fontSize: 12, color: Colors.textSecondary },
  questionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  qActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: Colors.surfaceSecondary,
  },
  qActionBtnDisabled: { opacity: 0.4 },
  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addQuestionBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.accent },
  newQuestionForm: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  optionsSection: { marginTop: 8 },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  addOptionText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  optionValueInput: { width: 50, textAlign: 'center' as const, paddingHorizontal: 6 },
  optionLabelInput: { flex: 1 },
  removeOptionBtn: { padding: 6 },
  confirmAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
  confirmAddText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  tplMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  tplMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tplMetaText: { fontSize: 12, color: Colors.textTertiary },
  tplQuestionsSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  numericRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  numericField: {
    flex: 1,
  },
  choiceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.info },
  scorePill: {
    backgroundColor: Colors.successLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scorePillText: { fontSize: 13, fontWeight: '600' as const, color: Colors.success },
  responseDetailHeader: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  responseDetailPatient: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  responseDetailTemplate: { fontSize: 14, color: Colors.textSecondary },
  responseScoreBig: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  responseScoreBigLabel: { fontSize: 12, color: Colors.textTertiary },
  responseScoreBigValue: { fontSize: 36, fontWeight: '800' as const, color: Colors.accent, marginTop: 4 },
  responseDetailDate: { fontSize: 13, color: Colors.textTertiary, marginTop: 4 },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  answerKey: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary, flex: 1 },
  answerValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, textAlign: 'right' as const },
  convertLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
