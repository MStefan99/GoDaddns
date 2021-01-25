'use strict';

const savedArgs = [];
let name = '';
let desc = '';

/*
 * Usage:
 */


function getArg(args, cb, desc, required = false) {
	if (!args instanceof Array) {
		args = [args];
	}
	return {args, cb, required, desc, argNumber: cb?.length || 0};
}


function execute(arg) {
	const idx = process.argv.findIndex(currentArg => arg.args.includes(currentArg));
	if (idx >= 0) {
		if (arg?.cb?.(...process.argv.slice(idx + 1, idx + arg.argNumber + 1))) {
			process.exit(0);
		}
	}
}


function printHelpPage() {
	let invocation = '';
	let paramDesc = '';

	for (const e of savedArgs) {
		invocation += (e.required? ' ' : ' [') + e.args.join(', ') +
			(e.argNumber? ' (' + e.argNumber + ' args)' : '') + (e.required? '' : ']');

		paramDesc += '\t' + e.args.join(' ') + (e.argNumber? ' (+' + e.argNumber + ' args)' : '') +
			'\t' + e.desc + '\n';
	}

	console.log(desc + '\n\n' +
		'Usage:\n' +
		'\tnode ./' + name + invocation + '\n\n' +
		'Options:\n' +
		paramDesc);
	return true;
}


function init(description) {
	name = process.argv[1].match(/[^<>:"/\\|?*]+$/)[0];
	if (description) {
		desc = description;
	}
}


function add(args, callback = null, description = '', required = false) {
	if (!args) {
		throw new Error('No arguments provided');
	}
	if (!args instanceof Array) {
		args = [args];
	}
	const arg = getArg(args, callback, description, required);
	savedArgs.push(arg);
	execute(arg);
	return this;
}


function has(args) {
	if (!args instanceof Array) {
		args = [args];
	}

	return args.some(arg => process.argv.includes(arg));
}


function done() {
	add(['-h', '--help'], printHelpPage, 'Show this page');
}


module.exports = {
	init,
	add,
	has,
	done
};
