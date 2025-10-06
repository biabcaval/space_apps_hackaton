#!/bin/bash

# Ensure script is executable
chmod +x setup_netrc.sh

# Get credentials from environment variables or prompt user
USERNAME=${EARTHDATA_USERNAME:-$(read -p "Enter NASA Earthdata username: " username && echo $username)}
PASSWORD=${EARTHDATA_PASSWORD:-$(read -s -p "Enter NASA Earthdata password: " password && echo $password)}

# Create or update .netrc file
echo "machine urs.earthdata.nasa.gov login ${USERNAME} password ${PASSWORD}" > ~/.netrc

# Set correct permissions
chmod 600 ~/.netrc

echo "✅ .netrc file created successfully with NASA Earthdata credentials"