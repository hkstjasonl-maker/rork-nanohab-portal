import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Download,
  FileSpreadsheet,
  ClipboardCheck,
  BarChart3,
  Share2,
  CheckCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        const jsonStr = JSON.stringify(val);
        return `"${jsonStr.replace(/"/g, '""')}"`;
      }
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

interface ExportJob {
  key: string;
  titleEn: string;
  titleZh: string;
  description: string;
  icon: React.ReactNode;
  viewName: string;
}

const EXPORTS: ExportJob[] = [
  {
    key: 'sessions',
    titleEn: 'Export Session Logs',
    titleZh: '匯出訓練記錄',
    description: 'All research participant session data with exercise details, completion rates, and ratings.',
    icon: <FileSpreadsheet size={24} color="#1B6B4A" />,
    viewName: 'research_export_sessions',
  },
  {
    key: 'assessments',
    titleEn: 'Export Assessments',
    titleZh: '匯出評估資料',
    description: 'All research assessments with scores, timepoints, and completion methods.',
    icon: <ClipboardCheck size={24} color="#3B82F6" />,
    viewName: 'research_export_assessments',
  },
  {
    key: 'adherence',
    titleEn: 'Export Adherence Summary',
    titleZh: '匯出依從性摘要',
    description: 'Per-participant adherence summary with total sessions, completion rates, and active days.',
    icon: <BarChart3 size={24} color="#8B5CF6" />,
    viewName: 'research_export_adherence_summary',
  },
];

interface ExportState {
  loading: boolean;
  done: boolean;
  preview: string[];
  rowCount: number;
  error: string | null;
}

export default function ResearchExport() {
  const [exportStates, setExportStates] = useState<Record<string, ExportState>>({});

  const handleExport = useCallback(async (job: ExportJob) => {
    setExportStates(prev => ({
      ...prev,
      [job.key]: { loading: true, done: false, preview: [], rowCount: 0, error: null },
    }));

    try {
      console.log(`Exporting ${job.viewName}...`);
      const { data, error } = await supabase
        .from(job.viewName)
        .select('*');

      if (error) throw error;
      if (!data || data.length === 0) {
        setExportStates(prev => ({
          ...prev,
          [job.key]: { loading: false, done: true, preview: [], rowCount: 0, error: 'No data to export 無資料可匯出' },
        }));
        return;
      }

      const csv = convertToCSV(data as Record<string, unknown>[]);
      const previewRows = csv.split('\n').slice(0, 4);

      console.log(`Export ${job.viewName}: ${data.length} rows, ${csv.length} chars`);

      if (Platform.OS !== 'web') {
        try {
          const FileSystem = require('expo-file-system');
          const Sharing = require('expo-sharing');
          const fileName = `${job.viewName}_${new Date().toISOString().split('T')[0]}.csv`;
          const filePath = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(filePath, {
              mimeType: 'text/csv',
              dialogTitle: `Export ${job.titleEn}`,
              UTI: 'public.comma-separated-values-text',
            });
          } else {
            Alert.alert('Export Ready', `${data.length} rows exported. File saved to cache.`);
          }
        } catch (shareErr) {
          console.log('Sharing error (non-critical):', shareErr);
          Alert.alert('Export Complete', `${data.length} rows ready. Sharing not available on this device.`);
        }
      } else {
        try {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${job.viewName}_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (webErr) {
          console.log('Web download error:', webErr);
          Alert.alert('Export Complete', `${data.length} rows exported.`);
        }
      }

      setExportStates(prev => ({
        ...prev,
        [job.key]: { loading: false, done: true, preview: previewRows, rowCount: data.length, error: null },
      }));
    } catch (err: any) {
      console.log('Export error:', err);
      setExportStates(prev => ({
        ...prev,
        [job.key]: { loading: false, done: false, preview: [], rowCount: 0, error: err?.message || 'Export failed' },
      }));
      Alert.alert('Export Error 匯出錯誤', err?.message || 'Unknown error');
    }
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.infoCard}>
        <Download size={20} color="#1B6B4A" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Data Export 資料匯出</Text>
          <Text style={styles.infoDesc}>
            Export research data as CSV files for analysis. Data is pulled from pre-built database views.
            {'\n'}匯出研究資料為 CSV 檔案以供分析。
          </Text>
        </View>
      </View>

      {EXPORTS.map(job => {
        const state = exportStates[job.key];
        return (
          <View key={job.key} style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIconBox}>
                {job.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exportTitle}>{job.titleEn}</Text>
                <Text style={styles.exportTitleZh}>{job.titleZh}</Text>
                <Text style={styles.exportDesc}>{job.description}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.exportBtn, state?.loading && styles.exportBtnDisabled]}
              onPress={() => handleExport(job)}
              disabled={state?.loading}
              activeOpacity={0.7}
              testID={`export-${job.key}-btn`}
            >
              {state?.loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Share2 size={16} color={Colors.white} />
                  <Text style={styles.exportBtnText}>Export CSV</Text>
                </>
              )}
            </TouchableOpacity>

            {state?.done && !state.error && (
              <View style={styles.resultBox}>
                <View style={styles.resultHeader}>
                  <CheckCircle size={14} color="#1B6B4A" />
                  <Text style={styles.resultCount}>{state.rowCount} rows exported</Text>
                </View>
                {state.preview.length > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Preview (first 3 rows):</Text>
                    {state.preview.map((row, i) => (
                      <Text key={i} style={[styles.previewRow, i === 0 && styles.previewHeader]} numberOfLines={1}>
                        {row}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {state?.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{state.error}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingTop: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1B6B4A10',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1B6B4A20',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1B6B4A',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  exportCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  exportIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  exportTitleZh: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  exportDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
    lineHeight: 17,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B6B4A',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  resultBox: {
    marginTop: 12,
    backgroundColor: '#1B6B4A08',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1B6B4A15',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  resultCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1B6B4A',
  },
  previewBox: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  previewLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  previewRow: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  previewHeader: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: Colors.dangerLight,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
  },
});
