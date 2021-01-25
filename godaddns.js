'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');

const inquirer = require('inquirer');
const argumented = require('./argumented');

const godaddyEndpoint = 'https://api.godaddy.com/';
const ipifyEndpoint = 'https://api.ipify.org';

let configReadable = false;
let configWritable = false;


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


function fetch(url, init = {}) {
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
	argumented.init('GoDaddns. Never get a wrong IP again.');
	argumented.add(['-s', '--setup'], null, 'Starts the app in an interactive mode ' +
		'allowing you to select which records to update');
	argumented.done();

	fs.access(configFilename, fs.constants.R_OK, err => {
		configReadable = !err;
		fs.access(configFilename, fs.constants.W_OK, err => {
			configWritable = !err;
		});

		if (configReadable) {
			fs.readFile(path.resolve(configFilename), 'utf8', (err, data) => {
				config = JSON.parse(data);

				if (argumented.has(['-s', '--setup'])) {
					if (configWritable) {
						console.info('Welcome to GoDaddns! Let\'s choose the records you want to be updated.');
						setup().then(run);
					} else {
						console.error('Cannot write the config file! Please check the permissions');
						process.exit(~0);
					}
				} else {
					console.info('Config read. Connecting to GoDaddy...');
					run();
				}
			});
		} else {
			console.error('Error: config file cannot be read.');
			if (configWritable) {
				fs.writeFile(configFilename, JSON.stringify(defaultConfig), err => {
					console.log('Sample config file (config.json) created. Please edit the file and restart the application.');
					process.exit();
				});
			} else {
				console.error('Error: cannot create sample config file. Please check the permissions.');
				process.exit(~0);
			}
		}
	});
})();


function saveConfig() {
	return new Promise((resolve, reject) => {
		fs.writeFile(configFilename, JSON.stringify(config), 'utf8', err => {
			if (err) {
				console.error('Cannot write the config file! Please check the permissions');
				reject(err);
			} else {
				console.log('Your settings have been saved! Please restart the app with ');
				resolve();
			}
		});
	});
}


function getAuthHeader(config) {
	return 'sso-key ' + config.apiKey + ':' + config.apiSecret;
}


async function setup() {
	const domains = JSON.parse(await fetch(godaddyEndpoint + '/v1/domains/', {
			headers: {
				Authorization: getAuthHeader(config)
			}
		})
	);
	const answers = await inquirer.prompt({
		type: 'checkbox',
		message: 'Select domains to use: ',
		name: 'domains',
		choices: domains.map(domain => {
			return {name: domain.domain};
		})
	});

	config.domains = answers.domains.map(domain => {
		return {name: domain};
	});
	console.log('Excellent! Let\'s now choose which records you want to update for each domain.');

	for (const domain of config.domains) {
		const records = JSON.parse(await fetch(godaddyEndpoint + '/v1/domains/'
			+ domain.name + '/records/A/', {
				headers: {
					Authorization: getAuthHeader(config)
				}
			})
		);
		const answers = await inquirer.prompt({
			type: 'checkbox',
			message: 'Select records for ' + domain.name + ':',
			name: 'records',
			choices: records
				.filter((record, idx) => records.findIndex(r => r.name === record.name) === idx)  // removing duplicates
				.map(record => {
					return {name: record.name, type: record.type};
				})
		});
		domain.records = answers.records.map(record => {
			return {type: 'A', name: record};
		});
	}
	await saveConfig().catch(err => process.exit(~0));
}


async function run() {
	console.log('Starting up GoDaddns...');
	console.log(config);
}
