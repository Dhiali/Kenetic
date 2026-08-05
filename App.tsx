import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const cards = [
  { id: 1, label: 'BioRadar', icon: '🌍' },
  { id: 2, label: 'Biophilia Lens', icon: '🔍' },
  { id: 3, label: 'Habit Anchor', icon: '🎯' },
];

export default function App() {
  const positions = useRef(
    cards.map(() => new Animated.ValueXY({ x: 0, y: 0 })),
  ).current;

  const responders = useRef(
    cards.map((_, index) =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          positions[index].setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: () => {
          Animated.spring(positions[index], {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    ),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.content}>
        <Text style={styles.title}>KENETIC</Text>
        <Text style={styles.subtitle}>Drag cards to the center</Text>

        {cards.map((card, index) => (
          <Animated.View
            key={card.id}
            style={[
              styles.card,
              {
                transform: positions[index].getTranslateTransform(),
              },
            ]}
            {...responders[index].panHandlers}
          >
            <Text style={styles.cardIcon}>{card.icon}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </Animated.View>
        ))}

        <View style={styles.targetZone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 40,
  },
  card: {
    width: '80%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  cardIcon: {
    fontSize: 28,
  },
  
  targetZone: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#000000',
    marginTop: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});