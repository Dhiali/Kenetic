// @ts-nocheck
// screens/Lens/BiophiliaLensScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions, Image } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useHaptics } from '../../hooks/useHaptics';
import { DraggableCard } from '../../components/common/DraggableCard';
import { TargetZone } from '../../components/common/TargetZone';
import { identifyPlant } from '../../services/api/mlKit';

const { width, height } = Dimensions.get('window');

export const BiophiliaLensScreen = () => {
  const { heavyImpact, mediumImpact, lightImpact } = useHaptics();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isActive, setIsActive] = useState(false);
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Animated values
  const lensPosition = useSharedValue({ x: width / 2 - 50, y: height - 150 });
  const lensScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    requestPermission();
  }, []);

  const handleLensActivate = useCallback(async () => {
    if (!cameraRef.current) return;
    
    setIsActive(true);
    lightImpact();
    
    // Animate lens opening
    lensScale.value = withSpring(1.2, { damping: 10 });
    
    try {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      
      // Crop to square
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: 0, originY: 0, width: photo.width, height: photo.width } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Identify the plant
      const result = await identifyPlant(manipResult.uri);
      setScannedItem(result);
      
      // Generate a simple quiz
      generateQuiz(result);
      setShowQuiz(true);
      
      // Flash effect
      flashOpacity.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(0, { duration: 300 })
      );
      
      mediumImpact();
    } catch (error) {
      console.error('Error scanning:', error);
    } finally {
      setIsScanning(false);
      lensScale.value = withSpring(1);
    }
  }, [lightImpact, mediumImpact]);

  const generateQuiz = useCallback((item: any) => {
    if (!item) return;
    
    // Simple quiz generation based on item category
    const questions = {
      tree: {
        question: `What type of plant is this?`,
        options: [item.name, 'Animal', 'Mineral', 'Fungus'],
        correct: item.name,
      },
      bird: {
        question: `Which category does this belong to?`,
        options: ['Mammal', 'Bird', 'Reptile', 'Fish'],
        correct: 'Bird',
      },
      flower: {
        question: `What is this?`,
        options: [item.name, 'Rock', 'Cloud', 'Building'],
        correct: item.name,
      },
    };
    
    const category = item.category?.toLowerCase() || 'tree';
    const q = questions[category as keyof typeof questions] || questions.tree;
    
    setQuizQuestion(q.question);
    setQuizOptions(q.options.sort(() => Math.random() - 0.5));
  }, []);

  const handleAnswerSelect = useCallback((answer: string) => {
    setSelectedAnswer(answer);
    
    // Check if correct (simplified - in real app, compare with correct answer)
    const isCorrect = answer === quizOptions[0]; // Simplified for demo
    
    if (isCorrect) {
      setPointsEarned(10);
      heavyImpact();
    } else {
      setPointsEarned(0);
      mediumImpact();
    }
  }, [heavyImpact, mediumImpact, quizOptions]);

  const lensGesture = Gesture.Pan()
    .onEnd((event) => {
      // Check if dragged to center of screen
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.sqrt(
        Math.pow(event.translationX + lensPosition.value.x - centerX, 2) +
        Math.pow(event.translationY + lensPosition.value.y - centerY, 2)
      );
      
      if (distance < 50) {
        runOnJS(handleLensActivate)();
      }
      
      // Reset position
      lensPosition.value = withSpring({ x: width / 2 - 50, y: height - 150 });
    });

  const lensStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lensPosition.value.x },
      { translateY: lensPosition.value.y },
      { scale: lensScale.value },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsActive(true)}
      >
        {/* Flash overlay */}
        <Animated.View style={[styles.flashOverlay, flashStyle]} />
        
        {/* Scanned item info */}
        {scannedItem && !showQuiz && (
          <View style={styles.scannedInfo}>
            <Text style={styles.scannedName}>{scannedItem.name}</Text>
            <Text style={styles.scannedCategory}>{scannedItem.category}</Text>
            <Text style={styles.scannedFact}>{scannedItem.fact}</Text>
          </View>
        )}
      </CameraView>

      {/* Lens Sphere - Draggable */}
      <GestureDetector gesture={lensGesture}>
        <Animated.View style={[styles.lensSphere, lensStyle]}>
          <View style={styles.lensInner} />
        </Animated.View>
      </GestureDetector>

      {/* Target Zone for lens activation */}
      <TargetZone
        size={80}
        isActive={true}
        style={styles.lensTarget}
      />

      {/* Quiz Modal */}
      {showQuiz && (
        <View style={styles.quizOverlay}>
          <View style={styles.quizContainer}>
            <Text style={styles.quizQuestion}>{quizQuestion}</Text>
            
            <View style={styles.quizOptions}>
              {quizOptions.map((option, index) => (
                <DraggableCard
                  key={index}
                  onDragEnd={(success) => {
                    if (success) {
                      runOnJS(handleAnswerSelect)(option);
                    }
                  }}
                  targetPosition={{ x: width / 2 - 100, y: height / 2 + 50 }}
                >
                  <View style={[
                    styles.quizOption,
                    selectedAnswer === option && styles.selectedOption,
                  ]}>
                    <Text style={styles.quizOptionText}>{option}</Text>
                  </View>
                </DraggableCard>
              ))}
            </View>

            {/* Truth Slot Target */}
            <TargetZone
              size={120}
              isActive={true}
              style={styles.truthSlot}
            />
            
            {selectedAnswer && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultText}>
                  {pointsEarned > 0 ? `+${pointsEarned} points!` : 'Try again!'}
                </Text>
                <Text style={styles.resultInfo}>
                  {pointsEarned > 0 
                    ? scannedItem?.fact || 'Correct!' 
                    : 'Keep learning!'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Points Counter */}
      <View style={styles.pointsCounter}>
        <Text style={styles.pointsText}>🌿 {pointsEarned}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  lensSphere: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000000',
    bottom: 100,
    alignSelf: 'center',
  },
  lensInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  lensTarget: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  scannedInfo: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 16,
  },
  scannedName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  scannedCategory: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  scannedFact: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  quizOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  quizQuestion: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 30,
    textAlign: 'center',
  },
  quizOptions: {
    width: '100%',
    gap: 15,
  },
  quizOption: {
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  selectedOption: {
    backgroundColor: '#0078FF',
    borderColor: '#0078FF',
  },
  quizOptionText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
  },
  truthSlot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -60 }],
    borderColor: '#0078FF',
  },
  resultContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0078FF',
    marginBottom: 8,
  },
  resultInfo: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  pointsCounter: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  permissionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 50,
  },
});