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
  Switch,
  KeyboardAvoidingView,
  Platform,
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
  Building2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Organisation {
  id: string;
  name: string;
  name_zh?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  created_at?: string;
}

export default function OrganisationsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const [name, setName] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);

  const orgsQuery = useQuery({
    queryKey: ['admin-organisations'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('organisations')
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
        return (data || []) as Organisation[];
      } catch (e: any) {
        console.log('Error fetching organisations:', e);
        if (e?.message?.includes('does not exist') || e?.code === '42P01') {
          setTableExists(false);
        }
        return [];
      }
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!orgsQuery.data) return [];
    if (!search.trim()) return orgsQuery.data;
    const s = search.toLowerCase();
    return orgsQuery.data.filter(o =>
      o.name?.toLowerCase().includes(s) ||
      o.name_zh?.toLowerCase().includes(s) ||
      o.contact_person?.toLowerCase().includes(s) ||
      o.email?.toLowerCase().includes(s)
    );
  }, [orgsQuery.data, search]);

  const openNew = useCallback(() => {
    setEditingOrg(null);
    setName('');
    setNameZh('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setIsActive(true);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((org: Organisation) => {
    setEditingOrg(org);
    setName(org.name || '');
    setNameZh(org.name_zh || '');
    setContactPerson(org.contact_person || '');
    setEmail(org.email || '');
    setPhone(org.phone || '');
    setAddress(org.address || '');
    setIsActive(org.is_active !== false);
    setModalVisible(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      const payload = {
        name: name.trim(),
        name_zh: nameZh.trim() || null,
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        is_active: isActive,
      };
      if (editingOrg) {
        const { error } = await supabase.from('organisations').update(payload).eq('id', editingOrg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organisations').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-organisations'] });
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

  if (!tableExists) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft size={24} color={Colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Organisations</Text>
              <Text style={styles.headerSubtitle}>合作機構</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.placeholderCenter}>
          <Building2 size={56} color={Colors.textTertiary} />
          <Text style={styles.placeholderTitle}>Coming Soon</Text>
          <Text style={styles.placeholderSubtitle}>即將推出</Text>
          <Text style={styles.placeholderDesc}>The organisations table has not been set up yet.{'\n'}Use the web portal to configure it.</Text>
        </View>
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
            <Text style={styles.headerTitle}>Organisations</Text>
            <Text style={styles.headerSubtitle}>合作機構</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organisations..."
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
          <RefreshControl refreshing={orgsQuery.isFetching} onRefresh={() => void orgsQuery.refetch()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {orgsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No organisations found</Text>
        ) : (
          filtered.map(org => (
            <TouchableOpacity key={org.id} style={styles.card} onPress={() => openEdit(org)} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{org.name}{org.name_zh ? ` ${org.name_zh}` : ''}</Text>
                  {org.contact_person && <Text style={styles.cardSub}>{org.contact_person}</Text>}
                  {org.email && <Text style={styles.cardSub}>{org.email}</Text>}
                </View>
                <View style={[styles.activeBadge, { backgroundColor: org.is_active !== false ? Colors.successLight : Colors.dangerLight }]}>
                  <Text style={[styles.activeBadgeText, { color: org.is_active !== false ? Colors.success : Colors.danger }]}>
                    {org.is_active !== false ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.8}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingOrg ? 'Edit' : 'New'} Organisation</Text>
              <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Name 名稱</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Organisation name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Name (Chinese) 中文名稱</Text>
              <TextInput style={styles.input} value={nameZh} onChangeText={setNameZh} placeholder="機構名稱" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Contact Person 聯絡人</Text>
              <TextInput style={styles.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Contact name" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Email 電郵</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Phone 電話</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.fieldLabel}>Address 地址</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Address" multiline placeholderTextColor={Colors.textTertiary} />

              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>Active 啟用</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.success, false: Colors.border }} />
              </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
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
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  activeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '600' as const },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  noAccessText: { fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary, textAlign: 'center', marginTop: 40 },
  placeholderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  placeholderTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginTop: 12 },
  placeholderSubtitle: { fontSize: 16, color: Colors.textSecondary },
  placeholderDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
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
  modalContent: { padding: 20 },
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
});
