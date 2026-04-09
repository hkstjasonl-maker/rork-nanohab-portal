import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlaskConical } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import ResearchParticipants from '@/components/research/ResearchParticipants';
import ResearchSessions from '@/components/research/ResearchSessions';
import ResearchAssessments from '@/components/research/ResearchAssessments';
import ResearchExport from '@/components/research/ResearchExport';

const TABS = [
  { key: 'participants', labelEn: 'Participants', labelZh: '參與者' },
  { key: 'sessions', labelEn: 'Sessions', labelZh: '訓練記錄' },
  { key: 'assessments', labelEn: 'Assessments', labelZh: '評估' },
  { key: 'export', labelEn: 'Export', labelZh: '匯出' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function ResearchScreen() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('participants');

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <FlaskConical size={48} color={Colors.textTertiary} />
        <Text style={styles.noAccessText}>Admin access required{'\n'}需要管理員權限</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <FlaskConical size={22} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Research</Text>
            <Text style={styles.headerSubtitle}>研究管理</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                testID={`research-tab-${tab.key}`}
              >
                <Text style={[styles.tabLabelEn, isActive && styles.tabLabelActive]}>{tab.labelEn}</Text>
                <Text style={[styles.tabLabelZh, isActive && styles.tabLabelZhActive]}>{tab.labelZh}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === 'participants' && <ResearchParticipants />}
        {activeTab === 'sessions' && <ResearchSessions />}
        {activeTab === 'assessments' && <ResearchAssessments />}
        {activeTab === 'export' && <ResearchExport />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: '#1B6B4A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  tabBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  tabItemActive: {
    backgroundColor: '#1B6B4A',
  },
  tabLabelEn: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  tabLabelZh: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  tabLabelZhActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  noAccessText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

