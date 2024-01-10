import { createRule } from '@markuplint/ml-core';
import { isVoidElement } from '@markuplint/ml-spec';

export default createRule<boolean>({
	meta: {
		category: 'style',
	},
	defaultSeverity: 'warning',
	async verify({ document, report, t }) {
		if (document.endTag === 'never') {
			return;
		}
		await document.walkOn('Element', el => {
			if (el.isOmitted) {
				return;
			}
			if (isVoidElement(el)) {
				return;
			}
			if (el.closeTag != null) {
				return;
			}
			if ((document.endTag === 'xml' || el.isForeignElement) && el.selfClosingSolidus?.raw) {
				return;
			}

			report({
				scope: el,
				message: t('Missing {0}', t('the {0}', 'end tag')),
			});
		});
	},
});
