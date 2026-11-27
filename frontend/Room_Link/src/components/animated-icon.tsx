import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { color } from '@/constants/roomlink';

const desvanecer = new Keyframe({ 0: { opacity: 1 }, 100: { opacity: 0 } });

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  if (!visible) return null;

  const image = <Image contentFit="contain" style={styles.marcaSplash} source={require('@/assets/images/roomlink-mark.png')} />;
  return animate ? (
    <Animated.View
      entering={desvanecer.duration(reducedMotion ? 0 : 280).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View onLayout={() => {
      void SplashScreen.hideAsync().finally(() => setAnimate(true));
    }} style={styles.splashOverlay}>
      {image}
    </View>
  );
}

export function AnimatedIcon() {
  return <Image accessibilityLabel="RoomLink" contentFit="contain" style={styles.marcaSplash} source={require('@/assets/images/roomlink-symbol.svg')} />;
}

const styles = StyleSheet.create({
  marcaSplash: { width: 120, height: 120 },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
