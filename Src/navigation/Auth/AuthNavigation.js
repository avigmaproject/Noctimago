// AuthNavigation.tsx / .js
import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Splash from '../../screens/Splash/SplashScreen';
import SignIn from '../../screens/SignIn/SignIn';
import CreateAccountScreen from '../../screens/Signup/SignupScreen';
import Onboarding from '../../screens/Welcome/Onboarding';
import ForgotPasswordScreen from '../../screens/ForgotPassword/ForgotPasswordScreen';
import PasswordResetSentScreen from '../../screens/ForgotPassword/PasswordResetSentScreen';
import ResetPasswordScreen from '../../screens/ForgotPassword/ResetPasswordScreen';
const Stack = createStackNavigator();

export default function AuthNavigation() {
  const forFade = ({ current }) => ({
    cardStyle: { opacity: current.progress },
  });

  return (
    <Stack.Navigator screenOptions={{ cardStyleInterpolator: forFade, headerShown: false }}>
      {/* Pass onDone to Splash so it can leave after 5s */}
      <Stack.Screen name="Splash">
        {props => (
          <Splash
            {...props}
            onDone={() => props.navigation.replace('Onboarding')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Onboarding" component={Onboarding} />
      <Stack.Screen name="SignIn" component={SignIn} />
      <Stack.Screen name="CreateAccountScreen" component={CreateAccountScreen} />
      <Stack.Screen name="ForgotPasswordScreen" component={ForgotPasswordScreen} />
      <Stack.Screen name="PasswordResetSentScreen" component={PasswordResetSentScreen} />
      <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
