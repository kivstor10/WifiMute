# WiFi Blocker - Raspberry Pi Setup

This script runs on the Raspberry Pi to receive MQTT commands from AWS IoT Core and control WiFi access using iptables firewall rules.

## Features

- **Instant Block/Unblock**: Block or unblock all target devices immediately via the web app
- **Scheduled Blocking**: Enable time-based blocking (e.g., midnight to 6am)
- **Persistent MQTT Connection**: Maintains connection to AWS IoT Core with automatic reconnection
- **Multi-device Support**: Manages multiple target IPs from a configuration file

## Prerequisites

1. Raspberry Pi running as a DNS server (e.g., AdGuard Home, Pi-hole)
2. Python 3.7+
3. AWS IoT Core device certificate and keys

## Installation

### 1. Install Dependencies

```bash
cd /home/kivstor10
pip3 install -r requirements.txt
```

Or install individually:
```bash
pip3 install awsiotsdk schedule
```

### 2. Set Up AWS IoT Certificates

Create a certs directory and place your AWS IoT device certificates:

```bash
mkdir -p /home/kivstor10/certs
```

Copy your certificates to the certs folder:
- `AmazonRootCA1.pem` - AWS Root CA certificate
- `device-certificate.pem.crt` - Your device certificate
- `private.pem.key` - Your private key

### 3. Create Target IPs File

Create a file listing the IPs to block:

```bash
nano /home/kivstor10/target_ips.txt
```

Add one IP per line:
```
# Kids' devices
192.168.1.100
192.168.1.101
192.168.1.102
```

### 4. Configure the Script

Edit `wifi_blocker.py` and update these settings if needed:

```python
# Schedule times (24-hour format)
TIME_BLOCK = "00:00"      # Time to cut off access
TIME_UNBLOCK = "06:00"    # Time to restore access

# Certificate paths
CERT_DIR = "/home/kivstor10/certs"
TARGET_IP_FILE = "/home/kivstor10/target_ips.txt"
```

### 5. Test the Script

```bash
python3 wifi_blocker.py
```

You should see:
```
🚀 WiFi Blocker MQTT Client starting...
✅ Connected to AWS IoT Core!
✅ Subscribed to block/device
🎧 Listening for commands...
```

### 6. Set Up as Systemd Service

Create a service file to run automatically on boot:

```bash
sudo nano /etc/systemd/system/wifi-blocker.service
```

Add:
```ini
[Unit]
Description=WiFi Blocker MQTT Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/kivstor10
ExecStart=/usr/bin/python3 /home/kivstor10/wifi_blocker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable wifi-blocker
sudo systemctl start wifi-blocker
```

Check status:
```bash
sudo systemctl status wifi-blocker
```

View logs:
```bash
sudo journalctl -u wifi-blocker -f
# Or check the log file:
tail -f /home/kivstor10/wifi_blocker.log
```

## MQTT Commands

The script listens on topic `block/device` for these commands:

### Block/Unblock Commands

```json
// Block all devices in target_ips.txt
{"ip": "0.0.0.0", "status": "block"}

// Unblock all devices
{"ip": "0.0.0.0", "status": "unblock"}

// Block specific IP
{"ip": "192.168.1.100", "status": "block"}

// Unblock specific IP
{"ip": "192.168.1.100", "status": "unblock"}
```

### Schedule Commands

```json
// Enable scheduled blocking
{"command": "schedule_enable"}

// Disable scheduled blocking (also unblocks all devices)
{"command": "schedule_disable"}
```

## How Scheduling Works

1. When **schedule_enable** is received:
   - Checks if current time is within the block period
   - If yes, blocks all devices immediately
   - Scheduler runs in background, blocking at TIME_BLOCK and unblocking at TIME_UNBLOCK

2. When **schedule_disable** is received:
   - Stops the scheduler
   - Unblocks all devices immediately

## Troubleshooting

### Connection Issues
- Verify certificate paths are correct
- Check IoT endpoint matches your AWS region
- Ensure the Pi has internet access

### Commands Not Working
- Check the service is running: `sudo systemctl status wifi-blocker`
- View logs: `tail -f /home/kivstor10/wifi_blocker.log`
- Verify iptables permissions (script needs sudo/root)

### Firewall Rules Not Applied
- The script needs root access for iptables
- Check current rules: `sudo iptables -L INPUT -n`
