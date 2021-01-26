'use strict';

const argEntries = [];
const helpArgs = ['-h', '--help'];
let name = '';
let desc = '';

/*
 * Usage:
 */


function makeEntry(args, cb, desc, required = false) {
	if (!args instanceof Array) {
		args = [args];
	}
	return {args, cb, required, desc, argNumber: cb?.length || 0};
}


function execute(entry) {
	const idx = process.argv.findIndex(arg => entry.args.includes(arg));
	if (idx >= 0) {
		entry?.cb?.(...process.argv.slice(idx + 1, idx + entry.argNumber + 1));
	}
}


function printHelpPage() {
	let invocation = '';
	let paramDesc = '';

	for (const entry of argEntries) {
		invocation += (entry.required? ' ' : ' [') + entry.args.join(', ') +
			(entry.argNumber? ' (+' + entry.argNumber + ' args)' : '') + (entry.required? '' : ']');

		paramDesc += '\t' + entry.args.join(', ') + (entry.argNumber? ' (+' + entry.argNumber + ' args)' : '') +
			'\t' + entry.desc + '\n';
	}

	console.log(desc + '\n\n' +
		'Usage:\n' +
		'\tnode ./' + name + invocation + '\n\n' +
		'Options:\n' +
		paramDesc);
	process.exit();
}


function init(description) {
	name = process.argv[1].match(/[^<>:"/\\|?*]+$/)[0];
	if (description) {
		desc = description;
	}
	// Help needs to be added first but execution is deferred to the end when argEntries is populated
	add(helpArgs, null, 'Show this page');
}


function add(args, callback = null, description = '', required = false) {
	if (!args) {
		throw new Error('No arguments provided');
	}
	if (!args instanceof Array) {
		args = [args];
	}
	const entry = makeEntry(args, callback, description, required);
	argEntries.push(entry);
	if (!has(helpArgs)) {
		execute(entry);
	}
	return this;
}


function has(args) {
	if (!args instanceof Array) {
		args = [args];
	}

	return args.some(arg => process.argv.includes(arg));
}


function done() {
	for (const entry of argEntries.filter(entry => entry.required)) {
		for (const arg of entry.args) {
			if (!process.argv.includes(arg)) {
				console.error('Error: required argument missing: ' + arg + '.\n' +
					'Use --help for usage info.');
				process.exit(0xf000);
			}
		}
	}
	if (has(helpArgs)) {
		printHelpPage();
	}
}


module.exports = {
	init,
	add,
	has,
	done
};
