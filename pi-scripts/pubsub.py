#!/usr/bin/env python3
# pubsub.py
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0.
#
# Extended to support scheduled blocking via MQTT commands.

import argparse
from concurrent.futures import Future
import sys
import time
import json
import subprocess
import os
import threading
from datetime import datetime

import schedule
from awsiot import mqtt_connection_builder, mqtt

# --- Configuration ---
TARGET_IPS_FILE = "/home/kivstor10/target_ips.txt"  # File containing IPs to block (one per line)

# Schedule time variables (use 24-hour format "HH:MM")
TIME_BLOCK = "00:00"      # Time to cut off access
TIME_UNBLOCK = "06:00"    # Time to restore access

# --- Global State for Scheduling ---
schedule_enabled = False
stop_scheduler = threading.Event()
scheduler_thread = None

# --- IPTables (Firewall) Helper Functions ---

def load_target_ips():
    """Load list of IPs to block from file."""
    try:
        with open(TARGET_IPS_FILE, 'r') as f:
            ips = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        return ips
    except FileNotFoundError:
        print(f"WARNING: {TARGET_IPS_FILE} not found. Create it with one IP per line.")
        return []

def run_iptables_command(command_args):
    """Executes an iptables command securely via subprocess."""
    try:
        full_command = ["sudo", "iptables"] + command_args
        subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        if "Bad rule" in e.stderr or "No chain/target/match" in e.stderr:
            return False
        print(f"ERROR: IPTables command failed: {e.stderr.strip()}")
        return False

def block_client_firewall(ip_address):
    """Blocks a client by inserting IPTables DROP rules for DNS traffic (Port 53)."""
    print(f"INFO: Processing BLOCK request for IP: {ip_address}")

    check_udp = ["-C", "INPUT", "-s", ip_address, "-p", "udp", "--dport", "53", "-j", "DROP"]

    if not run_iptables_command(check_udp):
        run_iptables_command(["-I", "INPUT", "-s", ip_address, "-p", "udp", "--dport", "53", "-j", "DROP"])
        run_iptables_command(["-I", "INPUT", "-s", ip_address, "-p", "tcp", "--dport", "53", "-j", "DROP"])
        print(f"SUCCESS: Client {ip_address} BLOCKED via firewall.")
    else:
        print(f"INFO: Client {ip_address} is already blocked.")

def unblock_client_firewall(ip_address):
    """Unblocks a client by removing the IPTables DROP rules."""
    print(f"INFO: Processing UNBLOCK request for IP: {ip_address}")

    while run_iptables_command(["-D", "INPUT", "-s", ip_address, "-p", "udp", "--dport", "53", "-j", "DROP"]):
        pass

    while run_iptables_command(["-D", "INPUT", "-s", ip_address, "-p", "tcp", "--dport", "53", "-j", "DROP"]):
        pass

    print(f"SUCCESS: Client {ip_address} UNBLOCKED via firewall.")

def block_all_clients():
    """Block all clients in the target IPs list."""
    ips = load_target_ips()
    if not ips:
        print("WARNING: No target IPs configured in target_ips.txt")
        return
    print(f"INFO: Blocking ALL {len(ips)} clients...")
    for ip in ips:
        block_client_firewall(ip)
    print(f"SUCCESS: All {len(ips)} clients blocked.")

def unblock_all_clients():
    """Unblock all clients in the target IPs list."""
    ips = load_target_ips()
    if not ips:
        print("WARNING: No target IPs configured in target_ips.txt")
        return
    print(f"INFO: Unblocking ALL {len(ips)} clients...")
    for ip in ips:
        unblock_client_firewall(ip)
    print(f"SUCCESS: All {len(ips)} clients unblocked.")


# --- Scheduling Functions ---

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


def job_scheduled_block():
    """Called by scheduler at TIME_BLOCK."""
    global schedule_enabled
    if schedule_enabled:
        print(f"⏰ SCHEDULED BLOCK triggered at {TIME_BLOCK}")
        block_all_clients()
    else:
        print("Schedule is disabled, skipping scheduled block.")


def job_scheduled_unblock():
    """Called by scheduler at TIME_UNBLOCK."""
    global schedule_enabled
    if schedule_enabled:
        print(f"⏰ SCHEDULED UNBLOCK triggered at {TIME_UNBLOCK}")
        unblock_all_clients()
    else:
        print("Schedule is disabled, skipping scheduled unblock.")


def scheduler_loop():
    """Background thread running the scheduler."""
    global stop_scheduler
    print("📅 Scheduler thread started.")
    
    # Set up scheduled jobs
    schedule.clear()
    schedule.every().day.at(TIME_BLOCK).do(job_scheduled_block)
    schedule.every().day.at(TIME_UNBLOCK).do(job_scheduled_unblock)
    
    print(f"📅 Scheduled BLOCK at {TIME_BLOCK}")
    print(f"📅 Scheduled UNBLOCK at {TIME_UNBLOCK}")
    
    while not stop_scheduler.is_set():
        try:
            schedule.run_pending()
            time.sleep(1)
        except Exception as e:
            print(f"Scheduler error: {e}")
            time.sleep(5)
    
    print("📅 Scheduler thread stopped.")


def enable_schedule():
    """Enable the scheduled blocking feature."""
    global schedule_enabled, scheduler_thread, stop_scheduler
    
    if schedule_enabled:
        print("Schedule is already enabled.")
        return
    
    print("🟢 ENABLING scheduled blocking...")
    schedule_enabled = True
    
    # Start the scheduler thread
    stop_scheduler.clear()
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_thread.start()
    
    # Check if we should be blocking right now based on current time
    if is_within_block_period():
        print("Currently within block period - blocking all devices now.")
        block_all_clients()
    else:
        print("Not currently in block period - devices remain unblocked until scheduled time.")


def disable_schedule():
    """Disable the scheduled blocking feature and unblock all."""
    global schedule_enabled, stop_scheduler
    
    print("🔴 DISABLING scheduled blocking...")
    schedule_enabled = False
    
    # Stop the scheduler thread
    stop_scheduler.set()
    
    # Clear all scheduled jobs
    schedule.clear()
    
    # Unblock all devices when schedule is disabled
    print("Unblocking all devices due to schedule disable...")
    unblock_all_clients()


# --- AWS IoT Core Logic ---

parser = argparse.ArgumentParser(description="WiFi Blocker controlled by AWS IoT Core MQTT.")
parser.add_argument('--endpoint', required=True, help="Your AWS IoT custom endpoint.")
parser.add_argument('--cert', required=True, help="Path to your client certificate file.")
parser.add_argument('--key', required=True, help="Path to your private key file.")
parser.add_argument('--ca_file', required=True, help="Path to your Root CA file.")
parser.add_argument('--client_id', required=True, help="Client ID for MQTT connection.")
parser.add_argument('--topic', default="block/device", help="MQTT topic to subscribe to.")
parser.add_argument('--port', type=int, help="Specify port to connect to.")
parser.add_argument('--proxy_host', help="Proxy host to connect to.")
parser.add_argument('--proxy_port', type=int, default=8080, help="Proxy port.")
parser.add_argument('--signing_region', default="eu-west-2", help="Region for Sigv4.")
parser.add_argument('--verbose', action='store_true', help="Enable verbose logging.")

args = parser.parse_args()

connection_future = Future()

def on_connection_interrupted(connection, error, **kwargs):
    print(f"Connection interrupted: {error}. Reconnecting...")

def on_connection_resumed(connection, return_code, session_present, **kwargs):
    print("Connection resumed!")

def on_connection_success(connection, callback_data):
    connection_future.set_result(callback_data)

def on_connection_failure(connection, callback_data):
    connection_future.set_exception(callback_data.error)

def on_connection_closed(connection, callback_data):
    print("Connection closed")

def on_message_received(topic, payload, **kwargs):
    """Callback when the subscribed topic receives a message."""
    print(f"Received message from topic '{topic}': {payload.decode('utf-8')}")
    try:
        message = json.loads(payload.decode('utf-8'))
        
        # Handle schedule commands
        command = message.get("command")
        if command:
            if command == "schedule_enable":
                enable_schedule()
            elif command == "schedule_disable":
                disable_schedule()
            else:
                print(f"Unknown command: {command}")
            return
        
        # Handle block/unblock commands
        ip = message.get("ip")
        status = message.get("status")

        if not ip or not status:
            print("ERROR: Invalid message format. Missing 'ip' or 'status'.")
            return

        status_lower = status.lower()

        # Handle "Block All" / "Unblock All" when IP is 0.0.0.0
        if ip == "0.0.0.0":
            if status_lower == "block":
                block_all_clients()
            elif status_lower == "unblock":
                # Check if schedule is active and we're in the block period
                if schedule_enabled and is_within_block_period():
                    print("⚠️ Schedule is active and within block period - keeping devices blocked.")
                    print("   (Block All was turned off, but schedule maintains the block)")
                else:
                    unblock_all_clients()
            else:
                print(f"Unknown status '{status}' for block-all command.")
        else:
            # Handle single IP block/unblock
            if status_lower == "block":
                block_client_firewall(ip)
            elif status_lower == "unblock":
                # Check if schedule is active and we're in the block period
                if schedule_enabled and is_within_block_period():
                    print(f"⚠️ Schedule is active and within block period - keeping {ip} blocked.")
                else:
                    unblock_client_firewall(ip)
            else:
                print(f"Received unknown status '{status}' for IP {ip}.")

    except json.JSONDecodeError:
        print(f"ERROR: Could not decode JSON from message: {payload.decode('utf-8')}")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred: {e}")

if __name__ == '__main__':
    # Build the MQTT connection
    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=args.endpoint,
        cert_filepath=args.cert,
        pri_key_filepath=args.key,
        ca_filepath=args.ca_file,
        client_id=args.client_id,
        clean_session=False,
        keep_alive_secs=30,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed,
        on_connection_success=on_connection_success,
        on_connection_failure=on_connection_failure,
        on_connection_closed=on_connection_closed
    )

    print(f"Connecting to {args.endpoint} with client ID '{args.client_id}'...")
    connect_future = mqtt_connection.connect()
    connect_future.result()

    print("Connected!")

    print(f"Subscribing to topic '{args.topic}'...")
    subscribe_future, packet_id = mqtt_connection.subscribe(
        topic=args.topic,
        qos=mqtt.QoS.AT_MOST_ONCE,
        callback=on_message_received
    )
    subscribe_result = subscribe_future.result()
    print(f"Subscribed with {subscribe_result['qos']}")

    # Show loaded target IPs on startup
    ips = load_target_ips()
    if ips:
        print(f"Loaded {len(ips)} target IPs from {TARGET_IPS_FILE}")
    else:
        print(f"WARNING: No target IPs found. Create {TARGET_IPS_FILE} with one IP per line.")

    print("Listening for messages. Press Ctrl+C to exit.")
    print("Commands supported:")
    print("  - {\"ip\": \"0.0.0.0\", \"status\": \"block\"}     - Block all devices")
    print("  - {\"ip\": \"0.0.0.0\", \"status\": \"unblock\"}   - Unblock all devices")
    print("  - {\"command\": \"schedule_enable\"}            - Enable scheduled blocking")
    print("  - {\"command\": \"schedule_disable\"}           - Disable scheduled blocking")

    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nExiting...")
        
        # Stop scheduler if running
        if schedule_enabled:
            stop_scheduler.set()
        
        print("Disconnecting MQTT...")
        disconnect_future = mqtt_connection.disconnect()
        disconnect_future.result()
        print("Disconnected.")
