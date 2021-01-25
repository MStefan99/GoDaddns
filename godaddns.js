'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');

const inquirer = require('inquirer');
const argumented = require('./argumented');

const godaddyEndpoint = 'https://api.godaddy.com/';
const ipifyEndpoint = 'https://api.ipify.org';


const configFilename = './config.json';
const defaultConfig = {
	apiKey: 'Paste your API key here',
	apiSecret: 'Paste your API secret here',
	domains: [],
	autoUpdate: {
		enabled: true,
		interval: 3600
	}
};
let config = defaultConfig;


function fetch(url, init) {
	return new Promise((resolve, reject) => {
		let str = '';

		const req = https.get(url, init, res => {
			res.on('data', data => {
				str += data;
			});

			res.on('end', () => {
				resolve(str);
			});
		});

		req.on('error', err => {
			reject(err);
		});
	});
}


(() => {
	argumented.add(['-s', '--setup'], null, 'Starts the app in an interactive mode ' +
		'allowing you to select which records to update', false);

	fs.access(configFilename, fs.constants.R_OK, err => {
		if (err) {
			console.error('Error: config file cannot be read.');
			fs.access(__dirname, fs.constants.W_OK, err => {
				if (err) {
					console.error('Error: cannot create sample config file. Please check the permissions.');
					process.exit(~0);
				} else {
					fs.writeFile(configFilename, JSON.stringify(defaultConfig), err => {
						console.log('Sample config file (config.json) created. Please edit the file and restart the application.');
						process.exit();
					});
				}
			});
		} else {
			fs.readFile(path.resolve(configFilename), 'utf-8', (err, data) => {
				config = JSON.parse(data);

				argumented.parse(process.argv, 'GoDaddns. Never get a wrong IP again.');
				if (argumented.has(['-s', '--setup'])) {
					console.info('Welcome to GoDaddns! Let\'s choose the records you want to be updated.');
					setup(config);
				} else {
					console.info('Config read. Connecting to GoDaddy...');
					run(config);
				}
			});
		}
	});
})();


function getAuthHeader(config) {
	return 'sso-key ' + config.apiKey + ':' + config.apiSecret;
}


async function setup(config) {
	console.log('Setup');
}


async function run(config) {
	console.log(JSON.parse(await fetch(godaddyEndpoint + '/v1/domains/', {
			headers: {
				'Authorization': getAuthHeader(config)
			}
		})
	));
}
