import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import Navbar from "./Navbar";
import DeviceFormDialog from "./DeviceFormDialog";

const client = generateClient<Schema>();

function App() {
  const [devices, setDevices] = useState<Array<Schema["Device"]["type"]>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
    <>
      <Navbar />
      <main>
        <h1>My Devices</h1>
        <button onClick={() => setDialogOpen(true)}>+ new device</button>
        <DeviceFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleAddDevice}
        />
        <ul>
          {devices.map((device) => (
            <li key={device.id}>
              <strong>IP:</strong> {device.staticIp} | <strong>MAC:</strong>{" "}
              {device.wifiMac} | <strong>Blocked:</strong> {device.blockStatus}
              <button
                style={{ marginLeft: 8 }}
                onClick={() => toggleBlockStatus(device)}
              >
                Toggle Block
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

export default App;
