import { Configuration, PopupRequest } from '@azure/msal-browser';

// These values come from your Azure App Registration.
// Replace with your actual values from the Azure Portal.
// Store them in a .env file — never hardcode in production.
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'YOUR_TENANT_ID'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

// Scopes requested at login — openid/profile/email are standard
// Add your API scope here if you register a backend API in Azure
export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Optional: if you register your backend as an Azure API,
// add the scope here so the frontend can call it with a token:
// export const apiRequest: PopupRequest = {
//   scopes: [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`],
// };
