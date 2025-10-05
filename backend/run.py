#!/usr/bin/env python3
"""
Backend startup script for the Air Quality Monitor API
Run this script from the backend directory to start the server
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
