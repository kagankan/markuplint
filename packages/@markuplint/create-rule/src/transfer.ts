import type { File } from './types.js';

import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import { resolve, extname, basename, relative, dirname, sep } from 'node:path';

import { format } from 'prettier';
import tsc from 'typescript';

import { fsExists } from './fs-exists.js';
import { glob } from './glob.js';

type TransferOptions = {
	readonly transpile?: boolean;
	readonly test?: boolean;
	readonly replacer?: Readonly<Record<string, string | void>>;
};

// eslint-disable-next-line import/no-named-as-default-member
const { transpile, ScriptTarget } = tsc;

export async function transfer(
	scaffoldType: 'core' | 'project' | 'package',
	baseDir: string,
	destDir: string,
	options?: TransferOptions,
) {
	const files = await scan(baseDir, destDir);
	const results: File[] = [];
	for (const file of files) {
		const result = await transferFile(scaffoldType, file, options);
		if (result) {
			results.push(result);
		}
	}
	return results;
}

async function transferFile(scaffoldType: 'core' | 'project' | 'package', file: File, options?: TransferOptions) {
	if (!(await fsExists(file.filePath))) {
		return null;
	}

	if (file.test && !options?.test) {
		return null;
	}

	let contents = await fs.readFile(file.filePath, { encoding: 'utf8' });

	if (options?.replacer) {
		for (const [before, after] of Object.entries(options?.replacer)) {
			if (!after) {
				continue;
			}
			// Hyphenation to camel-case for variables
			// `rule-name` => `ruleName`
			contents = contents.replaceAll(
				new RegExp(`__${before}__c`, 'g'),
				// Camelize
				after.replaceAll(/-+([a-z])/gi, (_, $1) => $1.toUpperCase()).replace(/^[a-z]/, $0 => $0.toLowerCase()),
			);
			contents = contents.replaceAll(new RegExp(`__${before}__`, 'g'), after);
		}
	}

	// Remove prettier ignore comment
	contents = contents.replace(/\n\s*\/\/ prettier-ignore/, '');
	contents = contents.replace(/\n\s*<!-- prettier-ignore(?:-(?:start|end))? -->/, '');

	const newFile = { ...file };

	if (scaffoldType === 'core' && file.test) {
		const name = options?.replacer?.ruleName;
		if (!name) {
			throw new Error('Rule name is empty');
		}
		newFile.destDir = newFile.destDir.replace(`${sep}rules${sep}src${sep}`, `${sep}rules${sep}test${sep}`);
		contents = contents.replace("require('./').default", `require('../../lib/${name}').default`);
	}

	// TypeScript transpiles to JS
	if (newFile.ext === '.ts' && options?.transpile) {
		newFile.ext = '.js';
		contents = transpile(
			contents,
			{
				target: ScriptTarget.ESNext,
			},
			newFile.filePath,
		);

		// Insert new line before comments and the export keyword
		contents = contents.replaceAll(/(\n)(\s+\/\*\*|export)/g, '$1\n$2');
	}

	const candidateName = options?.replacer?.[newFile.name.replaceAll('_', '')];
	if (candidateName) {
		newFile.name = candidateName;
		newFile.fileName = candidateName + (newFile.test ? '.spec' : '');
	}

	const dest = resolve(newFile.destDir, newFile.fileName + newFile.ext);

	// Prettier
	const parser =
		newFile.ext === '.md'
			? 'markdown'
			: newFile.ext === '.json'
				? 'json'
				: newFile.ext === '.ts'
					? options?.transpile
						? 'babel'
						: 'typescript'
					: undefined;
	contents = await format(contents, { parser, filepath: dest });

	if (!(await fsExists(newFile.destDir))) {
		await fs.mkdir(newFile.destDir, { recursive: true });
	}

	await fs.writeFile(dest, contents, { encoding: 'utf8' });

	return newFile;
}

async function scan(baseDir: string, destDir: string) {
	const fileList = await glob(resolve(baseDir, '**', '*'));

	const destList = fileList
		.map(filePath => {
			const stat = statSync(filePath);
			if (!stat.isFile()) {
				return null;
			}
			const relPath = relative(baseDir, filePath);
			const destPath = resolve(destDir, relPath);
			const ext = extname(destPath);
			const fileName = basename(destPath, ext);
			const test = extname(fileName) === '.spec';
			const name = basename(fileName, '.spec');
			const destFileDir = dirname(destPath);
			return {
				ext,
				fileName,
				name,
				test,
				destDir: destFileDir,
				filePath,
			};
		})
		.filter((f): f is File => !!f);

	return destList;
}
