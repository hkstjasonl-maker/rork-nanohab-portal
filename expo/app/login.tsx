import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shield, Stethoscope, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/colors';

type LoginTab = 'admin' | 'clinician';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginAdmin, loginClinician } = useAuth();
  const [activeTab, setActiveTab] = useState<LoginTab>('clinician');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const tabIndicator = useRef(new Animated.Value(1)).current;
  const passwordRef = useRef<TextInput>(null);

  const switchTab = useCallback((tab: LoginTab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    Animated.spring(tabIndicator, {
      toValue: tab === 'admin' ? 0 : 1,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [tabIndicator]);

  const adminMutation = useMutation({
    mutationFn: async () => {
      await loginAdmin(email.trim(), password);
    },
    onError: (error: Error) => {
      Alert.alert('Login Failed 登入失敗', error.message);
    },
  });

  const clinicianMutation = useMutation({
    mutationFn: async () => {
      await loginClinician(email.trim(), password);
    },
    onError: (error: Error) => {
      Alert.alert('Login Failed 登入失敗', error.message);
    },
  });

  const handleLogin = useCallback(() => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields 欄位不完整', 'Please enter email and password.\n請輸入電郵及密碼。');
      return;
    }
    if (activeTab === 'admin') {
      adminMutation.mutate();
    } else {
      clinicianMutation.mutate();
    }
  }, [activeTab, email, password, adminMutation, clinicianMutation]);

  const isLoading = adminMutation.isPending || clinicianMutation.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.appTitle}>NanoHab Portal</Text>
            <Text style={styles.appSubtitle}>醫家動管理平台</Text>
            <Text style={styles.appDescription}>Clinical Exercise Management</Text>
          </View>

          <View style={styles.cardContainer}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'admin' && styles.tabActive]}
                onPress={() => switchTab('admin')}
                testID="admin-tab"
                activeOpacity={0.7}
              >
                <Shield size={16} color={activeTab === 'admin' ? Colors.accent : Colors.textTertiary} />
                <Text style={[styles.tabText, activeTab === 'admin' && styles.tabTextActive]}>
                  Admin 管理員
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'clinician' && styles.tabActive]}
                onPress={() => switchTab('clinician')}
                testID="clinician-tab"
                activeOpacity={0.7}
              >
                <Stethoscope size={16} color={activeTab === 'clinician' ? Colors.accent : Colors.textTertiary} />
                <Text style={[styles.tabText, activeTab === 'clinician' && styles.tabTextActive]}>
                  Clinician 治療師
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email 電郵</Text>
                <View style={styles.inputContainer}>
                  <Mail size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email address"
                    placeholderTextColor={Colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    testID="email-input"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password 密碼</Text>
                <View style={styles.inputContainer}>
                  <Lock size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Enter password"
                    placeholderTextColor={Colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    testID="password-input"
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.textTertiary} />
                    ) : (
                      <Eye size={18} color={Colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
                testID="login-button"
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>
                    {activeTab === 'admin' ? 'Admin Sign In 管理員登入' : 'Clinician Sign In 治療師登入'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.footerText}>© Dr. Avive Group Limited. All rights reserved.</Text>
            <Text style={styles.footerCredit}>
              Created by Mr. Jason Lai Chung Him 黎頌謙先生
            </Text>
            <Text style={styles.footerCredit}>Speech-Language Pathologist</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0ED',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  appDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  formSection: {
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    gap: 2,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  footerCredit: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
});

