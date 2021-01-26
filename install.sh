#!/usr/bin/bash

# Setting work dir to the script dir

workDir=${0%/*}
cd "${workDir}" || exit

# Starting and installing GoDaddns

sed "s#_path_#$(pwd)/godaddns.js#" ./service | sudo tee /etc/systemd/system/godaddns.service 1>/dev/null
sudo systemctl daemon-reload
sudo systemctl start godaddns && echo "GoDaddns is running!"
sudo systemctl enable godaddns && echo "GoDaddns is set to launch on boot!"
