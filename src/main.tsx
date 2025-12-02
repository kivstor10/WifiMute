// main.tsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Amplify, ResourcesConfig } from "aws-amplify"; 
import { LibraryOptions, ConsoleLogger } from "@aws-amplify/core"; 
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css'; 

// No longer importing generateClient or Schema here, as App will handle data directly
// import { generateClient } from "aws-amplify/data"; 
// import type { Schema } from "../amplify/data/resource"; 

const amplifyLogger = new ConsoleLogger('Amplify', 'VERBOSE');

// We still need this custom interface because outputs.json has a 'data' key
// that isn't directly part of the standard ResourcesConfig type.
interface CustomResourcesConfig extends ResourcesConfig {
    data?: { // This property holds your GraphQL API configuration
        url: string;
        aws_region: string;
        api_key?: string;
        default_authorization_type: string;
        authorization_types: string[];
        model_introspection: any; 
    };
}

async function configureAmplifyOnly() { // Renamed for clarity
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}amplify_outputs.json`);
    const outputs: CustomResourcesConfig = await response.json(); 

    console.log("Outputs object fetched from amplify_outputs.json:", outputs);

    // Configure Amplify globally with the outputs and logger options
    Amplify.configure(outputs, { 
      logger: amplifyLogger, 
    } as LibraryOptions);

    amplifyLogger.log('INFO', 'Amplify configuration completed and logger is active!');

    // Log the configuration to confirm the API endpoint is set
    console.log("Amplify.getConfig() after configure:", Amplify.getConfig());

    // Basic check to ensure GraphQL config is present before we proceed
    if (!outputs.data || !outputs.data.url) { 
      console.error("GraphQL API configuration ('data' key or its 'url') not found in amplify_outputs.json. Please ensure your backend is deployed correctly.");
      return false; // Indicate configuration failure
    }
    return true; // Indicate success
  } catch (error) {
    console.error("Failed to load Amplify configuration:", error);
    return false;
  }
}

function Root() {
  const [amplifyConfigured, setAmplifyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configureAmplifyOnly().then(success => {
      setAmplifyConfigured(success);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Loading application configuration...</div>;
  }

  if (!amplifyConfigured) {
    return <div>Failed to load Amplify configuration. Please check the console for errors.</div>;
  }

  return (
    <React.StrictMode>
      <Authenticator hideSignUp={true}>
        {() => (
          // <App> no longer receives a 'client' prop
          <App /> 
        )}
      </Authenticator>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);