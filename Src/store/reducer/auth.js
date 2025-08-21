export const initialState = {
  token: null,
  loggedin: false,
  stack: 'FeedStack',
  stackname: 'Feed',
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_LOGGED': {
      return {
        ...state,
        loggedin: true,
      };
    }
    case 'SIGN_OUT': {
      return {
        ...state,
        loggedin: false,
        token: null,
      };
    }
    case 'USER_PROFILE': {
      return {
        ...state,
        userprofile: action.userprofile,
      };
    }

    case 'SET_TOKEN': {
      return {
        ...state,
        token: action.token,
      };
    }
    case 'SET_INITIAL_ROUTE': {
      return {
        ...state,
        stack: action.stack,
      };
    }
    case 'SET_INITIAL_ROUTE_NAME': {
      return {
        ...state,
        stackname: action.stackname,
      };
    }

    default: {
      return state;
    }
  }
};

export default reducer;
