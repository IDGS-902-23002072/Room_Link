import { Image } from 'expo-image';

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  return <Image accessibilityLabel="RoomLink" contentFit="contain" style={{ width: 120, height: 120 }} source={require('@/assets/images/roomlink-symbol.svg')} />;
}
