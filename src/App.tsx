// App.tsx
import { useEffect, useState } from "react"; // Keep useState for dialogs if you re-introduce them
// Removed Schema import as it's not directly used for data operations anymore
import { useAuthenticator } from '@aws-amplify/ui-react';

// Material-UI Imports - KEEPING THESE
import Navbar from "./Navbar";
import DeviceFormDialog from "./DeviceFormDialog";
import ConfirmDialog from "./ConfirmDialog";
import ScheduleDialog from "./ScheduleDialog";
import PinLock from "./components/PinLock";
import usePinAuth from "./hooks/usePinAuth";
import Button from "@mui/material/Button";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Removed all GraphQL query strings

// Define props for App component
interface AppProps {
  // No props currently needed
}

function App({}: AppProps) {
  // Removed all device-related state variables
  // const [devices, setDevices] = useState<Array<Schema["Device"]["type"]>>([]);
  const [dialogOpen, setDialogOpen] = useState(false); // Keeping for the + new device button
  // Removed menu, confirm, schedule related states and functions for now
  // const [menuAnchorEls, setMenuAnchorEls] = useState<{ [id: string]: HTMLElement | null; }>({});
  // const [confirmOpen, setConfirmOpen] = useState(false);
  // const [deviceToDelete, setDeviceToDelete] = useState<Schema["Device"]["type"] | null>(null);
  // const [scheduleOpen, setScheduleOpen] = useState(false);
  // const [deviceToSchedule, setDeviceToSchedule] = useState<Schema["Device"]["type"] | null>(null);


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

  // Removed all data fetching/mutation functions (fetchDevices, handleAddDevice, toggleBlockStatus, etc.)
  // Keeping placeholder for setDialogOpen to allow the button to function, but it won't do anything else.
  function handleAddDevicePlaceholder() {
    setDialogOpen(true);
    console.log("Add Device button clicked.");
  }


  return (
    <ThemeProvider theme={createTheme()}>
      <>
        <Navbar />
        {/* Main application content is only rendered when unlocked */}
        {!isLocked && (
          <main className="min-h-screen bg-gray-50 w-full pt-16">
            <div className="max-w-md mx-auto p-4">
              <h1 className="text-2xl font-semibold mb-4">Device List</h1>

              <Button
                onClick={handleAddDevicePlaceholder}
                variant="contained"
                style={{ marginTop: 16 }}
                disabled={!isAuthenticated}
              >
                + new device
              </Button>

              <div className="mt-6">
                <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
                  <h2 className="font-medium">Device Controls</h2>
                  <p className="text-sm text-gray-500">Placeholder device card — integrate your controls here.</p>
                  <div className="mt-3 flex gap-3">
                    <button className="px-3 py-1 rounded-lg bg-green-500 text-white">On</button>
                    <button className="px-3 py-1 rounded-lg bg-gray-200 text-gray-700">Off</button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-4">
                  <h3 className="font-medium">More Controls</h3>
                  <p className="text-sm text-gray-500">Add more device cards as needed.</p>
                </div>
              </div>

              <DeviceFormDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSubmit={() => console.log("Device form submitted")}
              />
              <ConfirmDialog
                open={false}
                onClose={() => {}}
                onConfirm={() => {}}
                title="Delete Device"
                content=""
              />
              <ScheduleDialog
                open={false}
                onClose={() => {}}
                onSubmit={async (_range: [number, number]) => {}}
                deviceToSchedule={null}
                deviceName={undefined}
              />
            </div>
          </main>
        )}

        {/* PIN lock overlay (covers the app when locked)
            We keep the overlay mounted while animating out to allow a smooth fade+scale transition.
        */}
        {lockVisible && (
          <div
            className={`fixed inset-0 z-50 pointer-events-auto transition-all duration-300 ease-out transform ${animatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh' }}
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
