// ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Home from '../../../screens/Home/HomeScreen';
import ProfileScreen from '../../../screens/Profile/ProfileScreen';
import EditProfileScreen from '../../../screens/Profile/EditProfileScreen';
import LanguageScreen from '../../../screens/Profile/LanguageScreen';
import ChangePasswordScreen from '../../../screens/Profile/ChangePasswordScreen';


const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="LanguageScreen" component={LanguageScreen} />
      <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />

    </Stack.Navigator>
  );
}
