const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('./util');

const args = process.argv.slice(2);

const tokenData = JSON.parse(fs.readFileSync(args[0]));

const singleVars = [
	'$grays',
	'$primary-map',
	'$secondary-map',
	'$success-map',
	'$info-map',
	'$warning-map',
	'$danger-map',
	'$light-map',
	'$dark-map',
	'$border-radius-map',
	'$font-family-map',
	'$font-size-map',
	'$font-weight-map',
	'$link',
];

const colorVars = [
	'$primary-map',
	'$secondary-map',
	'$success-map',
	'$info-map',
	'$warning-map',
	'$danger-map',
	'$light-map',
	'$dark-map',
];

function isSingleVariable(key) {
	if (singleVars.indexOf(key) > -1) {
		return true;
	}

	return false;
}

function splitMap(key, obj, subsection) {
	let variableName = `${subsection}-${key}`;

	if (singleVars.indexOf(subsection) > -1) {
		if (colorVars.indexOf(subsection) > -1) {
			variableName = variableName.replace(/-base/, '');
		}

		variableName = variableName.replace(/-map/, '');

		return [variableName, 'map-get(' + subsection + ', ' + key + ')'];
	}

	return [key, obj[key]];
}

let sections = util.getSections(tokenData);
let scssVars = {};

// build an object that replicates Clay Sass Variable structure

sections.forEach(function(sectionName, index) {
	scssVars[sectionName] = {};

	function crawlTokenData(props) {
		const obj = props.obj;
		const subsection = props.subsection;

		for (let key in obj) {
			if (typeof obj[key] === 'object') {
				if (obj[key].value !== undefined) {
					// this is a property

					if (key === 'inline-item-spacer-x') {
						if (typeof subsection['inline-item-before'] !== 'object') {
							subsection['inline-item-before'] = {};
						}
						if (typeof subsection['inline-item-after'] !== 'object') {
							subsection['inline-item-after'] = {};
						}

						subsection['inline-item-before']['margin-right'] = util.toClayUnset(obj[key].value);
						subsection['inline-item-after']['margin-left'] = util.toClayUnset(obj[key].value);
					}
					else if (obj[key].type === 'typography') {
						// loop through typography and convert camel case to dashed

						for (let typographyKey in obj[key].value) {
							subsection[util.camelCaseToDashed(typographyKey)] = util.toClayUnset(obj[key].value[typographyKey]);
						}
					}
					else if (obj[key].type === 'boxShadow') {
						subsection[key] = util.toCSSBoxShadow(obj[key].value);
					}
					else {
						subsection[key] = util.toClayUnset(obj[key].value);
					}
				}
				else {
					// this is a group

					subsection[key] = {};

					crawlTokenData({
						obj: obj[key],
						subsection: subsection[key],
					});
				}
			}
		}
	}

	crawlTokenData({
		obj: tokenData[sectionName],
		subsection: scssVars[sectionName],
	});
});

// build a string to output to _clay_variables.scss

let sb = '';
let singleVariables = '';

sections.forEach(function(sectionName, index) {
	let previous = '';

	sb += index > 0 ? os.EOL : '';
	sb += '// ';
	sb += sectionName;
	sb += os.EOL + os.EOL;

	function crawlScssVars(props) {
		const obj = props.obj;
		const subsection = props.subsection;

		let i = props.forInIteration;

		for (let key in obj) {
			const value = obj[key];

			i++;

			if (typeof value === undefined) {
				return;
			}

			if (typeof value === 'object' && key.startsWith('$')) {
				// this is a sass map
				sb += util.indent(props.crawlIteration);
				sb += key;
				sb += ': (';
				sb += os.EOL;

				crawlScssVars({
					forInIteration: 0,
					crawlIteration: props.crawlIteration + 1,
					obj: value,
					subsection: key,
				});
			}
			else if (typeof value === 'object' && !key.startsWith('$')) {
				// this is nested property in sass map

				sb += util.indent(props.crawlIteration);
				sb += util.quote(key);
				sb += ': (';
				sb += os.EOL;

				crawlScssVars({
					forInIteration: 0,
					crawlIteration: props.crawlIteration + 1,
					obj: value,
					subsection: key,
				});
			}
			else if (key.startsWith('$')) {
				// this is a single variable

				sb += key;
				sb += ': ';
				sb += util.toMapGet(obj[key]);
				sb += ';';
				sb += os.EOL;

				previous = obj[key];
			} else {
				// these are properties

				if (previous.match(/inline-item-before\.margin-right/) && obj[key].match(/inline-item-spacer-x/)) {
					obj[key] = obj[key].replace(/(?<=\.)inline-item-spacer-x/g, 'inline-item-after.margin-left');
				}
				else if (obj[key].match(/inline-item-spacer-x/)) {
					obj[key] = obj[key].replace(/(?<=\.)inline-item-spacer-x/g, 'inline-item-before.margin-right');
				}

				let singleVar = splitMap(key, obj, subsection);

				if (isSingleVariable(subsection)) {
					singleVariables += util.toSingular(singleVar[0]);
					singleVariables += ': ';
					singleVariables += util.toMapGet(singleVar[1]);
					singleVariables += ';';
					singleVariables += os.EOL;
				}

				sb += util.indent(props.crawlIteration);
				sb += util.quote(key);
				sb += ': ';
				sb += util.toMapGet(obj[key]);
				sb += ',';
				sb += os.EOL;

				previous = obj[key];
			}

			if (i === Object.keys(obj).length && subsection) {
				if (subsection.startsWith('$')) {
					sb += ');';
					sb += os.EOL;
				}
				else {
					sb += util.indent(props.crawlIteration - 1);
					sb += '),';
					sb += os.EOL;
				}

				if (isSingleVariable(subsection)) {
					sb += singleVariables;

					singleVariables = '';
				}
			}


		}
	}

	crawlScssVars({
		forInIteration: 0,
		crawlIteration: 0,
		obj: scssVars[sectionName],
		subsection: null,
	});
});

const buildDir = path.join('.', 'build');

if (!fs.existsSync(buildDir)){
	fs.mkdirSync(buildDir);
}

const outputFile = args[1] || '_clay_variables.scss';

fs.writeFileSync(
	path.join('build', outputFile),
	sb
);
