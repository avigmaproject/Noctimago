// components/AppleLoginButton.tsx
import React from 'react';
import {
  Alert,
  Platform,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {setLoggedIn, setToken} from '../store/action/auth/action';
import { Googlesignin } from '../utils/apiconfig';
// import { Linking } from 'react-native'; // if you later add Android web flow
import { useDispatch } from 'react-redux';
const AppleLoginButton = () => {
    const dispatch = useDispatch();
  const onAppleButtonPress = async () => {
    try {
      if (Platform.OS === 'ios' && appleAuth.isSupported) {
        // 🔐 Native Apple sign in on iOS
        const appleAuthRequestResponse = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        });

        const {
          user,
          email,
          fullName,
          identityToken,
          authorizationCode,
        } = appleAuthRequestResponse;

        if (!identityToken) {
          Alert.alert('Login failed', 'No identity token returned from Apple.');
          return;
        }

        console.log('Apple identity token:', identityToken);

        // 💡 remove your `return 0` – that was stopping the backend call
        const payload = JSON.stringify({
            provider:"apple",
            id_token: identityToken,
          });
          console.log("payload",payload)
          const res = await Googlesignin(payload);
          console.log("resss",res)
          if(res.status==='success'){
            dispatch(setToken(res.token));
            dispatch(setLoggedIn());
           
          
        // 2️⃣ Send token to your backend
        

       

       
      } else {
        // 👉 Android (or iOS < 13) – later you can open web OAuth here
        Alert.alert(
          'Not supported',
          'Sign in with Apple is only supported on iOS 13+ right now.',
        );
        // OR:
        // await Linking.openURL('https://your-backend.com/auth/apple/web-login');
      }
    } }catch (err: any) {
      if (err.code === appleAuth.Error.CANCELED) {
        return; // user cancelled
      }
      console.log('Apple Sign-In error', err);
      Alert.alert('Error', 'Could not complete Sign in with Apple.');
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={onAppleButtonPress}>
      <Ionicons name="logo-apple" size={20} color="#fff" style={styles.icon} />
      <Text style={styles.text}>Sign in with Apple</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop:20
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '600'
  },
});

export default AppleLoginButton;
