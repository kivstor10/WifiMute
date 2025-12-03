// App.tsx
import { useEffect, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';

import Navbar from "./Navbar";
import PinLock from "./components/PinLock";
import usePinAuth from "./hooks/usePinAuth";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Removed all GraphQL query strings

// Define props for App component
interface AppProps {
  // No props currently needed
}

function App({}: AppProps) {
  // State for the two main controls
  const [blocksEnabled, setBlocksEnabled] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  const { user, authStatus } = useAuthenticator((context) => [context.user, context.authStatus]);
  const isAuthenticated = authStatus === 'authenticated';

  const { isLocked, attemptUnlock } = usePinAuth();

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
  }, [authStatus, user]); // Log whenever auth status or user changes

  // Toggle handlers
  const handleToggleBlocks = () => {
    setBlocksEnabled(prev => !prev);
    console.log('Blocks toggled:', !blocksEnabled);
    // TODO: Integrate with your backend API to actually toggle blocks
  };

  const handleToggleSchedule = () => {
    setScheduleEnabled(prev => !prev);
    console.log('Schedule toggled:', !scheduleEnabled);
    // TODO: Integrate with your backend API to actually toggle schedule
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
