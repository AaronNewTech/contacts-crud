#!/bin/bash
echo "=== vercel-build.sh start ==="

# Install dependencies
pip install -r requirements.txt --break-system-packages

# Collect static files
python3 manage.py collectstatic --noinput --clear


