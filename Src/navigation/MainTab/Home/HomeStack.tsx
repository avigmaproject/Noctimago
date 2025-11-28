// ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Home from '../../../screens/Home/HomeScreen';
import ProfileScreen from '../../../screens/Profile/ProfileScreen';
import EditProfileScreen from '../../../screens/Profile/EditProfileScreen';
import LanguageScreen from '../../../screens/Profile/LanguageScreen';
import ChangePasswordScreen from '../../../screens/Profile/ChangePasswordScreen';
import ManageUploadsScreen from '../../../screens/Profile/ManageUploadsScreen';
import PostDetailScreen from '../../../screens/Profile/PostDetail';
import FollowListScreen from '../../../screens/Notifications/FollowListScreen';
import ViewProfileScreen from '../../../screens/Notifications/ViewProfileScreen';
import LikedPost from '../../../screens/Profile/LikedPost';
import PeopleListScreen from '../../../screens/Profile/PeopleListScreen';
import SavedScreen from '../../../screens/Profile/Savedpost';
import MessageList from '../../../screens/Chat/Messagelist';
import Chat from '../../../screens/Chat/Chat';
import SettingsScreen from '../../../screens/Profile/SettingsScreen';
import NotificationsScreen from '../../../screens/Notifications/Notifications';
import UserMediaGrid from '../../../screens/Profile/UserMediaGrid';
const Stack = createStackNavigator();
import EditPostScreen from '../../../screens/Home/EditPostScreen';
import ContactUsScreen from '../../../components/ContactUsScreen';
import BlockListScreen from '../../../screens/Profile/BlockListScreen';
export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="LanguageScreen" component={LanguageScreen} />
      <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
      <Stack.Screen name="ManageUploadsScreen" component={ManageUploadsScreen} />
      <Stack.Screen name="PostDetailScreen" component={PostDetailScreen} />
      <Stack.Screen name="FollowListScreen" component={FollowListScreen} />
      <Stack.Screen name="ViewProfileScreen" component={ViewProfileScreen} />
      <Stack.Screen name="LikedPost" component={LikedPost} />
      <Stack.Screen name="PeopleListScreen" component={PeopleListScreen} />
      <Stack.Screen name="SavedScreen" component={SavedScreen} />
      <Stack.Screen name="MessageList" component={MessageList} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="EditPostScreen" component={EditPostScreen} />
      <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="UserMediaGrid" component={UserMediaGrid} />
      <Stack.Screen name="ContactUsScreen" component={ContactUsScreen} />
      <Stack.Screen name="BlockListScreen" component={BlockListScreen} />
    </Stack.Navigator>
  );
}
