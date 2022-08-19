const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const tokenData = JSON.parse(fs.readFileSync(args[0]));

let sections = [];

for (let key in tokenData) {
	sections.push(key);
}

let scssVars = {};

// Sorts Figma Tokens JSON to match Clay

function camelCaseToDashed(str) {
	return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function figmaBoxShadowToCSS(arr) {
	let shadow = '';

	if (Array.isArray(arr)) {
		if (arr.length === 0) {
			return 'clay-unset';
		}

		for (let i = arr.length - 1; i >= 0; i--) {
			if (arr[i].type === 'innerShadow') {
				shadow += 'inset ';
			}

			shadow += `${arr[i].x} ${arr[i].y} ${arr[i].blur} ${arr[i].spread} ${arr[i].color}`;

			if (arr.length > 1 && i > 0) {
				shadow += `, `;
			}
		}
	} else if (arr === '') {
		shadow = 'clay-unset';
	} else if (typeof(arr) === 'object') {
		if (arr.type === 'innerShadow') {
			shadow += 'inset ';
		}

		shadow += `${arr.x} ${arr.y} ${arr.blur} ${arr.spread} ${arr.color}`;
	} else {
		shadow = arr;
	}

	return shadow;
}

function processFigmaValue(val) {
	if (val === '') {
		return 'clay-unset';
	}

	return val;
}

sections.forEach(function(sectionName, index) {
	scssVars[sectionName] = {};

	function recursive(obj, subsection = null) {
		for (let key in obj) {
			if (typeof obj[key] === 'object') {
				if (obj[key].value !== undefined) {
					if (subsection) {
						if (key === 'inline-item-spacer-x') {
							if (typeof subsection['inline-item-before'] !== 'object') {
								subsection['inline-item-before'] = {};
							}
							if (typeof subsection['inline-item-after'] !== 'object') {
								subsection['inline-item-after'] = {};
							}

							subsection['inline-item-before']['margin-right'] = processFigmaValue(obj[key].value);
							subsection['inline-item-after']['margin-left'] = processFigmaValue(obj[key].value);
						}
						else if (obj[key].type === 'typography') {
							// loop through typography and convert camel case to dashed
							for (let typographyKey in obj[key].value) {
								subsection[camelCaseToDashed(typographyKey)] = processFigmaValue(obj[key].value[typographyKey]);
							}
						}
						else if (obj[key].type === 'boxShadow') {
							subsection[key] = figmaBoxShadowToCSS(obj[key].value);
						}
						else {
							subsection[key] = processFigmaValue(obj[key].value);
						}
					} else {
						if (key === 'inline-item-spacer-x') {
							if (typeof scssVars[sectionName]['inline-item-before'] !== 'object') {
								scssVars[sectionName]['inline-item-before'] = {};
							}
							if (typeof scssVars[sectionName]['inline-item-after'] !== 'object') {
								scssVars[sectionName]['inline-item-after'] = {};
							}

							scssVars[sectionName]['inline-item-before']['margin-right'] = processFigmaValue(obj[key].value);
							scssVars[sectionName]['inline-item-after']['margin-left'] = processFigmaValue(obj[key].value);
						} else if (obj[key].type === 'boxShadow') {
							scssVars[sectionName][key] = figmaBoxShadowToCSS(obj[key].value);
						} else {
							scssVars[sectionName][key] = processFigmaValue(obj[key].value);
						}
					}
				} else {
					if (key.startsWith('$')) {
						// this is a group that should be a Sass map

						scssVars[sectionName][key] = {};
						recursive(obj[key], scssVars[sectionName][key]);
					} else {
						if (subsection) {
							// this is a group that is nested inside a Sass map and should be output as is
							subsection[key] = {};
							recursive(obj[key], subsection[key]);
						}
					}
				}
			}
		}
	}

	recursive(tokenData[sectionName]);
});

function assignValue(str) {
	const translate = {
		'SF Pro Text': "#{-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji'}",
		'SFMono-Regular': "#{SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace}",
		'Georgia': "#{Georgia, 'Times New Roman', Times, serif}",
		'Extra Light': 'lighter',
		'Light': '300',
		'Regular': '400',
		'Semibold': '500',
		'Bold': '700',
		'Extra Bold': '900',
	};

	if (translate[str]) {
		str = translate[str];
	}

	return str;
}

function convertToMapGet(str) {
	const figmaTokens = str.match(/(?<=\{)(.+?)(?=\})/g);
	let regexStr = '';

	if (figmaTokens) {
		for (let i = 0; i < figmaTokens.length; i++) {
			let property = '';
			let keys = figmaTokens[i].match(/(?<=\.)(.+?)($|(?=\.))/g);

			if (keys) {
				// Remove typography from array, this is a figma specific property
				const typographyIndex = keys.indexOf('typography');

				if (typographyIndex > -1) {
					keys.splice(typographyIndex, 1);
				}

				const length = keys ? keys.length : 0;

				if (length) {
					property += length > 1 ? 'map-deep-get(' : 'map-get(';

					property += str.match(/(?<=\{)\$(.+?)(?=\.)/g) + ', ';

					for (let j = 0; j < length; j++) {
						property += keys[j];

						if (j + 1 === length) {
							property += ')';
						}
						else {
							property += ', ';
						}
					}
				}
			} else {
				regexStr = '\\' + figmaTokens[i];

				regex = new RegExp(regexStr, 'g');

				property = str.match(regex)[0];
			}

			regexStr = '\\{\\' + figmaTokens[i].replace(/\./g, '\\.') + '\\}';
			regex = new RegExp(regexStr, 'g');

			str = str.replace(regex, property);
		}
	}

	return assignValue(str);
}

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

function shouldBeSingleVariable(key, obj, subsection) {
	let returnVal = false;

	if (singleVars.indexOf(key) > -1) {
		returnVal = true;
	}

	return returnVal;
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

function quoteKeys(key) {
	if (parseInt(key, 10) || key === '0') {
		return key;
	}

	return "'" + key + "'";
}

let sbb = '';
let singleVariables = '';

sections.forEach(function(sectionName, index) {
	let previous = '';

	function recursive(obj, subsection = null, indent = '', i = 0) {
		for (let key in obj) {
			i++;

			if (typeof obj[key] !== undefined) {
				if (typeof obj[key] === 'object') {
					if (key.startsWith('$')) {
						sbb += indent + key + ': (\n';
					} else {
						sbb += indent + quoteKeys(key) + ': (\n';
					}

					recursive(obj[key], key, indent, 0);
				}
				else {
					if (key.startsWith('$')) {
						sbb += indent + key + ': ' + convertToMapGet(obj[key]) + ';\n';

						previous = obj[key];
					}
					else {
						let singleVar = splitMap(key, obj, subsection);

						if (previous.match(/inline-item-before\.margin-right/) && obj[key].match(/inline-item-spacer-x/)) {
							obj[key] = obj[key].replace(/(?<=\.)inline-item-spacer-x/g, 'inline-item-after.margin-left');
						}
						else if (obj[key].match(/inline-item-spacer-x/)) {
							obj[key] = obj[key].replace(/(?<=\.)inline-item-spacer-x/g, 'inline-item-before.margin-right');
						}

						if (shouldBeSingleVariable(subsection)) {
							singleVariables += singleVar[0] + ': ' + convertToMapGet(singleVar[1]) + ';\n';
						}

						sbb += indent + quoteKeys(key) + ': ' + convertToMapGet(obj[key]) + ',\n';

						previous = obj[key];
					}
				}

				if (i === Object.keys(obj).length && subsection) {
					if (subsection.startsWith('$')) {
						sbb += ');\n';
					}
					else {
						sbb += '),\n';
					}

					if (shouldBeSingleVariable(subsection)) {
						sbb += singleVariables;

						singleVariables = '';
					}
				}

			}
		}
	}


	recursive(scssVars[sectionName]);
});

const buildDir = path.join('.', 'build');

if (!fs.existsSync(buildDir)){
	fs.mkdirSync(buildDir);
}

const outputFile = args[1] || '_clay_variables.scss';

fs.writeFileSync(
	path.join('build', outputFile),
	sbb
);
