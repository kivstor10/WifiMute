import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from '@aws-amplify/ui-react'; // Use useAuthenticator for auth state access

import Navbar from "./Navbar";
import DeviceFormDialog from "./DeviceFormDialog";
import ConfirmDialog from "./ConfirmDialog";
import ScheduleDialog from "./ScheduleDialog";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Declare client outside but initialize inside useEffect or conditional logic
let client: ReturnType<typeof generateClient<Schema>>;

function App() {
  const [devices, setDevices] = useState<Array<Schema["Device"]["type"]>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuAnchorEls, setMenuAnchorEls] = useState<{
    [id: string]: HTMLElement | null;
  }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Schema["Device"]["type"] | null>(
    null
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [deviceToSchedule, setDeviceToSchedule] = useState<Schema["Device"]["type"] | null>(null);

  // Use a state to track if Amplify client is ready
  const [isClientReady, setIsClientReady] = useState(false);

  // MODIFIED: Use useAuthenticator hook for Gen 2
  const { user, authStatus } = useAuthenticator((context) => [context.user, context.authStatus]);
  const isAuthenticated = authStatus === 'authenticated'; // Check if user is authenticated

  useEffect(() => {
    // Initialize client ONLY after Amplify.configure has run.
    try {
      client = generateClient<Schema>();
      setIsClientReady(true);
      console.log("Amplify client initialized. isClientReady:", true);
    } catch (error) {
      console.error("Failed to generate Amplify client:", error);
    }
  }, []);

  useEffect(() => {
    if (isClientReady && isAuthenticated) {
      console.log("isClientReady and isAuthenticated are true. Attempting to list devices...");
      console.log("Listing devices for user:", user?.username);

      // TEMPORARY TEST: Try a simple public fetch call
      fetch('https://jsonplaceholder.typicode.com/todos/1')
        .then(response => {
          console.log("Simple fetch successful:", response.status);
          return response.json();
        })
        .then(json => console.log("Simple fetch data:", json))
        .catch(error => console.error("Simple fetch failed:", error));
      // END TEMPORARY TEST

      client.models.Device.list().then((result) => setDevices(result.data))
      .catch((error) => console.error("Error listing devices:", error));
    } else if (isClientReady && !isAuthenticated) {
        console.log("Amplify client is ready, but user is not authenticated. Device list will not populate.");
        setDevices([]);
    }
}, [isClientReady, isAuthenticated, user]);

  // MODIFIED: handleAddDevice to use actual authenticated user's ID via useAuth
  async function handleAddDevice(data: {
    staticIp: string;
    wifiMac: string;
    name: string;
  }) {
    if (!isClientReady) {
      console.error("Amplify client not ready yet for adding device.");
      return;
    }
    if (!isAuthenticated || !user) {
        console.error("User not authenticated. Cannot add device.");
        alert("Please log in to add a device.");
        return;
    }

    try {
      const ownerId = user.username; // Use the authenticated user's username as the owner
      
      console.log("Creating device with owner:", ownerId);

      client.models.Device.create({
        ...data,
        blockStatus: "OFF",
        owner: ownerId // Use the actual authenticated user's ID here
      })
      .then((result) => {
          if (result.data) {
              setDevices((prevDevices) =>
                  result.data ? [...prevDevices, result.data] : prevDevices
              );
              console.log("Device created successfully:", result.data);
          }
      })
      .catch((error) => console.error("Error creating device:", error));
    } catch (error) {
      console.error("Error creating device (unexpected):", error);
    }
  }

  function toggleBlockStatus(device: Schema["Device"]["type"]) {
    if (!isClientReady || !isAuthenticated) {
      console.error("Amplify client or user not ready for toggling block status.");
      return;
    }
    client.models.Device.update({
      id: device.id,
      blockStatus: device.blockStatus === "ON" ? "OFF" : "ON",
    })
    .then((result) => {
        if (result.data) {
            setDevices((prevDevices) =>
                prevDevices.map((d) => (d.id === result.data?.id ? result.data : d))
            );
            console.log("Block status toggled:", result.data);
        }
    })
    .catch((error) => console.error("Error toggling block status:", error));
  }

  function handleMenuOpen(event: React.MouseEvent<HTMLElement>, id: string) {
    setMenuAnchorEls((prev) => ({ ...prev, [id]: event.currentTarget }));
  }

  function handleMenuClose(id: string) {
    setMenuAnchorEls((prev) => ({ ...prev, [id]: null }));
  }

  function handleDeleteClick(device: Schema["Device"]["type"]) {
    setDeviceToDelete(device);
    setConfirmOpen(true);
    handleMenuClose(device.id);
  }

  function handleDeleteConfirm() {
    if (!isClientReady || !isAuthenticated) {
      console.error("Amplify client or user not ready for deleting device.");
      return;
    }
    if (deviceToDelete) {
      client.models.Device.delete({ id: deviceToDelete.id })
        .then(() => {
          console.log("Device deleted successfully:", deviceToDelete.id);
          setDevices((prevDevices) =>
            prevDevices.filter((d) => d.id !== deviceToDelete.id)
          );
          setDeviceToDelete(null);
          setConfirmOpen(false);
        })
        .catch((error) => console.error("Error deleting device:", error));
    }
  }

  function handleDeleteCancel() {
    setDeviceToDelete(null);
    setConfirmOpen(false);
  }

  function handleScheduleClick(device: Schema["Device"]["type"]) {
    setDeviceToSchedule(device);
    setScheduleOpen(true);
    handleMenuClose(device.id);
  }

  async function handleScheduleSubmit(range: [number, number]) {
    if (!isClientReady || !isAuthenticated) {
      console.error("Amplify client or user not ready for scheduling device.");
      return;
    }
    if (deviceToSchedule) {
      try {
        const { data: updatedDevice } = await client.models.Device.update({
          id: deviceToSchedule.id,
          scheduleFrom: range[0],
          scheduleTo: range[1],
        });
        if (updatedDevice) {
            console.log("Device schedule updated successfully:", updatedDevice);
            setDevices((prevDevices) =>
                prevDevices.map((d) => (d.id === updatedDevice?.id ? updatedDevice : d))
            );
        }
        setScheduleOpen(false);
      } catch (error) {
        console.error("Error updating device schedule:", error);
      }
    } else {
      console.warn("No device selected to schedule.");
    }
  }

  // Only render content if client is ready, or render a loading state
  if (!isClientReady) {
    return <div>Loading application...</div>;
  }

  return (
    <ThemeProvider theme={createTheme()}>
      <>
        <Navbar />
        <main>
          <h1>Device List</h1>
          <Button
            onClick={() => setDialogOpen(true)}
            variant="contained"
            style={{ marginTop: 16 }}
          >
            + new device
          </Button>
          <ul>
            {devices.map((device) => (
              <li
                key={device.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>{device.name || "Unnamed Device"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Display current schedule if available */}
                  {device.scheduleFrom !== undefined && device.scheduleTo !== undefined && (
                    <span style={{ fontSize: '0.8em', color: '#666' }}>
                      Schedule: {Math.floor((device.scheduleFrom ?? 0) / 60)}:{String((device.scheduleFrom ?? 0) % 60).padStart(2, '0')} -
                      {Math.floor((device.scheduleTo ?? 0) / 60)}:{String((device.scheduleTo ?? 0) % 60).padStart(2, '0')}
                    </span>
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => toggleBlockStatus(device)}
                    style={{
                      backgroundColor:
                        device.blockStatus === "ON" ? "#e53e3e" : "#38a169",
                    }}
                  >
                    {device.blockStatus === "ON" ? "Unblock" : "Block"}
                  </Button>
                  <IconButton onClick={(e) => handleMenuOpen(e, device.id)}>
                    <MoreVertIcon />
                  </IconButton>
                  <Menu
                    anchorEl={menuAnchorEls[device.id]}
                    open={Boolean(menuAnchorEls[device.id])}
                    onClose={() => handleMenuClose(device.id)}
                  >
                    <MenuItem onClick={() => handleScheduleClick(device)}>
                      Schedule
                    </MenuItem>
                    <MenuItem onClick={() => handleDeleteClick(device)}>
                      Delete
                    </MenuItem>
                  </Menu>
                </div>
              </li>
            ))}
          </ul>
          <DeviceFormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSubmit={handleAddDevice}
          />
          <ConfirmDialog
            open={confirmOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            title="Delete Device"
            content={`Are you sure you want to delete '${deviceToDelete?.name || "Unnamed Device"}'?`}
          />
          <ScheduleDialog
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            onSubmit={handleScheduleSubmit}
            deviceToSchedule={deviceToSchedule}
            deviceName={deviceToSchedule?.name ?? undefined}
          />
        </main>
      </>
    </ThemeProvider>
  );
}

export default App;