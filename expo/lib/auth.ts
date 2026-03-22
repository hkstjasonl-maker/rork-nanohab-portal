import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase, authClient } from './supabase';
import { Clinician, ClinicianTier, UserRole } from '@/types';

const AUTH_STORAGE_KEY = 'nanohab_auth';
const SALT = '_slp_jason_salt';

interface StoredAuth {
  role: UserRole;
  adminUserId?: string;
  adminEmail?: string;
  clinicianId?: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsAgreement, setNeedsAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string } | null>(null);
  const [clinician, setClinician] = useState<Clinician | null>(null);
  const [clinicianTier, setClinicianTier] = useState<ClinicianTier | null>(null);

  const loadClinicianTier = useCallback(async (tierId: string) => {
    try {
      const { data } = await supabase
        .from('clinician_tiers')
        .select('*')
        .eq('id', tierId)
        .single();
      if (data) {
        setClinicianTier(data as ClinicianTier);
      }
    } catch (e) {
      console.log('Error loading clinician tier:', e);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }

      const parsed: StoredAuth = JSON.parse(stored);

      if (parsed.role === 'admin') {
        const { data: { session } } = await authClient.auth.getSession();
        if (session) {
          setAdminUser({ id: session.user.id, email: session.user.email || '' });
          setRole('admin');
          setIsAuthenticated(true);
        } else {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } else if (parsed.role === 'clinician' && parsed.clinicianId) {
        const { data } = await supabase
          .from('clinicians')
          .select('*')
          .eq('id', parsed.clinicianId)
          .single();
        if (data && data.is_active !== false) {
          const c = data as Clinician;
          setClinician(c);
          setRole('clinician');
          setIsAuthenticated(true);
          setNeedsAgreement(!c.agreement_accepted_at);
          if (c.tier_id) {
            void loadClinicianTier(c.tier_id);
          }
        } else {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.log('Error restoring session:', e);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [loadClinicianTier]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Login failed');

    setAdminUser({ id: data.user.id, email: data.user.email || email });
    setRole('admin');
    setIsAuthenticated(true);

    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      role: 'admin',
      adminUserId: data.user.id,
      adminEmail: data.user.email || email,
    }));
  }, []);

  const loginClinician = useCallback(async (email: string, password: string) => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + SALT
    );

    const { data, error } = await supabase
      .from('clinicians')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('password_hash', hash)
      .single();

    if (error || !data) throw new Error('Invalid email or password 電郵或密碼錯誤');
    if (data.is_active === false) throw new Error('Account is deactivated 帳戶已停用');
    if (data.is_approved === false) throw new Error('Account pending approval 帳戶待批准');

    await supabase.from('clinicians').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);

    const c = data as Clinician;
    setClinician(c);
    setRole('clinician');
    setIsAuthenticated(true);
    setNeedsAgreement(!c.agreement_accepted_at);

    if (c.tier_id) {
      void loadClinicianTier(c.tier_id);
    }

    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      role: 'clinician',
      clinicianId: c.id,
    }));
  }, [loadClinicianTier]);

  const logout = useCallback(async () => {
    try {
      if (role === 'admin') {
        await authClient.auth.signOut();
      }
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.log('Error during logout:', e);
    } finally {
      setIsAuthenticated(false);
      setRole(null);
      setAdminUser(null);
      setClinician(null);
      setClinicianTier(null);
      setNeedsAgreement(false);
    }
  }, [role]);

  const clinicianCan = useCallback((feature: string): boolean => {
    if (role === 'admin') return true;
    if (!clinician) {
      console.log(`clinicianCan(${feature}): no clinician`);
      return false;
    }

    const overrideKey = `override_can_${feature}` as keyof Clinician;
    const overrideVal = clinician[overrideKey];
    if (overrideVal === true) {
      console.log(`clinicianCan(${feature}): override=true`);
      return true;
    }
    if (overrideVal === false) {
      console.log(`clinicianCan(${feature}): override=false`);
      return false;
    }

    if (clinicianTier) {
      const tierKey = `can_${feature}` as keyof ClinicianTier;
      const tierVal = (clinicianTier[tierKey] as boolean) || false;
      console.log(`clinicianCan(${feature}): tier.${tierKey}=${tierVal}`);
      return tierVal;
    }

    console.log(`clinicianCan(${feature}): no tier, defaulting false`);
    return false;
  }, [role, clinician, clinicianTier]);

  const isAdmin = role === 'admin';

  return useMemo(() => ({
    isAuthenticated,
    isLoading,
    role,
    isAdmin,
    adminUser,
    clinician,
    clinicianTier,
    needsAgreement,
    loginAdmin,
    loginClinician,
    logout,
    clinicianCan,
    setNeedsAgreement,
  }), [isAuthenticated, isLoading, role, isAdmin, adminUser, clinician, clinicianTier, needsAgreement, loginAdmin, loginClinician, logout, clinicianCan]);
});

