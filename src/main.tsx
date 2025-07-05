import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css'; 

// Async function to load Amplify configuration
async function configureAmplify() {
  try {
    // Fetch amplify_outputs.json at runtime from the public directory.
    // import.meta.env.BASE_URL will correctly resolve to '/' in both dev and production.
    const response = await fetch(`${import.meta.env.BASE_URL}amplify_outputs.json`);
    const outputs = await response.json();
    Amplify.configure(outputs);
  } catch (error) {
    console.error("Failed to load Amplify configuration:", error);
    // You might want to display an error message to the user or handle this more gracefully
  }
}

// Call the async function and then render the application
// This ensures Amplify is configured before the app components try to use it.
configureAmplify().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Authenticator hideSignUp={true}>
        {() => (
          <App />
        )}
      </Authenticator>
    </React.StrictMode>
  );
});