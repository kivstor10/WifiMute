// App.tsx
import { useEffect, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

import Navbar from "./Navbar";
import PinLock from "./components/PinLock";
import usePinAuth from "./hooks/usePinAuth";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// AWS IoT Core SDK imports
import { 
    IoTDataPlaneClient, 
    PublishCommand 
} from "@aws-sdk/client-iot-data-plane";

// Fixed ID for the singleton app state record
const APP_STATE_ID = 'global-state';

// Lazy-initialized Amplify Data client (to ensure Amplify is configured first)
let _client: ReturnType<typeof generateClient<Schema>> | null = null;
const getClient = () => {
  if (!_client) {
    _client = generateClient<Schema>();
  }
  return _client;
};

// AWS IoT Configuration
const IOT_ENDPOINT = 'a2b1ubzmtkza2j-ats.iot.eu-west-2.amazonaws.com';
const IOT_REGION = 'eu-west-2';
const MQTT_TOPIC = 'block/device';


// Define props for App component
interface AppProps {
  // No props currently needed
}

// Helper function to get IoT client with credentials
const getIotClient = async () => {
    const session = await fetchAuthSession();
    const credentials = session.credentials;
    
    console.log('🔑 Cognito Identity ID:', session.identityId);

    if (!credentials) {
        throw new Error("No AWS credentials available. User may not be authenticated.");
    }

    return new IoTDataPlaneClient({
        region: IOT_REGION,
        endpoint: `https://${IOT_ENDPOINT}`,
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
        }
    });
};

// Helper function to publish block/unblock commands to AWS IoT Core
const publishIotCommand = async (targetIp: string, commandStatus: 'block' | 'unblock') => {
    if (!targetIp || !commandStatus) {
        console.error("Missing IP or Status command.");
        return;
    }

    const payload = JSON.stringify({
        ip: targetIp,
        status: commandStatus 
    });

    try {
        const iotClient = await getIotClient();

        const command = new PublishCommand({
            topic: MQTT_TOPIC, 
            payload: new TextEncoder().encode(payload), 
            qos: 0,
        });

        await iotClient.send(command);
        console.log(`✅ IoT Command sent: ${commandStatus} ${targetIp}`);

    } catch (error) {
        console.error(`❌ Failed to publish command to IoT Core:`, error);
        alert("Command failed! Check Pi connectivity or IAM permissions.");
    }
};

// Helper function to publish schedule commands to AWS IoT Core
const publishScheduleCommand = async (enable: boolean) => {
    const payload = JSON.stringify({
        command: enable ? 'schedule_enable' : 'schedule_disable'
    });

    console.log(`📤 Attempting to send schedule command: ${payload}`);

    try {
        const iotClient = await getIotClient();
        console.log('🔌 IoT client created successfully');

        const command = new PublishCommand({
            topic: MQTT_TOPIC, 
            payload: new TextEncoder().encode(payload), 
            qos: 0,
        });

        const result = await iotClient.send(command);
        console.log(`✅ IoT Schedule Command sent: ${enable ? 'schedule_enable' : 'schedule_disable'}`, result);

    } catch (error: any) {
        console.error(`❌ Failed to publish schedule command to IoT Core:`, error);
        console.error(`❌ Error name: ${error?.name}, message: ${error?.message}`);
        alert("Schedule command failed! Check Pi connectivity or IAM permissions.");
        throw error; // Re-throw so we can see it
    }
};

function App({}: AppProps) {
  // State for the two main controls
  const [blocksEnabled, setBlocksEnabled] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [stateLoading, setStateLoading] = useState(true);

  const { user, authStatus } = useAuthenticator((context) => [context.user, context.authStatus]);
  const isAuthenticated = authStatus === 'authenticated';

  const { isLocked, attemptUnlock } = usePinAuth();

  // Fetch app state from DynamoDB on mount
  useEffect(() => {
    const fetchAppState = async () => {
      if (!isAuthenticated) {
        setStateLoading(false);
        return;
      }
      
      try {
        const client = getClient();
        console.log('🔍 Client object:', client);
        console.log('🔍 Client models:', client.models);
        console.log('🔍 AppState model:', client.models?.AppState);
        
        // Try to get existing state (use userPool auth, not the default apiKey)
        const { data, errors } = await client.models.AppState.get(
          { id: APP_STATE_ID },
          { authMode: 'userPool' }
        );
        console.log('🔍 Get result - data:', data, 'errors:', JSON.stringify(errors, null, 2));
        
        if (data) {
          setBlocksEnabled(data.blocksEnabled ?? false);
          setScheduleEnabled(data.scheduleEnabled ?? false);
          console.log('✅ App state loaded from database:', data);
        } else {
          // Create initial state record if it doesn't exist
          console.log('🔍 No existing state found, creating new record...');
          const createResult = await client.models.AppState.create(
            {
              id: APP_STATE_ID,
              blocksEnabled: false,
              scheduleEnabled: false,
            },
            { authMode: 'userPool' }
          );
          console.log('✅ Created initial app state record:', JSON.stringify(createResult, null, 2));
        }
      } catch (error) {
        console.error('Failed to fetch app state:', error);
      } finally {
        setStateLoading(false);
      }
    };

    fetchAppState();
  }, [isAuthenticated]);

  // Helper to update app state in DynamoDB
  const updateAppState = async (blocksEnabled: boolean, scheduleEnabled: boolean) => {
    try {
      await getClient().models.AppState.update(
        {
          id: APP_STATE_ID,
          blocksEnabled,
          scheduleEnabled,
        },
        { authMode: 'userPool' }
      );
      console.log('✅ App state saved to database');
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  };

  // local UI states to manage lock overlay visibility and transition animations
  const [lockVisible, setLockVisible] = useState<boolean>(isLocked);
  const [animatingOut, setAnimatingOut] = useState<boolean>(false);

  // Keep document/body from scrolling while the lock screen is visible
  useEffect(() => {
    if (lockVisible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev || '';
      };
    }
    return;
  }, [lockVisible]);

  // Toggle body background color based on lock state
  useEffect(() => {
    // Get or create the theme-color meta tag
    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    if (isLocked) {
      document.body.classList.remove('unlocked');
      document.documentElement.style.background = '#1f2937';
      metaThemeColor.content = '#1f2937';
    } else {
      document.body.classList.add('unlocked');
      document.documentElement.style.background = '#f5f5f5';
      metaThemeColor.content = '#f5f5f5';
    }

    // Cleanup: ensure unlocked state on unmount
    return () => {
      document.body.classList.add('unlocked');
      document.documentElement.style.background = '#f5f5f5';
      if (metaThemeColor) metaThemeColor.content = '#f5f5f5';
    };
  }, [isLocked]);

  // Watch the hook's isLocked to trigger mount/unmount + transition of the overlay
  useEffect(() => {
    if (isLocked) {
      // show immediately when locked
      setAnimatingOut(false);
      setLockVisible(true);
    } else {
      // play an unlock animation then hide overlay
      setAnimatingOut(true);
      // duration should match the CSS transition (in ms)
      const t = setTimeout(() => {
        setAnimatingOut(false);
        setLockVisible(false);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [isLocked]);

  useEffect(() => {
    console.log("App component rendered. Authentication Status:", authStatus);
    if (isAuthenticated && user) {
      console.log("Logged in user:", user.username);
    } else {
      console.log("User is not authenticated.");
    }
  }, [authStatus, user]);

  // Toggle handlers
  const handleToggleBlocks = async () => {
    // Determine the command status based on the next state
    const nextState = !blocksEnabled;
    const commandStatus = nextState ? 'block' : 'unblock';
    
    // Use placeholder IP - the Pi script will use its own target_ips.txt list
    const targetIP = '0.0.0.0'; 

    // Send command to AWS IoT Core
    await publishIotCommand(targetIP, commandStatus);

    // Update local UI state
    setBlocksEnabled(nextState);
    
    // Persist to DynamoDB
    await updateAppState(nextState, scheduleEnabled);
    
    console.log('Blocks toggled:', nextState);
  };

  const handleToggleSchedule = async () => {
    const nextState = !scheduleEnabled;
    
    // Send IoT command for schedule
    await publishScheduleCommand(nextState);
    
    // Update local UI state
    setScheduleEnabled(nextState);
    
    // Persist to DynamoDB
    await updateAppState(blocksEnabled, nextState);
    
    console.log('Schedule toggled:', nextState);
  };

  return (
    <ThemeProvider theme={createTheme()}>
      <>
        <Navbar />
        {/* Main application content is only rendered when unlocked */}
        {!isLocked && (
          <main className="min-h-screen bg-gray-50 w-full pt-16">
            <div className="controls-container">
              <h1 className="controls-title">WiFi Controls</h1>
              
              {stateLoading ? (
                <p className="loading-text">Loading...</p>
              ) : (
                <div className="control-buttons">
                  {/* Toggle Blocks Button */}
                  <button
                    onClick={handleToggleBlocks}
                    className={`control-btn ${blocksEnabled ? 'control-btn-active' : 'control-btn-inactive'}`}
                    disabled={!isAuthenticated}
                  >
                    <span className="control-btn-icon">{blocksEnabled ? '🚫' : '✓'}</span>
                    <span className="control-btn-label">Block All</span>
                    <span className="control-btn-status">{blocksEnabled ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Toggle Schedule Button */}
                  <button
                    onClick={handleToggleSchedule}
                    className={`control-btn ${scheduleEnabled ? 'control-btn-active' : 'control-btn-inactive'}`}
                    disabled={!isAuthenticated}
                  >
                    <span className="control-btn-icon">⏰</span>
                    <span className="control-btn-label">Schedule</span>
                    <span className="control-btn-status">{scheduleEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              )}

              {!isAuthenticated && (
                <p className="auth-warning">Please sign in to use controls</p>
              )}
            </div>
          </main>
        )}

        {/* PIN lock overlay (covers the app when locked)
            We keep the overlay mounted while animating out to allow a smooth fade+scale transition.
        */}
        {lockVisible && (
          <div
            className={`pin-lock-overlay fixed inset-0 z-50 pointer-events-auto transition-all duration-300 ease-out transform ${animatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            aria-hidden={!isLocked}
          >
            {/* Render PinLock. PinLock itself uses a centered panel; wrapper provides animation and prevents overflow. */}
            <PinLock onPinAttempt={(pin) => attemptUnlock(pin)} />
          </div>
        )}
      </>
    </ThemeProvider>
  );
}

export default App;
