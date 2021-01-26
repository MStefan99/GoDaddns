#!/usr/bin/bash

# Stopping and uninstalling GoDaddns

sudo systemctl stop godaddns && echo "GoDaddns will no longer start on boot"
sudo systemctl disable godaddns && echo "GoDaddns stopped" 1>/dev/null
sudo rm /etc/systemd/system/godaddns.service
