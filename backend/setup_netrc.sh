#!/bin/bash

# Get credentials from environment variables
USERNAME=${EARTHDATA_USERNAME:?'EARTHDATA_USERNAME is required'}
PASSWORD=${EARTHDATA_PASSWORD:?'EARTHDATA_PASSWORD is required'}

# Create or update .netrc file in the app directory
echo "machine urs.earthdata.nasa.gov login ${USERNAME} password ${PASSWORD}" > .netrc

# Set correct permissions
chmod 600 .netrc

echo "✅ .netrc file created successfully with NASA Earthdata credentials"