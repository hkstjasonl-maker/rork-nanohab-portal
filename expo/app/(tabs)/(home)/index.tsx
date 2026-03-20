import React from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function DashboardScreen() {
  const test = useQuery({
    queryKey: ['mega-test-999'],
    queryFn: async () => {
      const { data, error, count } = await supabase.from('patients').select('*', { count: 'exact' });
      return `MEGA TEST v3 | rows=${data?.length} count=${count} err=${error?.message || 'none'} url=${(supabase as any).supabaseUrl || 'N/A'}`;
    },
  });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'yellow', padding: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'red', marginBottom: 20 }}>NANOHAB TEST PAGE</Text>
      <Text style={{ fontSize: 14, color: 'black', textAlign: 'center' }}>{test.data || 'Loading...'}</Text>
    </View>
  );
}
