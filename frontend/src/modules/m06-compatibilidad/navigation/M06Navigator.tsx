import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CompatibilityScreen from '../screens/CompatibilityScreen';
import SharedPointsScreen from '../screens/SharedPointsScreen';
import SavedProfilesScreen from '../screens/SavedProfilesScreen';
import { M06StackParamList } from './types';

const Stack = createNativeStackNavigator<M06StackParamList>();

export function M06Navigator() {
  return (
    <Stack.Navigator
      initialRouteName="Compatibility"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Compatibility" component={CompatibilityScreen} />
      <Stack.Screen name="SharedPoints" component={SharedPointsScreen} />
      <Stack.Screen name="SavedProfiles" component={SavedProfilesScreen} />
    </Stack.Navigator>
  );
}
