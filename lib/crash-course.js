'use strict';

import {configPromise, options} from "../godaddns.js";


async function sendLog(message, level = 0, tag = null) {
	const config = await configPromise;

	if (!config.crashCourse.enabled) {
		return;
	}
	if (typeof message !== 'string' || typeof level !== 'number') {
		throw new Error('Please provide both message and level to send');
	}
	if (!tag) {
		tag = null;
	}

	tag = config.crashCourse.tag + (tag ? ' ' + tag : '');
	return fetch(config.crashCourse.host + '/audience/logs', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Audience-Key': config.crashCourse.key,
		},
		body: JSON.stringify({message, level, tag}),
	})
		.then((res) => {
			if (!res.ok) {
				return res.json().then((json) => Promise.reject(json));
			}
		})
		.catch((err) => {
			console.warn(
				'Failed to send a log to Crash Course! More details:',
				err,
			);
			return err;
		});
}

const log = [
	console.debug,
	console.log,
	console.warn,
	console.error,
];

function wrapLog(level) {
	return function (...data) {
		sendLog(data.map((d) => typeof d === 'string' ? d : JSON.stringify(d)).join(' '), level);

		if (!level && !options.verbose) {
			return;
		}
		log[level](...data);
	};
}

console.debug = wrapLog(0);
console.info = wrapLog(0);
console.log = wrapLog(1);
console.warn = wrapLog(2);
console.error = wrapLog(3);

process.on('unhandledRejection', async (reason) => {
	try {
		await sendLog('Unhandled rejection: ' + reason?.stack, 4);
		console.error('Unhandled rejection while exiting:', reason?.stack);
	} catch (e) {
		console.error('Unhandled rejection while exiting:', e);
	}
	process.exit(~0x1);
});


process.on('uncaughtException', async (err) => {
	try {
		await sendLog('Uncaught exception: ' + err?.stack, 4);
		console.error('Uncaught exception while exiting:', err?.stack);
	} catch (e) {
		console.error('Uncaught exception while exiting:', e);
	}
	process.exit(~0x0);
});
