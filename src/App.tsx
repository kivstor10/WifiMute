import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
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

const client = generateClient<Schema>();

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

  useEffect(() => {
    // Correctly subscribe to observeQuery to get initial data and live updates
    const sub = client.models.Device.observeQuery().subscribe({
      next: (data) => setDevices([...data.items]),
      error: (error) => console.error("Error observing devices:", error),
    });

    // Clean up subscription on component unmount
    return () => sub.unsubscribe();
  }, []);

  function handleAddDevice(data: {
    staticIp: string;
    wifiMac: string;
    name: string;
  }) {
    // IMPORTANT: For owner-based authorization, you MUST provide the 'owner' field.
    // Replace "admin" with the actual current user's ID (e.g., from Amplify Auth).
    // For now, "admin" is a placeholder if you're testing with a fixed owner.
    client.models.Device.create({
      ...data,
      blockStatus: "OFF",
      owner: "admin" // <--- IMPORTANT: Replace with actual user ID after authentication
    })
    .then((result) => console.log("Device created successfully:", result.data))
    .catch((error) => console.error("Error creating device:", error));
  }

  function toggleBlockStatus(device: Schema["Device"]["type"]) {
    client.models.Device.update({
      id: device.id,
      blockStatus: device.blockStatus === "ON" ? "OFF" : "ON",
    })
    .then((result) => console.log("Block status toggled:", result.data))
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
    if (deviceToDelete) {
      client.models.Device.delete({ id: deviceToDelete.id })
        .then(() => {
          console.log("Device deleted successfully:", deviceToDelete.id);
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

  // UPDATED FUNCTION: Persists schedule to DynamoDB
  async function handleScheduleSubmit(range: [number, number]) {
    if (deviceToSchedule) { // Ensure a device is selected for scheduling
      try {
        const { data: updatedDevice } = await client.models.Device.update({
          id: deviceToSchedule.id, // CRUCIAL: Provide the ID of the record to update
          scheduleFrom: range[0], // Set the scheduleFrom attribute
          scheduleTo: range[1],   // Set the scheduleTo attribute
        });
        console.log("Device schedule updated successfully:", updatedDevice);
        setScheduleOpen(false); // Close the dialog on successful update
      } catch (error) {
        console.error("Error updating device schedule:", error);
        // You might want to display a user-friendly error message here
      }
    } else {
      console.warn("No device selected to schedule.");
    }
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
            deviceToSchedule={deviceToSchedule} // Pass the entire device for initial schedule values
            deviceName={deviceToSchedule?.name ?? undefined}
          />
        </main>
      </>
    </ThemeProvider>
  );
}

export default App;