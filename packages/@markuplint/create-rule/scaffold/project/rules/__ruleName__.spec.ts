import { mlRuleTest } from 'markuplint';
import { test, expect } from 'vitest';

import { __ruleName__c } from './__ruleName__.js';

/**
 * Example: Write tests
 */
test('It is test', async () => {
	const { violations } = await mlRuleTest(
		__ruleName__c({
			/* Plugin settings */
		}),
		/**
		 * Example: The target HTML that is evaluated
		 */
		'<div><!-- TODO: I will do something --></div>',
	);

	/**
	 * Example: Set expected results.
	 */
	expect(violations).toStrictEqual([
		{
			severity: 'error',
			line: 1,
			col: 6,
			raw: '<!-- TODO: I will do something -->',
			message: 'It is TODO',
		},
	]);
});
