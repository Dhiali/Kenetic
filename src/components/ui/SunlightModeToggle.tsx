import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SunlightModeToggle() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>SunlightModeToggle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#34d399',
    borderRadius: 12,
  },
  text: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
