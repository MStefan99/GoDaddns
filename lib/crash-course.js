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
	console.info,
	console.log,
	console.warn,
	console.error,
];

function wrapLog(level) {
	return function (...data) {
		sendLog(data.map((d) => typeof d === 'string' ? d : JSON.stringify(d)).join(' '), level);

		if (level < 2 && !options.verbose) {
			return;
		}
		log[level](...data);
	};
}

console.debug = wrapLog(0);
console.info = wrapLog(1);
console.log = wrapLog(2);
console.warn = wrapLog(3);
console.error = wrapLog(4);

process.on('error', (e) => {
	sendLog(
		e.error?.stack ?? JSON.stringify(e.error),
		3,
	); // Promise is always resolved
	return false;
});

process.on('unhandledrejection', (e) => {
	sendLog(
		e.reason?.stack ?? JSON.stringify(e.reason),
		3,
	); // Promise is always resolved
	return false;
});
