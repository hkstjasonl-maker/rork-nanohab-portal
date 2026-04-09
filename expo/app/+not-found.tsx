import { Link, Stack } from "expo-router";
import React from 'react';
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>此頁面不存在</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen 回到首頁</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F2F0ED",
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  link: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent,
    borderRadius: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});
