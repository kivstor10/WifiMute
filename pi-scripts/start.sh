#!/usr/bin/env bash
# stop script on error
set -e

# Define the path to your virtual environment directory
VENV_DIR="./awsiot_venv"
VENV_PYTHON="$VENV_DIR/bin/python3"
VENV_PIP="$VENV_DIR/bin/pip"

# Check for python 3 (system-wide, as venv uses it)
if ! python3 --version &> /dev/null; then
  printf "\nERROR: python3 must be installed.\n"
  exit 1
fi

# Ensure python3-venv is installed for virtual environment creation
if ! dpkg -s python3-venv &> /dev/null; then
    printf "\nInstalling python3-venv for virtual environment creation...\n"
    sudo apt update && sudo apt install python3-venv -y
fi

# Create the virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  printf "\nCreating Python virtual environment at %s...\n" "$VENV_DIR"
  python3 -m venv "$VENV_DIR"
else
  printf "\nVirtual environment %s already exists. Skipping creation.\n" "$VENV_DIR"
fi


# Check to see if root CA file exists, download if not
if [ ! -f ./root-CA.crt ]; then
  printf "\nDownloading AWS IoT Root CA certificate from AWS...\n"
  curl -s -S -L https://www.amazontrust.com/repository/AmazonRootCA1.pem > root-CA.crt
fi

# Check to see if AWS Device SDK for Python exists, download if not
# We will still clone it for the samples/docs, but install the SDK package from PyPI
if [ ! -d ./aws-iot-device-sdk-python-v2 ]; then
  printf "\nCloning the AWS SDK repository for reference (SDK package will be installed from PyPI)....\n"
  git clone https://github.com/aws/aws-iot-device-sdk-python-v2.git --recursive
fi

# Check to see if AWS Device SDK for Python is already installed within the virtual environment, install if not
# We are now installing a specific stable version from PyPI
if ! "$VENV_PYTHON" -c "import awsiotsdk" &> /dev/null || ! "$VENV_PYTHON" -c "import pkg_resources; print(pkg_resources.get_distribution('awsiotsdk').version)" | grep -q "1.15.0"; then
  printf "\nInstalling AWS SDK (awsiotsdk==1.15.0) into virtual environment from PyPI...\n"
  # Use the virtual environment's pip to install the SDK from PyPI
  "$VENV_PIP" install awsiotsdk==1.15.0
  result=$?
  if [ $result -ne 0 ]; then
    printf "\nERROR: Failed to install SDK into virtual environment from PyPI. Check network or PyPI access.\n"
    exit $result
  fi
fi

# Ensure 'requests' is installed in the virtual environment
if ! "$VENV_PYTHON" -c "import requests" &> /dev/null; then
    printf "\nInstalling 'requests' library into virtual environment...\n"
    "$VENV_PIP" install requests
fi

# Ensure 'schedule' is installed in the virtual environment (needed for scheduled blocking)
if ! "$VENV_PYTHON" -c "import schedule" &> /dev/null; then
    printf "\nInstalling 'schedule' library into virtual environment...\n"
    "$VENV_PIP" install schedule
fi

# Run the WiFi blocker pub/sub listener application
# Using PYTHONUNBUFFERED=1 to ensure logs appear immediately when running as a service
printf "\nRunning WiFi blocker pub/sub listener application...\n"
PYTHONUNBUFFERED=1 "$VENV_PYTHON" ./pubsub.py \
  --endpoint a2b1ubzmtkza2j-ats.iot.eu-west-2.amazonaws.com \
  --ca_file root-CA.crt \
  --cert PiWiFiBlocker.cert.pem \
  --key PiWiFiBlocker.private.key \
  --client_id PiWiFiBlocker \
  --topic block/device
