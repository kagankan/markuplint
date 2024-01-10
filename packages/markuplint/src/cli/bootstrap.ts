import type { ReadonlyDeep } from 'type-fest';

import meow from 'meow';

export const help = `
Usage
	$ markuplint <HTML file paths (glob format)>
	$ <stdout> | markuplint

Options
	--config,                -c FILE_PATH  A configuration file path.
	--fix,                                 Fix HTML.
	--format,                -f FORMAT     Output format. Support "JSON", "Simple", "GitHub" and "Standard". Default: "Standard".
	--no-search-config                     No search a configure file automatically.
	--ignore-ext                           Evaluate files that are received even though the type of extension.
	--no-import-preset-rules               No import preset rules.
	--locale                               Locale of the message of violation. Default is an OS setting.
	--no-color,                            Output no color.
	--problem-only,          -p            Output only problems, without passeds.
	--allow-warnings                       Return status code 0 even if there are warnings.
	--allow-empty-input                    Return status code 1 even if there are no input files.
	--verbose                              Output with detailed information.
	--include-node-modules                 Include files in node_modules directory. Default: false.

	--init                                 Initialize settings interactively.
	--search                               Search lines of codes that include the target element by selectors.

	--help,                  -h            Show help.
	--version,               -v            Show version.

Examples
	$ markuplint verifyee.html --config path/to/.markuplintrc
	$ cat verifyee.html | markuplint
`;

export const cli = meow(help, {
	importMeta: import.meta,
	flags: {
		config: {
			type: 'string',
			shortFlag: 'c',
		},
		fix: {
			type: 'boolean',
			default: false,
		},
		format: {
			type: 'string',
			shortFlag: 'f',
		},
		searchConfig: {
			type: 'boolean',
			default: true,
		},
		ignoreExt: {
			type: 'boolean',
			default: false,
		},
		importPresetRules: {
			type: 'boolean',
			default: true,
		},
		locale: {
			type: 'string',
		},
		color: {
			type: 'boolean',
			default: true,
		},
		problemOnly: {
			type: 'boolean',
			shortFlag: 'p',
			default: false,
		},
		allowWarnings: {
			type: 'boolean',
			// TODO: It will be changed to `true` in the next major version.
			default: false,
		},
		allowEmptyInput: {
			type: 'boolean',
			default: true,
		},
		verbose: {
			type: 'boolean',
			default: false,
		},
		init: {
			type: 'boolean',
			default: false,
		},
		createRule: {
			type: 'boolean',
			default: false,
		},
		search: {
			type: 'string',
		},
		includeNodeModules: {
			type: 'boolean',
			default: false,
		},
	},
});

export type CLIOptions = ReadonlyDeep<typeof cli.flags>;
