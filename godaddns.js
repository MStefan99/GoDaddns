'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');

const inquirer = require('inquirer');
const argumented = require('@mstefan99/argumented');

const godaddyEndpoint = 'https://api.godaddy.com';
const ipEndpoint = 'https://ipapi.co/ip';

let configReadable = false;
let configWritable = false;
let verbose = false;
let ip = '0.0.0.0';


const configFilename = path.resolve(__dirname, './config.json');
const defaultConfig = {
	apiKey: 'Paste your API key here',
	apiSecret: 'Paste your API secret here',
	domains: [],
	ttl: 3600,
	resetOnExit: true,
	autoUpdate: {
		enabled: true,
		interval: 60
	}
};
let config = defaultConfig;


function clamp(val, min, max) {
	if (isNaN(val)) {
		return null;
	} else {
		return +val < min? min : val > max? max : val;
	}
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
					reject(res.statusCode);
				}
				resolve(str);
			});
		});

		req.on('error', err => {
			console.error('Error: HTTP request failed:', err);
			process.exit(~1);
		});

		if (init.method? init.method.toUpperCase() !== 'GET' : false) {
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
				ttl: clamp(config.ttl, 600, 604800) || 3600
			};
			info(' ', newRecord);
			await fetch(godaddyEndpoint + '/v1/domains/' + domain.name + '/records/' +
				record.type + '/' + record.name, {
					method: 'PUT',
					headers: {
						'Authorization': getAuthHeader(),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify([newRecord])
				}
			);
			info('  Record updated.');
		}
	}
}


function saveConfig() {
	return new Promise((resolve, reject) => {
		fs.writeFile(configFilename, JSON.stringify(config, null, 2),
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
	argumented.description('GoDaddns. Never get a wrong IP again.');
	argumented.add('setup', ['-s', '--setup'], null, 'Starts the app in an interactive setup mode ');
	argumented.add('verbose', ['-v', '--verbose'], null, 'Enable more verbose output');
	const options = argumented.parse();
	verbose = options.verbose;

	fs.access(configFilename, fs.constants.R_OK, err => {
		configReadable = !err;
		info('Checking config file. Readable:', configReadable);
		fs.access(configFilename, fs.constants.W_OK, err => {
			configWritable = !err;
			info('Checking config file. Writable:', configWritable);

			if (configReadable) {
				fs.readFile(path.resolve(configFilename), 'utf8', (err, data) => {
					Object.assign(config, JSON.parse(data));

					if (options.setup) {
						if (configWritable) {
							console.info('Welcome to GoDaddns! Let\'s choose the records you want to be updated.');
							setup()
								.then(() => inquirer.prompt({
									name: 'start',
									type: 'confirm',
									message: 'Do you want to start GoDaddns now?'
								}))
								.then(answers => {
									if (answers.start) {
										init();
									} else {
										console.log('You can start GoDaddns at any time by running node ./godaddns.js');
									}
								});
						} else {
							console.error('Cannot write the config file! Please check the permissions');
							process.exit(~0);
						}
					} else {
						info('Config read. Connecting to GoDaddy...');
						init();
					}
				});
			} else {
				info('Error: config file cannot be read.');
				fs.access(__dirname, fs.constants.W_OK, err => {
					if (!err) {
						configWritable = configReadable = true;
						saveConfig().then(() => {
							console.log('Sample config file created. Please edit the file and restart the application ' +
								'or launch with -s to start interactive setup.');
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
	if (config.apiKey.match(' ') || config.apiSecret.match(' ')) {
		console.log('Now you will need to update your credentials to connect to GoDaddy.');
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'apiKey',
				message: 'Your GoDaddy API Key:',
				validate: val => (val.length && !val.match(' ')) || 'Please enter a valid key'
			},
			{
				type: 'input',
				name: 'apiSecret',
				message: 'Your GoDaddy API secret:',
				validate: val => (val.length && !val.match(' ')) || 'Please enter a valid secret'
			}
		]);
		Object.assign(config, answers);
	}

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
	await saveConfig().catch(() => process.exit(~0));
	console.log('Your settings have been saved!');
}


function init() {
	console.log('Starting up GoDaddns...');

	if (config.resetOnExit) {
		process.on('beforeExit', stop);
		process.on('SIGTERM', stop);
		process.on('SIGINT', stop);
	}
	enableAutoUpdate();
	run();
}


function enableAutoUpdate() {
	setInterval(() => {
		info('Updating IP...');
		if (config.autoUpdate) {
			if (config.autoUpdate.enabled) {
				run();
			}
		}
	}, 1000 * 60 * clamp(config.autoUpdate.interval, 5, 1440));
}


async function run() {
	if (config.domains? !config.domains.length : false) {
		console.warn('Warning: No domains added! Please run with the -s flag to set up.');
		process.exit(~2);
	}

	info('Getting IP address...');
	const newIP = await fetch(ipEndpoint);
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
