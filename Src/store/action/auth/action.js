export const setToken = token => {
  return dispatch => {
    dispatch({type: 'SET_TOKEN', token: token});
  };
};

export const signout = () => {
  return dispatch => {
    dispatch({type: 'SIGN_OUT'});
  };
};

export const setLoggedIn = () => {
  return dispatch => {
    dispatch({
      type: 'SET_LOGGED',
    });
  };
};
export const UserProfile = userprofile => {
  return dispatch => {
    dispatch({type: 'USER_PROFILE', userprofile});
  };
};
export const setInitialroute = (stack) => {
  return (dispatch) => {
    dispatch({
      type: "SET_INITIAL_ROUTE",
      stack
    })
  }
}
export const setInitialName = (stackname) => {
  return (dispatch) => {
    dispatch({
      type: "SET_INITIAL_ROUTE_NAME",
      stackname
    })
  }
}