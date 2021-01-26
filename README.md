# GoDaddns


## What is this?

GoDaddns is a tiny Node.js DDNS app which automatically updates your records on GoDaddy to match your server IP so that
you don't need to worry about having a dynamic IP anymore. (Read more about DDNS [here][ddns]).


## Features

GoDaddns can automatically update any number of A records on any of your domains, either one-time (when you launch it)
or continuously, using a configurable timeout. You can also choose whether to reset your records to `0.0.0.0`
on an exit and what TTL you want to use.


## Prerequisites

1. You need to have Node.js installed ([instructions][node]).
1. Clone the repository to your computer.
1. Install dependencies by running `npm install`.
1. If your system includes `systemctl` and you want to use included shell scripts for an easy setup, make them
	 executable with `chmod u+x ./*.sh`.
1. Make sure Node has read **and** write access to the directory the script is located in (or, at least, it can modify
	 the config file).
1. Run GoDaddns with `node ./godaddns.js`.


## Installation

Installation was made to be as straightforward as possible.  
First time you launch GoDaddns it will create a `./config.json` file with all the options. After that, you can either
choose to edit the file manually or run GoDaddns with an `-s` flag to go through a setup process. Note that setup may
not cover all possible options. You can restart the setup or edit the config later at any point.


## Make GoDaddns run automatically

If your system includes `systemctl`, you can use the included scripts to automatically install or uninstall GoDaddns.
Installing will make GoDaddns run when your computer boots and automatically restart on errors.  
Run `./install.sh` to run and install the app and `./uninstall.sh`
to stop and uninstall.


## Help

Run `node ./godaddns.js -h` for the list of options and how to use them.


[ddns]: https://en.wikipedia.org/wiki/Dynamic_DNS

[node]: https://nodejs.org/en/download/
