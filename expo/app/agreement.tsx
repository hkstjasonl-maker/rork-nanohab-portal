import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileCheck, CheckSquare, Square, ShieldCheck } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

const CLAUSES = [
  {
    num: 1,
    title: 'Data Handling',
    title_zh: '資料處理',
    body: 'I will handle all patient data in compliance with the PDPO.',
    body_zh: '本人將按照《個人資料（私隱）條例》處理所有患者資料。',
  },
  {
    num: 2,
    title: 'Confidentiality',
    title_zh: '保密責任',
    body: 'I will not disclose patient information to unauthorized parties.',
    body_zh: '本人不會向未經授權的人員透露患者資訊。',
  },
  {
    num: 3,
    title: 'Professional Use',
    title_zh: '專業用途',
    body: 'I will use this platform for legitimate clinical purposes only.',
    body_zh: '本人僅會將本平台用於合法臨床目的。',
  },
  {
    num: 4,
    title: 'Content Ownership',
    title_zh: '內容所有權',
    body: 'Exercise content I upload remains my intellectual property, but I grant Dr. Avive Group Limited a license to host and distribute it within the platform.',
    body_zh: '本人上傳的運動內容仍為本人之知識產權，惟本人授權 Dr. Avive Group Limited 在平台內託管及分發。',
  },
  {
    num: 5,
    title: 'Marketplace',
    title_zh: '市場條款',
    body: 'Marketplace transactions are governed by the platform terms. Revenue split is 70% clinician / 30% platform.',
    body_zh: '市場交易受平台條款約束。收入分成為治療師70% / 平台30%。',
  },
  {
    num: 6,
    title: 'Account Security',
    title_zh: '帳戶安全',
    body: 'I am responsible for keeping my login credentials secure.',
    body_zh: '本人有責任妥善保管登入憑據。',
  },
  {
    num: 7,
    title: 'Platform Updates',
    title_zh: '平台更新',
    body: 'The platform may be updated. Continued use constitutes acceptance of changes.',
    body_zh: '平台可能會更新。繼續使用即表示接受更改。',
  },
  {
    num: 8,
    title: 'Termination',
    title_zh: '終止條款',
    body: 'Dr. Avive Group Limited reserves the right to suspend accounts that violate these terms.',
    body_zh: 'Dr. Avive Group Limited 保留暫停違反條款帳戶之權利。',
  },
];

export default function AgreementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clinician, setNeedsAgreement } = useAuth();
  const [agreed, setAgreed] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!clinician) throw new Error('No clinician');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('clinicians')
        .update({ agreement_accepted_at: now })
        .eq('id', clinician.id);
      if (error) throw error;
      return now;
    },
    onSuccess: () => {
      console.log('Agreement accepted successfully');
      setNeedsAgreement(false);
      router.replace('/');
    },
    onError: (err) => {
      console.log('Error accepting agreement:', err);
    },
  });

  const handleAccept = useCallback(() => {
    if (!agreed) return;
    acceptMutation.mutate();
  }, [agreed, acceptMutation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={28} color={Colors.white} />
          </View>
        </View>

        <Text style={styles.title}>Clinician Agreement</Text>
        <Text style={styles.titleZh}>治療師使用協議</Text>
        <Text style={styles.subtitle}>NanoHab Portal — Dr. Avive Group Limited</Text>

        <View style={styles.divider} />

        {CLAUSES.map((clause) => (
          <View key={clause.num} style={styles.clauseCard}>
            <View style={styles.clauseHeader}>
              <View style={styles.clauseNumBadge}>
                <Text style={styles.clauseNumText}>{clause.num}</Text>
              </View>
              <View style={styles.clauseTitles}>
                <Text style={styles.clauseTitle}>{clause.title}</Text>
                <Text style={styles.clauseTitleZh}>{clause.title_zh}</Text>
              </View>
            </View>
            <Text style={styles.clauseBody}>{clause.body}</Text>
            <Text style={styles.clauseBodyZh}>{clause.body_zh}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.7}
          testID="agreement-checkbox"
        >
          {agreed ? (
            <CheckSquare size={22} color={Colors.accent} />
          ) : (
            <Square size={22} color={Colors.textTertiary} />
          )}
          <Text style={styles.checkboxLabel}>
            I have read and agree to the above terms.{'\n'}
            <Text style={styles.checkboxLabelZh}>本人已閱讀並同意上述條款。</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptBtn, !agreed && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!agreed || acceptMutation.isPending}
          activeOpacity={0.8}
          testID="agreement-accept-button"
        >
          {acceptMutation.isPending ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <FileCheck size={18} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.acceptBtnText}>Accept & Continue 接受並繼續</Text>
            </>
          )}
        </TouchableOpacity>

        {acceptMutation.isError && (
          <Text style={styles.errorText}>
            Failed to save agreement. Please try again.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  titleZh: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  clauseCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      },
    }),
  },
  clauseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  clauseNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clauseNumText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.accentDark,
  },
  clauseTitles: {
    flex: 1,
  },
  clauseTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  clauseTitleZh: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  clauseBody: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  clauseBodyZh: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 10,
    lineHeight: 20,
  },
  checkboxLabelZh: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  acceptBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.45,
  },
  acceptBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
