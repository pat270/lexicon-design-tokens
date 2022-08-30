module.exports = {
	camelCaseToDashed: function (str) {
		return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
	},

	getSections: function (data) {
		let sections = [];

		for (let key in data) {
			sections.push(key);
		}

		return sections;
	},

	isSassVar: function (key) {
		return key.startsWith('$');
	},

	// Convert Figma Box Shadows to CSS value

	toCSSBoxShadow: function (arr) {
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
	},

	// Convert Figma Font Family and Font Weight to CSS value

	toCSSFont: function (val) {
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

		if (translate[val]) {
			val = translate[val];
		}

		return val;
	},

	// Convert blank values in Figma to clay-unset

	toClayUnset: function (val) {
		if (val === '') {
			return 'clay-unset';
		}

		return val;
	},

	// Convert nested tokens to Sass map-get/map-deep-get

	toMapGet: function (val) {
		const figmaTokens = val.match(/(?<=\{)(.+?)(?=\})/g);

		let regexStr = '';

		if (figmaTokens) {
			for (let i = 0; i < figmaTokens.length; i++) {
				let keys = figmaTokens[i].match(/(?<=\.)(.+?)($|(?=\.))/g);
				let property = '';

				if (keys) {
					// Remove typography from array, this is a figma specific property
					const typographyIndex = keys.indexOf('typography');

					if (typographyIndex > -1) {
						keys.splice(typographyIndex, 1);
					}

					const length = keys.length;

					property += length > 1 ? 'map-deep-get(' : 'map-get(';

					property += val.match(/(?<=\{)\$(.+?)(?=\.)/g) + ', ';

					for (let j = 0; j < length; j++) {
						property += keys[j];

						if (j + 1 === length) {
							property += ')';
						}
						else {
							property += ', ';
						}
					}
				} else {
					regex = new RegExp(`\\${figmaTokens[i]}`, 'g');

					property = val.match(regex)[0];
				}

				regexStr = '\\{\\' + figmaTokens[i].replace(/\./g, '\\.') + '\\}';

				regex = new RegExp(regexStr, 'g');

				val = val.replace(regex, property);
			}
		}

		return this.toCSSFont(val);
	},

	// Convert plural key name to singular

	toSingular: function (key) {
		const pluralNames = {
			'$grays': '$gray',
			'$primary-colors': '$primary',
			'$secondary-colors': '$secondary',
			'$success-colors': '$success',
			'$info-colors': '$info',
			'$warning-colors': '$warning',
			'$danger-colors': '$danger',
			'$light-colors': '$lights',
			'$dark-colors': '$dark',
			'$border-radii': '$border-radius',
			'$font-families': '$font-family',
			'$font-sizes': '$font-size',
			'$font-weights': '$font-weight',
		};

		for (let keyName in pluralNames) {
			if (key.includes(keyName)) {
				const regex = new RegExp('\\' + keyName, 'g');

				return key.replace(regex, pluralNames[keyName]);
			}
		}

		return key;
	},

	indent: function (num) {
		let tabs = '';

		for (let i = 0; i < num; i++) {
			tabs += '\t';
		}

		return tabs;
	},

	// Wrap nested keys in single quotes to support key names like '.btn-primary'

	quote: function (key) {
		if (parseInt(key, 10) || key === '0') {
			return key;
		}

		return "'" + key + "'";
	}
};
