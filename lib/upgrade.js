'use strict';

import {config, configPromise} from "../godaddns.js";

export async function upgradeConfig() {
	await configPromise;

	if ('apiKey' in config || 'apiSecret' in config) {
		return updaters.from.v1();
	} // else if (config.schema === 'v2') {} // For future updates
}

const updaters = {
	from: {
		'v1': async () => {
			console.log('Config v1 found, upgrading to v2...');

			config.schema = 'v2';
			config.credentials = {key: config.apiKey, secret: config.apiSecret};
			delete (config.apiKey);
			delete (config.apiSecret);

			return await config._save();
		}
	}
};
