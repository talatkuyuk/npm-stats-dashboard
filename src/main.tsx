import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.tsx";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import "./index.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

console.log("Auth0 Environment Variables:", {
  domain,
  clientId,
  audience,
  origin: window.location.origin,
});

// Check if Auth0 is configured
if (!domain || !clientId) {
  console.error("Auth0 configuration missing. Please check your .env file.");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={domain || "placeholder.auth0.com"}
      clientId={clientId || "placeholder-client-id"}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
        scope: "openid profile email",
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
      skipRedirectCallback={!domain || !clientId}
      onRedirectCallback={(appState) => {
        console.log("Auth0 redirect callback:", appState);
        // Navigate to the intended URL or default to current location
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo || window.location.pathname
        );
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </Auth0Provider>
  </StrictMode>
);
