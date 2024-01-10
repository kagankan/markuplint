import { mlRuleTest } from 'markuplint';
import { test, expect } from 'vitest';

import rule from './index.js';

test('No warning', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav></nav>
	<main>
		<header></header>
		<footer></footer>
	</main>
	<aside></aside>
	<footer></footer>
</body>
</html>
`,
	);

	expect(violations).toStrictEqual([]);
});

test('Top level landmarks', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav></nav>
	<main>
		<header></header>
		<footer></footer>
		<aside></aside>
	</main>
	<footer></footer>
</body>
</html>
`,
	);

	expect(violations).toStrictEqual([
		{
			severity: 'warning',
			line: 9,
			col: 3,
			raw: '<aside>',
			message: 'The "complementary" role should be top level',
		},
	]);
});

test('Top level landmarks: disabled', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav></nav>
	<main>
		<header></header>
		<footer></footer>
		<aside></aside>
	</main>
	<footer></footer>
</body>
</html>
`,
		{
			nodeRule: [
				{
					selector: 'aside',
					rule: false,
				},
			],
		},
	);

	expect(violations).toStrictEqual([]);
});

test('Top level landmarks: ignoreRoles option', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav></nav>
	<main>
		<header></header>
		<footer></footer>
		<aside></aside>
	</main>
	<footer></footer>
</body>
</html>
`,
		{
			rule: {
				options: {
					ignoreRoles: ['complementary'],
				},
			},
		},
	);

	expect(violations).toStrictEqual([]);
});

test('Duplicated area: has-label', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav aria-label="main"></nav>
	<main>
		<header></header>
		<nav aria-label="sub"></nav>
		<footer></footer>
	</main>
	<footer></footer>
</body>
</html>
`,
		{
			rule: {
				options: {
					ignoreRoles: ['complementary'],
				},
			},
		},
	);

	expect(violations).toStrictEqual([]);
});

test('Duplicated area: no-label', async () => {
	const { violations } = await mlRuleTest(
		rule,
		`
<html>
<body>
	<header></header>
	<nav></nav>
	<main>
		<header></header>
		<nav></nav>
		<footer></footer>
	</main>
	<footer></footer>
</body>
</html>
`,
		{
			rule: {
				options: {
					ignoreRoles: ['complementary'],
				},
			},
		},
	);

	expect(violations).toStrictEqual([
		{
			severity: 'warning',
			line: 5,
			col: 2,
			raw: '<nav>',
			message: 'Require unique accessible name',
		},
		{
			severity: 'warning',
			line: 8,
			col: 3,
			raw: '<nav>',
			message: 'Require unique accessible name',
		},
	]);
});

test('The `as` attribute', async () => {
	expect(
		(
			await mlRuleTest(
				rule,
				`
<html>
<body>
	<main>
		<x-aside as="aside"></x-aside>
	</main>
</body>
</html>
`,
			)
		).violations,
	).toStrictEqual([
		{
			severity: 'warning',
			line: 5,
			col: 3,
			message: 'The "complementary" role should be top level',
			raw: '<x-aside as="aside">',
		},
	]);
});
