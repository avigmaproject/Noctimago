
const BASE_URL = 'https://noctimago.com/wp-json/app/v1/';


export const API = {
  LOGIN_API: BASE_URL + 'login',
  REGISTRATION_API: BASE_URL + 'register',
  USERPROFILE:BASE_URL + 'profile',
  EDITPROFILE:BASE_URL+ 'edit-profile',
  FORGOTTPASSWORD:BASE_URL+'forgot-password',
  RESETPASSWORD:BASE_URL+'reset-password',
  ADD_Post:BASE_URL+'create-post',
  GET_ALL_POST:BASE_URL+'get_posts',
  GET_POST_BY_USERID:BASE_URL+'user-posts',
  CHANGE_PASSWORD:BASE_URL+'change-password',
  ADD_FRIEND:BASE_URL+'add_friend',
  ALL_USER:BASE_URL+'users',
  UN_FRIEND:BASE_URL+'unfriend',
  GOOGLE_SIGNIN:BASE_URL+'login',
  SEND_NOTIFICATION:'https://apinotimagonot.ikaart.in/api/NoctimagoApi/sendNotification',
  GET_NOTIFICATION:'https://apinotimagonot.ikaart.in/api/NoctimagoApi/GetUserNotification',
  READ_NOTIFICATION:'https://apinotimagonot.ikaart.in/api/NoctimagoApi/CreateUpdateUserNotification',
  SEND_NOTIFICATIONCHAT:"https://apinotimagonot.ikaart.in/api/NoctimagoApi/sendNotificationMultiple"
};

// node_modules/react-native-paper/src/components/TextInput/Label/InputLabel.tsx changes on line number 157 color property
