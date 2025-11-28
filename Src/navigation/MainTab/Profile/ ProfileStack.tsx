// ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../../../screens/Profile/ProfileScreen';
import EditProfileScreen from '../../../screens/Profile/EditProfileScreen';
import ManageUploadsScreen from '../../../screens/Profile/ManageUploadsScreen';
import LikedPost from '../../../screens/Profile/LikedPost';
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  ManageUploads: undefined;
};
import ContactUsScreen from '../../../components/ContactUsScreen';
import ChangePasswordScreen from '../../../screens/Profile/ChangePasswordScreen';
import LanguageScreen from '../../../screens/Profile/LanguageScreen';
import PostDetailScreen from '../../../screens/Profile/PostDetail';
import PeopleListScreen from '../../../screens/Profile/PeopleListScreen';
import FollowListScreen from '../../../screens/Notifications/FollowListScreen';
import ViewProfileScreen from '../../../screens/Notifications/ViewProfileScreen';
import SavedScreen from '../../../screens/Profile/Savedpost';
import Chat from '../../../screens/Chat/Chat';
import MessageList from '../../../screens/Chat/Messagelist';
import EditPostScreen from '../../../screens/Home/EditPostScreen';
import SettingsScreen from '../../../screens/Profile/SettingsScreen';
import UserMediaGrid from '../../../screens/Profile/UserMediaGrid';
import BlockListScreen from '../../../screens/Profile/BlockListScreen';
const Stack = createStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="LanguageScreen" component={LanguageScreen} />
      <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
      <Stack.Screen name="ManageUploadsScreen" component={ManageUploadsScreen} />
      <Stack.Screen name="PostDetailScreen" component={PostDetailScreen}   options={{ tabBarVisible: false }}/>
      <Stack.Screen name="LikedPost" component={LikedPost} />
      <Stack.Screen name="PeopleListScreen" component={PeopleListScreen} />
      <Stack.Screen name="ViewProfileScreen" component={ViewProfileScreen} />
      <Stack.Screen name="FollowListScreen" component={FollowListScreen} />
      <Stack.Screen name="SavedScreen" component={SavedScreen} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="MessageList" component={MessageList} />
      <Stack.Screen name="EditPostScreen" component={EditPostScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="UserMediaGrid" component={UserMediaGrid} />
      <Stack.Screen name="ContactUsScreen" component={ContactUsScreen} />
      <Stack.Screen name="BlockListScreen" component={BlockListScreen} />
    </Stack.Navigator>



  );
}
