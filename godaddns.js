'use strict';

import inquirer from 'inquirer';
import argumented from './lib/argumented.cjs';
import Config from './lib/configurer.cjs';
import {upgradeConfig} from "./lib/upgrade.js";
import './lib/crash-course.js';

const godaddyEndpoint = 'https://api.godaddy.com';
const ipEndpoint = 'https://ipapi.co/ip';
let ip = '0.0.0.0';

argumented.description('GoDaddns. Never get a wrong IP again.');
argumented.add('setup', ['-s', '--setup'], null, 'Starts the app in an interactive setup mode');
argumented.add('verbose', ['-v', '--verbose'], null, 'Enable verbose logs');
export const options = argumented.parse();


export const config = new Config('./config.json');
export const configPromise = config._load();
config.defaults = {
	schema: 'v2',
	credentials: {
		key: 'Paste your API key here',
		secret: 'Paste your API secret here',
	},
	crashCourse: {
		enabled: false,
		host: 'https://crash-course.apps.mstefan99.com/api',
		key: '8e471c677e4523ab',
	},
	domains: [],
	ttl: 3600,
	resetOnExit: true,
	autoUpdate: {
		enabled: true,
		interval: 60
	}
};

function clamp(val, min, max) {
	if (typeof val !== 'number' || isNaN(val)) {
		return null;
	} else {
		return +val < min ? min : val > max ? max : val;
	}
}

async function getAuthHeader(key, secret) {
	if (!key || !secret) {
		await configPromise;
		({key, secret} = config.credentials);
	}
	return 'sso-key ' + key + ':' + secret;
}

async function setIPs(ip) {
	await configPromise;

	for (const domain of config.domains) {
		console.info('Created records for domain', domain.name);

		for (const record of domain.records) {
			const newRecord = {
				name: record.name,
				data: ip,
				type: 'A',
				ttl: clamp(config.ttl, 600, 604800) || 3600
			};
			console.info('Updating:', newRecord);
			try {
				const res = await fetch(godaddyEndpoint + '/v1/domains/' + domain.name + '/records/' +
					record.type + '/' + record.name, {
						method: 'PUT',
						headers: {
							'Authorization': await getAuthHeader(),
							'Content-Type': 'application/json'
						},
						body: JSON.stringify([newRecord])
					}
				);
				if (res.ok) {
					console.info('Record updated.');
				} else {
					console.warn('Failed to update', record.name);
					console.info('Update request returned an error:', await res.json());
					return false;
				}
			} catch (err) {
				console.warn('Failed to update '+ record.name + ':', err);
				console.info('Update request failed', err);
			}
		}
	}
	return true;
}

async function setup() {
	await configPromise;
	let {key, secret} = config;

	config.crashCourse.enabled = (await inquirer.prompt({
		type: 'confirm',
		message: 'Do you want to enable submitting anonymous error reports? ' +
			'This is optional but it helps fix issues and improve the user experience.',
		name: 'analytics'
	})).analytics;

	const promptCredentials = !config.credentials?.key?.length
		|| !config.credentials?.secret?.length
		|| config.credentials.key.match(' ')
		|| config.credentials.secret.match(' ')
		|| (await inquirer.prompt({
			type: 'confirm',
			name: 'credentials',
			message: 'You already have GoDaddy credentials saved. Do you want to change them?'
		})).credentials;

	if (promptCredentials) {
		console.log('Now you will need to update your credentials to connect to GoDaddy.');

		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'key',
				message: 'Your GoDaddy API Key:',
				validate: val => (val.length && !val.match(' ')) || 'Please enter a valid key'
			},
			{
				type: 'input',
				name: 'secret',
				message: 'Your GoDaddy API secret:',
				validate: val => (val.length && !val.match(' ')) || 'Please enter a valid secret'
			}
		]);
		({key, secret} = answers);
	}

	// Setting up domains
	{
		console.info('Downloading domain list from GoDaddy...');
		try {
			const res = await fetch(godaddyEndpoint + '/v1/domains/', {
				headers: {
					'Authorization': await getAuthHeader(key, secret)
				}
			});

			if (res.ok) {
				const domains = await res.json();
				if (promptCredentials) {
					config.credentials.key = key;
					config.credentials.secret = secret;
					await config._save();
				}

				if (!domains.length) {
					console.log('You don\'t have any domains in your GoDaddy account. Get a domain to get started!');
					return false;
				}
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
				await config._save();
			} else {
				console.log('GoDaddy request failed! Please check your credentials and try again.');
				console.info('Domain request returned an error:', await res.json());
				return false;
			}
		} catch (err) {
			console.log('GoDaddy request failed! Please check your credentials and try again.');
			console.info('Domain request failed:', err);
			return false;
		}
	}

	// Setting up records
	{
		console.log('Excellent! Let\'s now choose which records you want to update for each domain.');
		for (const domain of config.domains) {
			console.info('Downloading record list for domain', domain, 'from GoDaddy...');
			try {
				const res = await fetch(godaddyEndpoint + '/v1/domains/'
					+ domain.name + '/records/A/', {
					headers: {
						'Authorization': await getAuthHeader()
					}
				});

				if (res.ok) {
					const records = await res.json();
					console.info('Records:', records);

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
				} else {
					console.log('GoDaddy request failed! Please check your credentials and try again.');
					console.info('Record request returned an error:', await res.json());
					return false;
				}
			} catch (err) {
				console.log('GoDaddy request failed! Please check your credentials and try again.');
				console.info('Record request failed:', err);
				return false;
			}
		}
		await config._save();
	}

	return true;
}

async function init() {
	console.log('Starting up GoDaddns...');
	await configPromise;

	if (config.resetOnExit) {
		process.on('beforeExit', stop);
		process.on('SIGTERM', stop);
		process.on('SIGINT', stop);
	}
	enableAutoUpdate();
	update();
}

async function enableAutoUpdate() {
	await configPromise;

	setInterval(() => {
		console.info('Updating IP...');
		if (config.autoUpdate) {
			if (config.autoUpdate.enabled) {
				update();
			}
		}
	}, 1000 * 60 * clamp(config.autoUpdate.interval, 5, 1440));
}

async function update() {
	await configPromise;

	if (config.domains ? !config.domains.length : false) {
		console.warn('Warning: No domains added! Please run with the -s flag to set up.');
		process.exit(~0);
	}

	console.info('Getting IP address...');
	try {
		const res = await fetch(ipEndpoint);
		if (res.ok) {
			const newIP = await res.text();
			console.info('Got IP address:', newIP);
			if (newIP !== ip) {
				console.log('Your IP has changed, updating...');
				ip = newIP;
				await setIPs(newIP) && console.log('All records updated!');
			} else {
				console.log('IP unchanged, nothing to do');
			}
		} else {
			console.warn('IP request returned an error:', await res.text());
		}
	} catch (err) {
		console.warn('IP request failed:', err);
	}
}

async function stop() {
	console.log('Shutting down GoDaddns...');

	await setIPs('0.0.0.0') && console.log('All records reset, GoDaddns done');
	process.exit(0);
}

(async () => {
	await upgradeConfig();

	if (options.setup) {
		console.log('Welcome to GoDaddns! Let\'s choose the records you want to be updated.');
		setup()
			.then(success => success ? inquirer.prompt({
				name: 'start',
				type: 'confirm',
				message: 'Do you want to start GoDaddns now?'
			}) : {})
			.then(answers => {
				if (answers.start) {
					init();
				} else {
					console.log('You can start GoDaddns at any time by running "node ./godaddns.js"');
				}
			});
	} else {
		init();
	}
})();
