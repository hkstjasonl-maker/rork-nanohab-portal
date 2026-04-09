import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as ScreenCapture from 'expo-screen-capture';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/colors';

export default function PdfViewerScreen() {
  const { url, title, materialId, assignmentId } = useLocalSearchParams<{
    url: string;
    title: string;
    materialId: string;
    assignmentId: string;
  }>();
  const router = useRouter();
  const { clinician } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        ScreenCapture.preventScreenCaptureAsync('pdf-viewer');
        const sub = ScreenCapture.addScreenshotListener(() => {
          Alert.alert(
            'Screenshot Detected 偵測到截圖',
            'Screenshots of training materials are not permitted.\n培訓資料不允許截圖。'
          );
        });
        return () => {
          ScreenCapture.allowScreenCaptureAsync('pdf-viewer');
          sub.remove();
        };
      }
    }, [])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      Alert.alert(
        'Session Expired 會話已過期',
        'Please reopen the document.\n請重新開啟文件。',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }, 14 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [router]);

  const watermarkName = clinician?.full_name || clinician?.email || 'User';
  const watermarkEmail = clinician?.email || '';
  const watermarkText = `Licensed to: ${watermarkName}\n${watermarkEmail}\nNanoHab Training — Do Not Distribute`;

  const pdfViewerUrl = url
    ? `https://docs.google.com/gviewembedded?url=${encodeURIComponent(url)}`
    : '';

  if (!url) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>No document URL provided.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || 'Document'}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.pdfContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' } as any}
            title={title || 'PDF Viewer'}
          />
        ) : (
          <WebView
            source={{ uri: pdfViewerUrl }}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              Alert.alert('Error 錯誤', 'Could not load the document.\n無法載入文件。');
            }}
            javaScriptEnabled
            scalesPageToFit
            startInLoadingState={false}
          />
        )}

        {isLoading && Platform.OS !== 'web' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading document...{'\n'}載入文件中...</Text>
          </View>
        )}

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.watermarkRow,
                { top: `${10 + i * 25}%` as any },
              ]}
            >
              <Text style={styles.watermarkText}>{watermarkText}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  pdfContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  watermarkRow: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    transform: [{ rotate: '-30deg' }],
  },
  watermarkText: {
    fontSize: 14,
    color: 'rgba(150, 150, 150, 0.15)',
    textAlign: 'center',
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 14,
  },
});
