import { mlRuleTest } from 'markuplint';
import { test, expect } from 'vitest';

import rule from './index.js';

test('input[required]', async () => {
	const { violations } = await mlRuleTest(
		rule,
		'<input type="text" required /><input type="text" required="required" />',
	);

	expect(violations).toStrictEqual([
		{
			severity: 'warning',
			line: 1,
			col: 58,
			message: 'The "required" attribute is a boolean attribute. It doesn\'t need the value',
			raw: '="required"',
		},
	]);
});

test('input[disabled] (Mutable)', async () => {
	const { violations } = await mlRuleTest(
		rule,
		'<><input type="text" disabled /><input type="text" disabled={disabled} /></>',
		{
			parser: {
				'.*': '@markuplint/jsx-parser',
			},
		},
	);

	expect(violations).toStrictEqual([]);
});

test('Updated the hidden attribute type to Enum form Boolean', async () => {
	expect((await mlRuleTest(rule, '<div hidden></div>')).violations.length).toBe(0);
	expect((await mlRuleTest(rule, '<div hidden=""></div>')).violations.length).toBe(0);
	expect((await mlRuleTest(rule, '<div hidden="hidden"></div>')).violations.length).toBe(0);
	expect((await mlRuleTest(rule, '<div hidden="until-found"></div>')).violations.length).toBe(0);
});

test('The `as` attribute', async () => {
	const { violations } = await mlRuleTest(
		rule,
		'<x-input as="input" type="text" required /><x-input as="input" type="text" required="required" />',
	);

	expect(violations).toStrictEqual([
		{
			severity: 'warning',
			line: 1,
			col: 84,
			message: 'The "required" attribute is a boolean attribute. It doesn\'t need the value',
			raw: '="required"',
		},
	]);
});
