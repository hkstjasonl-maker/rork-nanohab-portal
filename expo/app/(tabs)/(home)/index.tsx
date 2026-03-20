import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';

export default function DashboardScreen() {
  const test = useQuery({
    queryKey: ['raw-fetch-test'],
    queryFn: async () => {
      try {
        const url = 'https://pfgtnrlgetomfmrzbxgb.supabase.co/rest/v1/patients?select=id,patient_name&limit=3';
        const res = await fetch(url, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3RucmxnZXRvbWZtcnpieGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Mzc5NjcsImV4cCI6MjA4ODIxMzk2N30.pmYusCbBGFuHe_Gy-Fvac3LUwqyLZgR0srhrARhr7Uk',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3RucmxnZXRvbWZtcnpieGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Mzc5NjcsImV4cCI6MjA4ODIxMzk2N30.pmYusCbBGFuHe_Gy-Fvac3LUwqyLZgR0srhrARhr7Uk',
          },
        });
        const status = res.status;
        const text = await res.text();
        return `STATUS=${status} BODY=${text.slice(0, 500)}`;
      } catch (e: any) {
        return `FETCH ERROR: ${e?.message || e}`;
      }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: 'yellow', padding: 40, paddingTop: 80 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' as const, color: 'red', marginBottom: 20 }}>RAW FETCH TEST</Text>
      <ScrollView>
        <Text selectable style={{ fontSize: 12, color: 'black' }}>{test.data || 'Loading...'}</Text>
      </ScrollView>
    </View>
  );
}
