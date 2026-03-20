import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function DashboardScreen() {
  const test = useQuery({
    queryKey: ['client-test-v5'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const role = session?.data?.session?.user?.role || 'no-session';
      const { data, error, count } = await supabase.from('patients').select('id, patient_name', { count: 'exact' });
      return `v5 | role=${role} | count=${count} | len=${data?.length} | err=${error?.message || 'none'} | first=${data?.[0]?.patient_name || 'N/A'}`;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: 'lime', padding: 40, paddingTop: 80 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'black', marginBottom: 20 }}>CLIENT TEST v5</Text>
      <Text style={{ fontSize: 12, color: 'black' }} selectable>{test.data || 'Loading...'}</Text>
    </View>
  );
}
