#!/usr/bin/bash

# Stopping and uninstalling GoDaddns

sudo systemctl disable godaddns
sudo systemctl stop godaddns
sudo rm /etc/systemd/system/godaddns.service 1>/dev/null
