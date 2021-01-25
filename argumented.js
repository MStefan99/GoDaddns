'use strict';

const savedArgs = [];
let name = '';
let desc = '';

/*
 * Usage:
 */


function init(description) {
	if (description) {
		desc = description;
	}
}


function add(args, callback, description = '', required=false) {
	if (!args) {
		throw new Error('No arguments provided');
	}
	if (args instanceof Array) {
		savedArgs.push({args, cb: callback, required, desc: description, argNumber: callback?.length || 0});
	} else {
		savedArgs.push({args: [args], cb: callback, required, desc: description, argNumber: callback?.length || 0});
	}
	return this;
}


function has(args) {
	if (!args instanceof Array) {
		args = [args];
	}

	for (const arg of args) {
		if (savedArgs.some(arg => process.argv.includes(arg))) {
			return true;
		}
	}
	return false;
}


function parse(argv, description = '') {
	savedArgs.sort((e1, e2) => e2.arg - e1.arg);
	desc = description;

	if (!argv instanceof Array) {
		argv = argv.split(' ');
	}
	name = argv[1].match(/[^<>:"/\\|?*]+$/)[0];
	for (let i = 0; i < argv.length; ++i) {
		const argument = savedArgs.find(e => e.args.includes(argv[i]));
		if (argument?.cb) {
			if (argument.cb(...argv.slice(i + 1, i + argument.argNumber + 1))) {
				process.exit(0);
			}
			i += argument.argNumber;
		}
	}
}


function help() {
	let invocation = '';
	let paramDesc = '';

	for (const e of savedArgs) {
		invocation += (e.required? ' ' : ' [') + e.args +
			(e.argNumber? ' (' + e.argNumber + ' args)': '') + (e.required? '' : ']');

		paramDesc += '\t'.repeat(1);
		for (const arg of e.args) {
			paramDesc += arg;
			paramDesc += ' ';
		}
		if (e.argNumber) {
			paramDesc += ' (' + e.argNumber + ' args)';
		}
		paramDesc += ' '.repeat(4) + e.desc + '\n';
	}

	console.log('node ./' + name + invocation + '\n\n' +
		desc + '\n\n' +
		'Usage info:\n' +
		paramDesc);
	return true;
}


add(['-h', '--help'], help, false, 'Show this page.');


module.exports = {
	add: add,
	has: has,
	parse: parse
};
