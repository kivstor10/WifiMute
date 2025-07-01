import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import Navbar from "./Navbar";

const client = generateClient<Schema>();

function App() {
  const [devices, setDevices] = useState<Array<Schema["Device"]["type"]>>([]);

  useEffect(() => {
    client.models.Device.observeQuery().subscribe({
      next: (data) => setDevices([...data.items]),
    });
  }, []);

  function createDevice() {
    const staticIp = window.prompt("Device static IP?");
    const wifiMac = window.prompt("Device WiFi MAC address?");
    let blockStatus = window.prompt("Block status (ON/OFF)?", "OFF");
    if (!staticIp || !wifiMac || !blockStatus) return;
    blockStatus = blockStatus.toUpperCase();
    if (blockStatus !== "ON" && blockStatus !== "OFF") {
      alert('Block status must be "ON" or "OFF".');
      return;
    }
    client.models.Device.create({ staticIp, wifiMac, blockStatus: blockStatus as "ON" | "OFF" });
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
        <button onClick={createDevice}>+ new device</button>
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
        <div>
          🥳 App successfully hosted. Try adding a new device.
          <br />
          <a href="https://docs.amplify.aws/react/start/quickstart/#make-frontend-updates">
            Review next step of this tutorial.
          </a>
        </div>
      </main>
    </>
  );
}

export default App;
