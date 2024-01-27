import fs from 'node:fs/promises';
import path from 'node:path';

import { version as versionForTest } from 'test-markuplint';
import { describe, it, expect } from 'vitest';

const { MLEngine } = require('../cjs/index.cjs');

describe('test', () => {
	it('MLEngine.exec()', async () => {
		const engine = await MLEngine.fromCode('<span><div></div></span>', {
			name: 'test.html',
			dirname: __dirname,
			locale: 'en',
		});
		const result = await engine.exec();
		expect(result[0].violations).toEqual([
			{
				ruleId: 'permitted-contents',
				severity: 'error',
				line: 1,
				col: 7,
				message: 'The "div" element is not allowed in the "span" element in this context',
				raw: '<div>',
			},
		]);
	});

	it('Fixture 003.html', async () => {
		const filePath = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixture', '003.html');
		const file = await fs.readFile(filePath, { encoding: 'utf8' });
		const name = path.basename(filePath);
		const dirname = path.dirname(filePath);

		const engine = await MLEngine.fromCode(file, {
			name,
			dirname,
			locale: 'en',
		});

		const result = await engine.exec();

		const errors = result[0].violations.filter(v => v.severity === 'error');
		const warns = result[0].violations.filter(v => v.severity === 'warning');

		expect(errors.map(v => `[${v.line}:${v.col}] ${v.message}`)).toStrictEqual([
			'[26:11] Illegal characters must escape in character reference',
			'[26:13] Illegal characters must escape in character reference',
			'[26:14] Illegal characters must escape in character reference',
			'[26:16] Illegal characters must escape in character reference',
			'[26:20] Illegal characters must escape in character reference',
			'[43:34] Illegal characters must escape in character reference',
			'[43:40] Illegal characters must escape in character reference',
			'[44:3] Illegal characters must escape in character reference',
			'[46:2] Illegal characters must escape in character reference',
			'[47:11] Illegal characters must escape in character reference',
			'[47:22] Illegal characters must escape in character reference',
			'[47:28] Illegal characters must escape in character reference',
			'[47:29] Illegal characters must escape in character reference',
			'[47:34] Illegal characters must escape in character reference',
			'[47:40] Illegal characters must escape in character reference',
			'[48:3] Illegal characters must escape in character reference',
			'[50:2] Illegal characters must escape in character reference',
			'[50:12] Illegal characters must escape in character reference',
			'[55:2] Illegal characters must escape in character reference',
			'[55:8] Illegal characters must escape in character reference',
			'[56:1] Illegal characters must escape in character reference',
			'[56:7] Illegal characters must escape in character reference',
			'[29:27] Illegal characters must escape in character reference',
			'[29:29] Illegal characters must escape in character reference',
			'[29:30] Illegal characters must escape in character reference',
			'[29:31] Illegal characters must escape in character reference',
			'[29:33] Illegal characters must escape in character reference',
			'[33:8] The "color" attribute is deprecated',
			'[38:21] The "align" attribute is deprecated',
			'[33:2] The "font" element is obsolete',
			'[1:1] Never declare obsolete doctype',
			'[22:9] The value of the "id" attribute is duplicated',
			'[33:2] The "font" element is not allowed in the "body" element in this context',
			'[37:23] Require accessible name',
			'[38:2] Require accessible name',
			'[39:2] Require accessible name',
			'[12:2] The "script" element expects the "defer" attribute',
			'[13:2] The "script" element expects the "defer" attribute',
			'[29:3] The "img" element expects the "width" attribute',
			'[29:3] The "img" element expects the "height" attribute',
			'[38:2] The "img" element expects the "width" attribute',
			'[38:2] The "img" element expects the "height" attribute',
			'[39:2] The "img" element expects the "width" attribute',
			'[39:2] The "img" element expects the "height" attribute',
			'[36:26] Cannot overwrite the "document" role to the "a" element according to ARIA in HTML specification',
			'[37:9] Cannot overwrite the role of the "label" element according to ARIA in HTML specification',
		]);
		expect(warns.map(v => `[${v.line}:${v.col}] ${v.message}`)).toStrictEqual([
			'[5:8] Attribute value is must quote on double quotation mark',
			'[6:8] Attribute value is must quote on double quotation mark',
			'[10:39] Attribute value is must quote on double quotation mark',
			'[29:22] Attribute value is must quote on double quotation mark',
		]);
	});

	it('setModule', async () => {
		await MLEngine.setModule('test-markuplint');
		const { version } = await MLEngine.getCurrentModuleInfo();
		expect(version).toBe(versionForTest);
	});

	it('getAccessibilityByLocation', async () => {
		const engine = await MLEngine.fromCode('<div><button>It is button</button></div>', {
			name: 'test.html',
			dirname: __dirname,
			locale: 'en',
		});
		const aria = await engine.getAccessibilityByLocation(1, 7);
		expect(aria).toStrictEqual({
			node: 'button',
			aria: {
				unknown: false,
				exposedToTree: true,
				role: 'button',
				name: 'It is button',
				nameProhibited: false,
				nameRequired: true,
				focusable: true,
			},
		});
	});
});
