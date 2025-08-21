// ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../../../screens/Profile/ProfileScreen';
import EditProfileScreen from '../../../screens/Profile/EditProfileScreen';
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  ManageUploads: undefined;
};
import ChangePasswordScreen from '../../../screens/Profile/ChangePasswordScreen';
import LanguageScreen from '../../../screens/Profile/LanguageScreen';
const Stack = createStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="LanguageScreen" component={LanguageScreen} />
      <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}
