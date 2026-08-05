import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StreakCounter() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>StreakCounter</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  text: {
    color: '#f8fafc',
  },
});
