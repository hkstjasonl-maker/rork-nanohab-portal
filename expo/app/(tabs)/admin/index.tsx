import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Bell,
  ImagePlus,
  MessageSquare,
  Building2,
  Megaphone,
  UserCog,
  Building,
  Gift,
  Flower2,
  Video,
  Share2,
  Utensils,
  ClipboardCheck,
  Volume2,
  Crown,
  Shield,
  ChevronRight,
  GraduationCap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AdminSection {
  key: string;
  titleEn: string;
  titleZh: string;
  icon: React.ReactNode;
  route: string;
  countKey?: string;
}

const ICON_SIZE = 26;

const sections: AdminSection[] = [
  { key: 'clinicians', titleEn: 'Clinicians', titleZh: '治療師管理', icon: <Users size={ICON_SIZE} color={Colors.accent} />, route: '/admin/clinicians', countKey: 'clinicians' },
  { key: 'notifications', titleEn: 'Notifications', titleZh: '通知管理', icon: <Bell size={ICON_SIZE} color={Colors.info} />, route: '/admin/notifications', countKey: 'notifications' },
  { key: 'media-requests', titleEn: 'Media Requests', titleZh: '媒體申請', icon: <ImagePlus size={ICON_SIZE} color={Colors.warning} />, route: '/admin/media-requests', countKey: 'media_requests' },
  { key: 'user-feedback', titleEn: 'User Feedback', titleZh: '用戶反饋', icon: <MessageSquare size={ICON_SIZE} color={Colors.success} />, route: '/admin/user-feedback', countKey: 'feedback' },
  { key: 'organisations', titleEn: 'Organisations', titleZh: '合作機構', icon: <Building2 size={ICON_SIZE} color="#7C5CFC" />, route: '/admin/organisations', countKey: 'organisations' },
  { key: 'splash-ads', titleEn: 'Splash Ads', titleZh: '啟動廣告', icon: <Megaphone size={ICON_SIZE} color="#E05C8A" />, route: '/admin/splash-ads', countKey: 'splash_ads' },
  { key: 'therapist-settings', titleEn: 'Therapist Settings', titleZh: '治療師設定', icon: <UserCog size={ICON_SIZE} color="#4A90D9" />, route: '/admin/therapist-settings' },
  { key: 'managing-org', titleEn: 'Managing Org', titleZh: '管理機構', icon: <Building size={ICON_SIZE} color="#6B8E6B" />, route: '/admin/managing-org' },
  { key: 'marketing-draws', titleEn: 'Marketing Draws', titleZh: '行銷抽獎', icon: <Gift size={ICON_SIZE} color="#D4A030" />, route: '/admin/marketing-draws', countKey: 'marketing_campaigns' },
  { key: 'flower-garden', titleEn: 'Flower Garden', titleZh: '花田管理', icon: <Flower2 size={ICON_SIZE} color="#E07AAA" />, route: '/admin/flower-garden', countKey: 'flower_types' },
  { key: 'knowledge-videos', titleEn: 'Knowledge Videos', titleZh: '知識影片', icon: <Video size={ICON_SIZE} color="#5C7CFC" />, route: '/admin/knowledge-videos', countKey: 'knowledge_videos' },
  { key: 'feeding-skills', titleEn: 'Feeding Skills', titleZh: '餵食技巧', icon: <Utensils size={ICON_SIZE} color="#E0903A" />, route: '/admin/feeding-skills', countKey: 'feeding_skill_videos' },
  { key: 'reinforcement', titleEn: 'Reinforcement', titleZh: '強化音訊', icon: <Volume2 size={ICON_SIZE} color="#5CA0E0" />, route: '/admin/reinforcement' },
  { key: 'shared-exercises', titleEn: 'Shared Exercises', titleZh: '共享運動', icon: <Share2 size={ICON_SIZE} color={Colors.accent} />, route: '/admin/shared-exercises', countKey: 'shared_exercises' },
  { key: 'assessments', titleEn: 'Assessments', titleZh: '評估庫', icon: <ClipboardCheck size={ICON_SIZE} color="#2EAADC" />, route: '/admin/assessments' },
  { key: 'tier-management', titleEn: 'Tier Management', titleZh: '級別管理', icon: <Crown size={ICON_SIZE} color="#D4A030" />, route: '/admin/tier-management', countKey: 'clinician_tiers' },
  { key: 'advertisements', titleEn: 'Advertisements', titleZh: '廣告管理', icon: <Megaphone size={ICON_SIZE} color="#D94F7A" />, route: '/admin/advertisements', countKey: 'app_ads' },
  { key: 'training', titleEn: 'Training Library', titleZh: '培訓文庫', icon: <GraduationCap size={ICON_SIZE} color="#2D6A4F" />, route: '/admin/training', countKey: 'training_courses' },
];

export default function AdminHubScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const countsQuery = useQuery({
    queryKey: ['admin-hub-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      try {
        const { count: clinicianCount } = await supabase.from('clinicians').select('*', { count: 'exact', head: true });
        counts.clinicians = clinicianCount ?? 0;
      } catch (e) { console.log('Error fetching clinician count:', e); }

      try {
        const { count: notifCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
        counts.notifications = notifCount ?? 0;
      } catch (e) { console.log('Error fetching notification count:', e); }

      try {
        const { count: mediaCount } = await supabase.from('exercise_media_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        counts.media_requests = mediaCount ?? 0;
      } catch (e) { console.log('Error fetching media request count:', e); }

      try {
        const { count: feedbackCount } = await supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'new');
        counts.feedback = feedbackCount ?? 0;
      } catch (e) { console.log('Error fetching feedback count:', e); }

      try {
        const { count: sharedCount } = await supabase.from('shared_exercises').select('*', { count: 'exact', head: true });
        counts.shared_exercises = sharedCount ?? 0;
      } catch (e) { console.log('Error fetching shared exercises count:', e); }

      try {
        const { count: splashCount } = await supabase.from('splash_ads').select('*', { count: 'exact', head: true }).eq('is_active', true);
        counts.splash_ads = splashCount ?? 0;
      } catch (e) { console.log('Error fetching splash ads count:', e); }

      try {
        const { count: knowledgeCount } = await supabase.from('knowledge_videos').select('*', { count: 'exact', head: true });
        counts.knowledge_videos = knowledgeCount ?? 0;
      } catch (e) { console.log('Error fetching knowledge videos count:', e); }

      try {
        const { count: feedingCount } = await supabase.from('feeding_skill_videos').select('*', { count: 'exact', head: true });
        counts.feeding_skill_videos = feedingCount ?? 0;
      } catch (e) { console.log('Error fetching feeding skill videos count:', e); }

      try {
        const { count: campaignCount } = await supabase.from('marketing_campaigns').select('*', { count: 'exact', head: true }).eq('is_active', true);
        counts.marketing_campaigns = campaignCount ?? 0;
      } catch (e) { console.log('Error fetching marketing campaigns count:', e); }

      try {
        const { count: flowerCount } = await supabase.from('flower_types').select('*', { count: 'exact', head: true });
        counts.flower_types = flowerCount ?? 0;
      } catch (e) { console.log('Error fetching flower types count:', e); }

      try {
        const { count: orgCount } = await supabase.from('organisations').select('*', { count: 'exact', head: true });
        counts.organisations = orgCount ?? 0;
      } catch (e) { console.log('Error fetching organisations count:', e); }

      try {
        const { count: tierCount } = await supabase.from('clinician_tiers').select('*', { count: 'exact', head: true });
        counts.clinician_tiers = tierCount ?? 0;
      } catch (e) { console.log('Error fetching tier count:', e); }

      try {
        const { count: adCount } = await supabase.from('app_ads').select('*', { count: 'exact', head: true }).eq('is_active', true);
        counts.app_ads = adCount ?? 0;
      } catch (e) { console.log('Error fetching app ads count:', e); }

      try {
        const { count: trainingCount } = await supabase.from('training_courses').select('*', { count: 'exact', head: true }).eq('is_active', true);
        counts.training_courses = trainingCount ?? 0;
      } catch (e) { console.log('Error fetching training courses count:', e); }

      return counts;
    },
    enabled: isAdmin,
  });

  const onRefresh = useCallback(() => {
    void countsQuery.refetch();
  }, [countsQuery]);

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
          <View style={styles.headerIcon}>
            <Shield size={22} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Hub</Text>
            <Text style={styles.headerSubtitle}>管理中心</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={countsQuery.isFetching} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {sections.map((section) => {
            const count = section.countKey ? countsQuery.data?.[section.countKey] : undefined;
            return (
              <TouchableOpacity
                key={section.key}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(section.route as any)}
                testID={`admin-card-${section.key}`}
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconContainer}>
                    {section.icon}
                  </View>
                  {count !== undefined && count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{section.titleEn}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{section.titleZh}</Text>
                <View style={styles.cardArrow}>
                  <ChevronRight size={14} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47.5%' as any,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 120,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardArrow: {
    position: 'absolute',
    bottom: 12,
    right: 12,
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

