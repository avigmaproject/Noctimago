import axios from 'axios';
import {API} from './baseurl';
// import messaging from '@react-native-firebase/messaging';
// import firebase from '@react-native-firebase/app';
import {Platform, PermissionsAndroid, Linking} from 'react-native';
const axiosTiming = instance => {
  instance.interceptors.request.use(request => {
    request.ts = Date.now();
    return request;
  });

  instance.interceptors.response.use(response => {
    const timeInMs = `${Number(Date.now() - response.config.ts).toFixed()}ms`;
    response.latency = timeInMs;
    return response;
  });
};
axiosTiming(axios);
export const login = async data => {
  return axios(API.LOGIN_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      throw error;
    });
};
export const register = async data => {
  return axios(API.REGISTRATION_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      throw error;
    });
};
export const profile = async ( access_token) => {
  return axios(API.USERPROFILE, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    
  })
    .then(response => response.data)
    .catch(error => {
      throw error;
    });
};
export const updateprofile = async (data, access_token) => {
  return axios(API.EDITPROFILE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      throw error;
    });
};
export const getuserhome = async (data, access_token) => {
  return axios(API.GET_USER_HOME, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getdebatevotedata = async (data, access_token) => {
  return axios(API.GET_DEBATE_FAVORITE_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getdebatefavoritedata = async (data, access_token) => {
  return axios(API.GET_DEBATE_FAVORITE_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdatefavoritedata = async (data, access_token) => {
  return axios(API.CREATE_UPDATE_DEBATE_FAVORITE_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdatedismissstatusdata = async (data, access_token) => {
  return axios(API.CREATE_UPDATE_USER_DISMISS_STATUS_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdatemasterblockdata = async (data, access_token) => {
  return axios(API.CREATE_UPDATE_MASTER_BLOCK_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getuserdebatereview = async (data, access_token) => {
  return axios(API.GET_USER_DEBATE_REVIEW, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getusernotification = async (data, access_token) => {
  return axios(API.GET_USER_NOTIFICATION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};

export const getdebatemaster = async (data, access_token) => {
  return axios(API.GET_DEBATE_MASTER_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const creteupdatefollowerdata = async (data, access_token) => {
  console.log('dattaaaa', data);
  return axios(API.CREATE_UPDATE_FOLLOWERS_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdatevotedata = async (data, access_token) => {
  console.log('dattaaaa', data);
  return axios(API.CREATE_UPDATE_VOTE_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdateratingreview = async (data, access_token) => {
  console.log('dattaaaa', data);
  return axios(API.CREATE_UPDATE_DEBATE_REVIEW, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getuserfollowerdata = async (data, access_token) => {
  return axios(API.GET_USER_FOLLOWER_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const forgotpassword = async data => {
  return axios(API.FORGOT_PASSWORD, {
    method: 'POST',
    data,
  })
    .then(response => response.data)
    .catch(error => {
      throw error;
    });
};
export const getusermasterdata = async (data, access_token) => {
  return axios(API.GET_USER_MASTER_DATA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const senddebatenotification = async (data, access_token) => {
  return axios(API.SEND_DEBATE_NOTIFICATION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdatedebatemaster = async (data, access_token) => {
  return axios(API.CREATE_UPDATE_DEBATE_MASTER, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const createupdateusernotification = async (data, access_token) => {
  return axios(API.CREATE_UPDATE_USER_NOTIFICATION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access_token,
    },
    data,
  })
    .then(response => response.data)
    .catch(error => {
      console.log('errorr comes');
      throw error;
    });
};
export const getRtmAccessToken = async data => {
  return axios('http://134.209.115.63:4001/getAgoraToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  })
    .then(response => {
      return response.data;
    })
    .catch(error => {
      console.log('errorororo', error);
      throw error;
    });
};
// export const getFcmToken = async () => {
//   await messaging().deleteToken();
//   const fcmToken = await firebase.messaging().getToken();
//   console.log('fcmToken', fcmToken);
//   return fcmToken;
// };
// export const requestUserPermission = async () => {
//   let authStatus = await firebase.messaging().hasPermission();
//   if (
//     authStatus !== firebase.messaging.AuthorizationStatus.AUTHORIZED ||
//     messaging.AuthorizationStatus.PROVISIONAL
//   ) {
//     authStatus = await firebase.messaging().requestPermission();
//   }
//   if (authStatus === firebase.messaging.AuthorizationStatus.AUTHORIZED) {
//     return authStatus;
//   }
// };
export const OpenURLButton = async url => {
  return Linking.openURL(url);
  // const url =
  //   "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
  // Linking.canOpenURL(url)
  //   .then((supported) => {
  //     if (!supported) {
  //       alert("Can't handle url")
  //       console.log("Can't handle url: " + url)
  //     } else {
  //       return Linking.openURL(url)
  //     }
  //   })
  //   .catch((err) => console.error("An error occurred", err))
};
export const gettimezone = () => {
  const systemTimeZoneOffsetMinutes = new Date().getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(systemTimeZoneOffsetMinutes) / 60);
  const offsetMinutes = Math.abs(systemTimeZoneOffsetMinutes) % 60;
  const offsetSign = systemTimeZoneOffsetMinutes <= 0 ? '+' : '-';
  const timeZone = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
  // console.log("timeZonetimeZone",timeZone);
  return timeZone
}