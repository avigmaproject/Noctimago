import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text } from 'react-native';
import HomeScreen from '../../screens/Home/HomeScreen';
import ProfileStack from './Profile/ ProfileStack';
import NotificationsScreen from './Notification/Notifications';
import NewPostScreen from './Upload/NewPostScreen';
import EventsScreen from './Explore/EventsScreen';
import HomeStack from './Home/HomeStack';
const Tab = createBottomTabNavigator();

const COLORS = {
  bg: '#0E0F12',            // bar background
  border: '#1F2127',        // top border
  active: '#E53935',        // red (active)
  inactive: '#8B8F98',      // grey (inactive)
  label: '#C7CAD1',
};

// Dummy screens — replace with your real ones
const Stub = ({ label }: {label: string}) => (
  <View style={{flex:1, backgroundColor:'#0B0C0F', alignItems:'center', justifyContent:'center'}}>
    <Text style={{color:'#fff'}}>{label}</Text>
  </View>
);

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: { fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 26,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let name: string = 'home-outline';
          switch (route.name) {
            case 'Home':
              name = focused ? 'home' : 'home-outline'; // filled red when active
              break;
            case 'Explore':
              name = focused ? 'compass' : 'compass-outline';
              break;
            case 'Upload':
              name = focused ? 'add-circle' : 'add-circle-outline';
              break;
            case 'Profile':
              name = focused ? 'person' : 'person-outline';
              break;
            case 'Notifications':
              name = focused ? 'notifications' : 'notifications-outline';
              break;
          }
          // Slightly larger + icon looks closer to your mock
          const iconSize = route.name === 'Upload' ? 26 : size;
          return <Ionicons name={name} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Explore" component={EventsScreen} />
      <Tab.Screen name="Upload" component={NewPostScreen} />
      <Tab.Screen name="Profile" component={ProfileStack }/>
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}
