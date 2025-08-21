import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import AuthNavigation from './Src/navigation/Auth/AuthNavigation';
import {Provider, useDispatch, useSelector} from 'react-redux';
import {PersistGate} from 'redux-persist/lib/integration/react';
import store, {persistor} from './Src/store';
import {NativeBaseProvider} from 'native-base';

import Tabs from './Src/navigation/MainTab/TabNavigation';

const AppWrapper = () => (
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <NativeBaseProvider>
        <App />
      </NativeBaseProvider>
    </PersistGate>
  </Provider>
);
const App = () => {
  const [supported, setsupported] = useState(false);

  const dispatch = useDispatch();

   const user = useSelector(state => state.authReducer.loggedin);


  return (
    <NavigationContainer>
   
      {user ? <Tabs /> : <AuthNavigation />} 
     </NavigationContainer>
  );
};
export default AppWrapper;
