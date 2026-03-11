import { Configuration, PopupRequest, BrowserCacheLocation } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,  // Prevents redirect loop
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: true,  // Helps with Safari/popup issues
  },
  system: {
    allowNativeBroker: false,  // Prevents unexpected redirect behavior
  },
};

export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};
