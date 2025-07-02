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
    client.models.Device.observeQuery().subscribe({
      next: (data) => setDevices([...data.items]),
    });
  }, []);

  function handleAddDevice(data: {
    staticIp: string;
    wifiMac: string;
    name: string;
  }) {
    client.models.Device.create({
      ...data,
      blockStatus: "OFF",
    });
  }

  function toggleBlockStatus(device: Schema["Device"]["type"]) {
    client.models.Device.update({
      id: device.id,
      blockStatus: device.blockStatus === "ON" ? "OFF" : "ON",
    });
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
      client.models.Device.delete({ id: deviceToDelete.id });
      setDeviceToDelete(null);
      setConfirmOpen(false);
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

  function handleScheduleSubmit(range: [number, number]) {
    // Replace this with actual MQTT publish logic
    const payload = {
      deviceId: deviceToSchedule?.id,
      name: deviceToSchedule?.name,
      schedule: {
        from: range[0],
        to: range[1],
      },
    };
    // Example: mqttClient.publish('devices/schedule', JSON.stringify(payload));
    console.log("Schedule payload:", payload);
  }

  return (
    <ThemeProvider theme={createTheme()}>
      <>
        <Navbar />
        <main>
          <h1>Device List</h1>
          <DeviceFormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSubmit={handleAddDevice}
          />
          <ul>
            {devices.map((device) => (
              <li
                key={device.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{device.name || "Unnamed Device"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <Button
            onClick={() => setDialogOpen(true)}
            variant="contained"
            style={{ marginTop: 16 }}
          >
            + new device
          </Button>
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
            deviceName={deviceToSchedule?.name}
          />
        </main>
      </>
    </ThemeProvider>
  );
}

export default App;
