// store.js
import { createStore, applyMiddleware, compose } from 'redux';
import { thunk } from 'redux-thunk';          // <-- use named export
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import reducers from './reducer';

const persistConfig = { key: 'Btyb', storage: AsyncStorage };

const composeEnhancers =
  (typeof global === 'object' &&
    global.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
  compose;

const enhancer = composeEnhancers(applyMiddleware(thunk));

const persistedReducer = persistReducer(persistConfig, reducers);
const store = createStore(persistedReducer, enhancer);

export const persistor = persistStore(store);
export default store;
