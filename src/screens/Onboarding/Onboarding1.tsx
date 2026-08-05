import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Onboarding1() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Onboarding 1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    color: '#f8fafc',
  },
});
