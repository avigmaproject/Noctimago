// ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import NotificationsScreen from '../../../screens/Notifications/Notifications';
import ViewProfileScreen from '../../../screens/Notifications/ViewProfileScreen';
import FollowListScreen from '../../../screens/Notifications/FollowListScreen';
import PostDetailScreen from '../../../screens/Profile/PostDetail';
import Chat from '../../../screens/Chat/Chat';
import MessageList from '../../../screens/Chat/Messagelist';
import GroupChat from '../../../screens/Chat/GroupChat';
import GroupSettings from '../../../screens/Chat/GroupSettings';
import AddFriend from '../../../screens/Chat/AddFriend';
const Stack = createStackNavigator();


export default function NotificationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <Stack.Screen name="ViewProfileScreen" component={ViewProfileScreen} />
      <Stack.Screen name="FollowListScreen" component={FollowListScreen} />
      <Stack.Screen name="PostDetailScreen" component={PostDetailScreen} /> */}
       <Stack.Screen name="MessageList" component={MessageList} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="GroupSettings" component={GroupSettings} />
  <Stack.Screen name="GroupChat" component={GroupChat} />
  <Stack.Screen name="AddFriend" component={AddFriend} />
      

    </Stack.Navigator>
  );
}
