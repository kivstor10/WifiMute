#!/usr/bin/env python3
"""
WiFi Blocker - AWS IoT Core MQTT Client for Raspberry Pi
Handles both instant blocking and scheduled blocking via MQTT commands.

Commands received via MQTT topic 'block/device':
  - {"ip": "0.0.0.0", "status": "block"}      - Block all IPs in target list
  - {"ip": "0.0.0.0", "status": "unblock"}    - Unblock all IPs in target list
  - {"ip": "x.x.x.x", "status": "block"}      - Block specific IP
  - {"ip": "x.x.x.x", "status": "unblock"}    - Unblock specific IP
  - {"command": "schedule_enable"}            - Enable scheduled blocking
  - {"command": "schedule_disable"}           - Disable scheduled blocking (and unblock all)
"""

import json
import time
import schedule
import logging
import sys
import os
import subprocess
import threading
from datetime import datetime

# AWS IoT SDK
from awscrt import io, mqtt
from awsiot import mqtt_connection_builder

# --- Configuration Section ---

# AWS IoT Core settings
IOT_ENDPOINT = "a2b1ubzmtkza2j-ats.iot.eu-west-2.amazonaws.com"
IOT_PORT = 8883
IOT_CLIENT_ID = "raspberry-pi-wifi-blocker"
MQTT_TOPIC = "block/device"

# Certificate paths (update these to match your Pi's paths)
CERT_DIR = "/home/kivstor10/certs"
ROOT_CA_PATH = f"{CERT_DIR}/AmazonRootCA1.pem"
CERT_PATH = f"{CERT_DIR}/device-certificate.pem.crt"
KEY_PATH = f"{CERT_DIR}/private.pem.key"

# Schedule time variables (use 24-hour format "HH:MM")
TIME_BLOCK = "00:00"      # Time to cut off access
TIME_UNBLOCK = "06:00"    # Time to restore access

# File containing target IPs, one per line
TARGET_IP_FILE = "/home/kivstor10/target_ips.txt"

# Configure logging
LOG_FILE_PATH = '/home/kivstor10/wifi_blocker.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE_PATH),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# --- Global State ---
schedule_enabled = False
scheduler_thread = None
stop_scheduler = threading.Event()

# --- Helper Functions ---

def get_target_ips():
    """Reads IPs from the configuration file."""
    if not os.path.exists(TARGET_IP_FILE):
        logger.error(f"Target IP file not found at: {TARGET_IP_FILE}")
        return []

    ips = []
    try:
        with open(TARGET_IP_FILE, 'r') as f:
            for line in f:
                ip = line.strip()
                # Basic validation to ensure it looks like an IP and isn't a comment
                if ip and not ip.startswith('#') and len(ip.split('.')) == 4:
                    ips.append(ip)
    except Exception as e:
        logger.error(f"Error reading target IP file: {e}")
        return []
    return ips


def run_iptables_command(command_args):
    """Executes an iptables command securely."""
    try:
        full_command = ["sudo", "iptables"] + command_args
        result = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        # iptables returns exit code 1 if rule doesn't exist (for -C or -D)
        if "Bad rule" in e.stderr or "No chain/target/match" in e.stderr:
            return False
        logger.error(f"IPTables Error: {e.stderr.strip()}")
        return False


# --- Core Blocking Logic ---

def block_access(ip):
    """
    Inserts an iptables rule to DROP DNS traffic (UDP/TCP port 53) from the IP.
    """
    # Check if rule exists first to avoid duplicates
    check_udp = ["-C", "INPUT", "-s", ip, "-p", "udp", "--dport", "53", "-j", "DROP"]

    if not run_iptables_command(check_udp):
        # Rule doesn't exist, so we add it (-I inserts at the top of the chain)
        logger.info(f"Blocking {ip}...")
        run_iptables_command(["-I", "INPUT", "-s", ip, "-p", "udp", "--dport", "53", "-j", "DROP"])
        run_iptables_command(["-I", "INPUT", "-s", ip, "-p", "tcp", "--dport", "53", "-j", "DROP"])
        logger.info(f"✅ Client {ip} BLOCKED (Firewall rule added).")
    else:
        logger.info(f"Client {ip} is already blocked.")


def unblock_access(ip):
    """
    Deletes the iptables rule that drops DNS traffic.
    """
    logger.info(f"Unblocking {ip}...")
    # -D deletes the rule. Loop until it fails to ensure we remove duplicates
    while run_iptables_command(["-D", "INPUT", "-s", ip, "-p", "udp", "--dport", "53", "-j", "DROP"]):
        pass
    while run_iptables_command(["-D", "INPUT", "-s", ip, "-p", "tcp", "--dport", "53", "-j", "DROP"]):
        pass
    logger.info(f"✅ Client {ip} UNBLOCKED (Firewall rules removed).")


def block_all():
    """Block all IPs in the target list."""
    ips = get_target_ips()
    if not ips:
        logger.warning("No IPs found to block.")
        return
    logger.info("🚫 Starting BLOCK ALL.")
    for ip in ips:
        block_access(ip)


def unblock_all():
    """Unblock all IPs in the target list."""
    ips = get_target_ips()
    if not ips:
        logger.warning("No IPs found to unblock.")
        return
    logger.info("✅ Starting UNBLOCK ALL.")
    for ip in ips:
        unblock_access(ip)


# --- Scheduled Jobs ---

def job_scheduled_block():
    """Called by scheduler at TIME_BLOCK."""
    global schedule_enabled
    if schedule_enabled:
        logger.info(f"⏰ SCHEDULED BLOCK triggered at {TIME_BLOCK}")
        block_all()
    else:
        logger.info("Schedule is disabled, skipping scheduled block.")


def job_scheduled_unblock():
    """Called by scheduler at TIME_UNBLOCK."""
    global schedule_enabled
    if schedule_enabled:
        logger.info(f"⏰ SCHEDULED UNBLOCK triggered at {TIME_UNBLOCK}")
        unblock_all()
    else:
        logger.info("Schedule is disabled, skipping scheduled unblock.")


def is_within_block_period():
    """
    Check if current time is within the blocking period.
    Returns True if we should be blocking right now.
    """
    now = datetime.now().strftime("%H:%M")
    
    # Handle overnight blocking (e.g., 00:00 to 06:00)
    if TIME_BLOCK > TIME_UNBLOCK:
        # Blocking period spans midnight
        return now >= TIME_BLOCK or now < TIME_UNBLOCK
    else:
        # Normal same-day period
        return TIME_BLOCK <= now < TIME_UNBLOCK


def scheduler_loop():
    """Background thread running the scheduler."""
    global stop_scheduler
    logger.info("📅 Scheduler thread started.")
    
    # Set up scheduled jobs
    schedule.clear()
    schedule.every().day.at(TIME_BLOCK).do(job_scheduled_block)
    schedule.every().day.at(TIME_UNBLOCK).do(job_scheduled_unblock)
    
    logger.info(f"📅 Scheduled BLOCK at {TIME_BLOCK}")
    logger.info(f"📅 Scheduled UNBLOCK at {TIME_UNBLOCK}")
    
    while not stop_scheduler.is_set():
        try:
            schedule.run_pending()
            time.sleep(1)
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            time.sleep(5)
    
    logger.info("📅 Scheduler thread stopped.")


def enable_schedule():
    """Enable the scheduled blocking feature."""
    global schedule_enabled, scheduler_thread, stop_scheduler
    
    if schedule_enabled:
        logger.info("Schedule is already enabled.")
        return
    
    logger.info("🟢 ENABLING scheduled blocking...")
    schedule_enabled = True
    
    # Start the scheduler thread
    stop_scheduler.clear()
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_thread.start()
    
    # Check if we should be blocking right now based on current time
    if is_within_block_period():
        logger.info("Currently within block period - blocking all devices now.")
        block_all()
    else:
        logger.info("Not currently in block period - devices remain unblocked until scheduled time.")


def disable_schedule():
    """Disable the scheduled blocking feature and unblock all."""
    global schedule_enabled, stop_scheduler
    
    logger.info("🔴 DISABLING scheduled blocking...")
    schedule_enabled = False
    
    # Stop the scheduler thread
    stop_scheduler.set()
    
    # Clear all scheduled jobs
    schedule.clear()
    
    # Unblock all devices when schedule is disabled
    logger.info("Unblocking all devices due to schedule disable...")
    unblock_all()


# --- MQTT Handling ---

def on_message_received(topic, payload, **kwargs):
    """Handle incoming MQTT messages."""
    try:
        message = json.loads(payload.decode('utf-8'))
        logger.info(f"📩 Received message on {topic}: {message}")
        
        # Handle schedule commands
        if 'command' in message:
            command = message['command']
            if command == 'schedule_enable':
                enable_schedule()
            elif command == 'schedule_disable':
                disable_schedule()
            else:
                logger.warning(f"Unknown command: {command}")
            return
        
        # Handle block/unblock commands
        if 'ip' in message and 'status' in message:
            ip = message['ip']
            status = message['status']
            
            if ip == '0.0.0.0':
                # Special IP means "all devices"
                if status == 'block':
                    block_all()
                elif status == 'unblock':
                    unblock_all()
                else:
                    logger.warning(f"Unknown status: {status}")
            else:
                # Specific IP
                if status == 'block':
                    block_access(ip)
                elif status == 'unblock':
                    unblock_access(ip)
                else:
                    logger.warning(f"Unknown status: {status}")
        else:
            logger.warning(f"Invalid message format: {message}")
            
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")


def on_connection_interrupted(connection, error, **kwargs):
    """Called when connection is accidentally lost."""
    logger.warning(f"⚠️ Connection interrupted: {error}")


def on_connection_resumed(connection, return_code, session_present, **kwargs):
    """Called when connection is resumed."""
    logger.info(f"✅ Connection resumed (return_code={return_code}, session_present={session_present})")
    
    # Resubscribe when reconnected
    logger.info(f"Resubscribing to {MQTT_TOPIC}...")
    connection.subscribe(
        topic=MQTT_TOPIC,
        qos=mqtt.QoS.AT_LEAST_ONCE,
        callback=on_message_received
    )


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("🚀 WiFi Blocker MQTT Client starting...")
    logger.info(f"   IoT Endpoint: {IOT_ENDPOINT}")
    logger.info(f"   MQTT Topic: {MQTT_TOPIC}")
    logger.info(f"   Schedule: Block at {TIME_BLOCK}, Unblock at {TIME_UNBLOCK}")
    logger.info("=" * 60)
    
    # Validate certificate files exist
    for path, name in [(ROOT_CA_PATH, "Root CA"), (CERT_PATH, "Certificate"), (KEY_PATH, "Private Key")]:
        if not os.path.exists(path):
            logger.error(f"❌ {name} not found at: {path}")
            sys.exit(1)
    
    # Validate target IP file exists
    if not os.path.exists(TARGET_IP_FILE):
        logger.warning(f"⚠️ Target IP file not found at: {TARGET_IP_FILE}")
        logger.warning("Creating empty file. Please add target IPs (one per line).")
        with open(TARGET_IP_FILE, 'w') as f:
            f.write("# Add target IPs here, one per line\n")
            f.write("# Example:\n")
            f.write("# 192.168.1.100\n")
    
    # Set up AWS IoT MQTT connection
    event_loop_group = io.EventLoopGroup(1)
    host_resolver = io.DefaultHostResolver(event_loop_group)
    client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)
    
    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=IOT_ENDPOINT,
        port=IOT_PORT,
        cert_filepath=CERT_PATH,
        pri_key_filepath=KEY_PATH,
        ca_filepath=ROOT_CA_PATH,
        client_bootstrap=client_bootstrap,
        client_id=IOT_CLIENT_ID,
        clean_session=False,
        keep_alive_secs=30,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed
    )
    
    # Connect to AWS IoT Core
    logger.info("Connecting to AWS IoT Core...")
    connect_future = mqtt_connection.connect()
    connect_future.result()
    logger.info("✅ Connected to AWS IoT Core!")
    
    # Subscribe to topic
    logger.info(f"Subscribing to topic: {MQTT_TOPIC}")
    subscribe_future, packet_id = mqtt_connection.subscribe(
        topic=MQTT_TOPIC,
        qos=mqtt.QoS.AT_LEAST_ONCE,
        callback=on_message_received
    )
    subscribe_result = subscribe_future.result()
    logger.info(f"✅ Subscribed to {MQTT_TOPIC} (QoS: {subscribe_result['qos']})")
    
    logger.info("🎧 Listening for commands...")
    logger.info("   - Send {\"ip\": \"0.0.0.0\", \"status\": \"block\"} to block all")
    logger.info("   - Send {\"ip\": \"0.0.0.0\", \"status\": \"unblock\"} to unblock all")
    logger.info("   - Send {\"command\": \"schedule_enable\"} to enable schedule")
    logger.info("   - Send {\"command\": \"schedule_disable\"} to disable schedule")
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        
        # Clean up
        if schedule_enabled:
            stop_scheduler.set()
        
        disconnect_future = mqtt_connection.disconnect()
        disconnect_future.result()
        logger.info("Disconnected from AWS IoT Core.")


if __name__ == '__main__':
    main()
