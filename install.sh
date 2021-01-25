#!/usr/bin/bash

# Setting work dir to the script dir

workDir=${0%/*}
cd "${workDir}" || exit

# Starting and installing GoDaddns

sed "s#_cwd_#$(pwd)/godaddns.js#" ./godaddns.service | sudo tee /etc/systemd/system/godaddns.service 1>/dev/null
sudo systemctl start godaddns
sudo systemctl enable godaddns
