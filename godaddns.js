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
let verbose = false;
let ip = '0.0.0.0';


const configFilename = path.resolve(__dirname, './config.json');
const defaultConfig = {
	apiKey: 'Paste your API key here',
	apiSecret: 'Paste your API secret here',
	domains: [],
	autoUpdate: {
		enabled: true,
		interval: 60
	}
};
let config = defaultConfig;


function clamp(val, min, max) {
	return val < min? min : val > max? max : val;
}


function info(...data) {
	if (verbose) {
		let line = '';
		for (const element of data) {
			switch (typeof element) {
				case 'string':
				case 'symbol':
					line += element + ' ';
					break;
				case 'object':
					line += JSON.stringify(element) + ' ';
					break;
				default:
					line += element.toString() + ' ';
			}
		}
		console.info(line);
	}
}


function fetch(url, init = {}) {
	return new Promise((resolve, reject) => {
		let str = '';

		const req = https.request(url, init, res => {
			res.on('data', data => {
				str += data;
			});

			res.on('end', () => {
				if (Math.floor(res.statusCode / 100) !== 2) {
					console.error('Error: HTTP request failed:', str);
					process.exit(~1);
				}
				resolve(str);
			});
		});

		req.on('error', err => {
			reject(err);
		});

		if (init?.method?.toUpperCase() !== 'GET') {
			req.end(init.body);
		} else {
			req.end();
		}
	});
}


async function setIPS(ip) {
	for (const domain of config.domains) {
		info('Created records for domain', domain.name);
		for (const record of domain.records) {
			const newRecord = {
				name: record.name,
				data: ip,
				type: 'A',
				ttl: 3600
			};
			info(newRecord);
			const res = await fetch(godaddyEndpoint + '/v1/domains/' + domain.name + '/records/A/' + record.name, {
				method: 'PUT',
				headers: {
					'Authorization': getAuthHeader(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify([newRecord])
			});
			info('Record updated.');
		}
	}
}


function saveConfig() {
	return new Promise((resolve, reject) => {
		fs.writeFile(configFilename, JSON.stringify(config, null, '\t'),
			'utf8', err => {
				if (err) {
					console.error('Cannot write the config file! Please check the permissions');
					reject(err);
				} else {
					resolve();
				}
			});
	});
}


function getAuthHeader() {
	return 'sso-key ' + config.apiKey + ':' + config.apiSecret;
}


(() => {
	argumented.init('GoDaddns. Never get a wrong IP again.');
	argumented.add(['-s', '--setup'], null, 'Starts the app in an interactive mode ' +
		'allowing you to select which records to update');
	argumented.add(['-v', '--verbose'], () => {
		verbose = true;
	}, 'Enable more verbose output');
	argumented.done();

	fs.access(configFilename, fs.constants.R_OK, err => {
		configReadable = !err;
		info('Checking config file. Readable:', configReadable);
		fs.access(configFilename, fs.constants.W_OK, err => {
			configWritable = !err;
			info('Checking config file. Writable:', configWritable);

			if (configReadable) {
				fs.readFile(path.resolve(configFilename), 'utf8', (err, data) => {
					config = JSON.parse(data);

					if (argumented.has(['-s', '--setup'])) {
						if (configWritable) {
							console.info('Welcome to GoDaddns! Let\'s choose the records you want to be updated.');
							setup().then(() => console.log('Awesome! You can now launch GoDaddns ' +
								'at any time using node ./godaddns.js'));
						} else {
							console.error('Cannot write the config file! Please check the permissions');
							process.exit(~0);
						}
					} else {
						info('Config read. Connecting to GoDaddy...');
						console.log('Starting up GoDaddns...');
						enableAutoUpdate();
						init();
					}
				});
			} else {
				info('Error: config file cannot be read.');
				fs.access(__dirname, fs.constants.W_OK, err => {
					if (!err) {
						configWritable = configReadable = true;
						saveConfig().then(() => {
							console.log('Sample config file (config.json) created. Please edit the file and restart the application.');
						});
					} else {
						console.error('Error: cannot create sample config file. Please check the permissions or try creating ' +
							'config.json manually.');
						process.exit(~0);
					}
				});
			}
		});
	});
})();


async function setup() {
	info('Downloading domain list from GoDaddy...');
	const domains = JSON.parse(await fetch(godaddyEndpoint + '/v1/domains/', {
			headers: {
				'Authorization': getAuthHeader()
			}
		})
	);
	info('Domains:', domains);
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
		info('Downloading record list for domain', domain, 'from GoDaddy...');
		const records = JSON.parse(await fetch(godaddyEndpoint + '/v1/domains/'
			+ domain.name + '/records/A/', {
				headers: {
					'Authorization': getAuthHeader()
				}
			})
		);
		info('Records:', records);
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
	console.log('Your settings have been saved!');
}


function init() {
	process.on('beforeExit', stop);
	process.on('SIGTERM', stop);
	process.on('SIGINT', stop);
	enableAutoUpdate();
	run();
}


function enableAutoUpdate() {
	setInterval(() => {
		info('Updating IP...');
		if (config.autoUpdate?.enabled) {
			run();
		}
	}, 1000 * 60 * clamp(config.autoUpdate?.interval, 5, 1440));
}


async function run() {
	if (!config.domains?.length) {
		console.warn('Warning: No domains added! Please run with the -s flag to set up.');
		process.exit(~2);
	}

	info('Getting IP address...');
	const newIP = await fetch(ipifyEndpoint);
	info('Got IP address:', newIP);

	if (newIP !== ip) {
		console.log('Your IP has changed, updating...');
		ip = newIP;
		await setIPS(newIP);
		console.log('All records updated!');
	} else {
		console.log('IP unchanged, nothing to do');
	}
}


async function stop() {
	console.log('Shutting down GoDaddns...');

	await setIPS('0.0.0.0');
	console.log('All records reset, GoDaddns done');
	process.exit();
}
