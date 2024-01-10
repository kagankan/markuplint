import type { SvelteDirective, SvelteNode } from './svelte-parser/index.js';
import type {
	MLASTAttr,
	MLASTElementCloseTag,
	MLASTNode,
	MLASTParentNode,
	MLASTPreprocessorSpecificBlock,
	MLASTTag,
	MLASTText,
	ParserOptions,
} from '@markuplint/ml-ast';

import { getNamespace } from '@markuplint/html-parser';
import { detectElementType, sliceFragment, uuid, tagParser } from '@markuplint/parser-utils';

import { attr } from './attr.js';
import { directiveTokenizer } from './directive-tokenizer.js';
import { parseCtrlBlock } from './parse-ctrl-block.js';
import { traverse } from './traverse.js';

export function nodeize(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	originNode: SvelteNode,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	prevNode: MLASTNode | null,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	parentNode: MLASTParentNode | null,
	rawHtml: string,
	options?: ParserOptions,
): MLASTNode | MLASTNode[] | null {
	const nextNode = null;
	const { startOffset, endOffset, startLine, endLine, startCol, endCol, raw } = sliceFragment(
		rawHtml,
		originNode.start,
		originNode.end,
	);
	const parentNamespace =
		parentNode && 'namespace' in parentNode ? parentNode.namespace : 'http://www.w3.org/1999/xhtml';

	switch (originNode.type) {
		case 'Text': {
			const node: MLASTText = {
				uuid: uuid(),
				raw,
				startOffset,
				endOffset,
				startLine,
				endLine,
				startCol,
				endCol,
				nodeName: '#text',
				type: 'text',
				parentNode,
				prevNode,
				nextNode,
				isFragment: false,
				isGhost: false,
			};
			return node;
		}
		case 'MustacheTag': {
			return {
				uuid: uuid(),
				raw,
				startOffset,
				endOffset,
				startLine,
				endLine,
				startCol,
				endCol,
				nodeName: '#ps:MustacheTag',
				type: 'psblock',
				parentNode,
				prevNode,
				nextNode,
				isFragment: false,
				isGhost: false,
			};
		}
		case 'InlineComponent':
		case 'Element': {
			const children = originNode.children ?? [];
			const reEndTag = new RegExp(`</${originNode.name}\\s*>$`, 'i');
			const startTagEndOffset =
				children.length > 0 ? children[0]?.start ?? 0 : raw.replace(reEndTag, '').length + startOffset;
			const startTagLocation = sliceFragment(rawHtml, startOffset, startTagEndOffset);

			let endTag: MLASTElementCloseTag | null = null;
			if (reEndTag.test(raw)) {
				const endTagRawMatched = raw.match(reEndTag);
				if (!endTagRawMatched) {
					throw new Error('Parse error');
				}
				const endTagRaw = endTagRawMatched[0];
				const endTagStartOffset = startOffset + raw.lastIndexOf(endTagRaw);
				const endTagEndOffset = endTagStartOffset + endTagRaw.length;
				const endTagLocation = sliceFragment(rawHtml, endTagStartOffset, endTagEndOffset);
				const namespace = getNamespace(originNode.name, parentNamespace);
				endTag = {
					uuid: uuid(),
					raw: endTagRaw,
					startOffset: endTagStartOffset,
					endOffset: endTagEndOffset,
					startLine: endTagLocation.startLine,
					endLine: endTagLocation.endLine,
					startCol: endTagLocation.startCol,
					endCol: endTagLocation.endCol,
					nodeName: originNode.name,
					type: 'endtag',
					namespace,
					attributes: [],
					parentNode,
					prevNode,
					nextNode,
					pearNode: null,
					isFragment: false,
					isGhost: false,
					tagOpenChar: '</',
					tagCloseChar: '>',
				};
			}

			const directives = (originNode.attributes as SvelteDirective[]).map(a => attr(a, rawHtml)) ?? [];
			const attributes = directives.filter((d): d is MLASTAttr => !('__spreadAttr' in d));
			const hasSpreadAttr = directives.some(d => '__spreadAttr' in d);

			const tagTokens = tagParser(
				startTagLocation.raw,
				startTagLocation.startLine,
				startTagLocation.startCol,
				startTagLocation.startOffset,
				undefined,
				undefined,
				undefined,
				undefined,
				directiveTokenizer,
			);

			const namespace = getNamespace(originNode.name, parentNamespace);

			const startTag: MLASTTag = {
				uuid: uuid(),
				...startTagLocation,
				nodeName: originNode.name,
				type: 'starttag',
				namespace,
				elementType: detectElementType(originNode.name, options?.authoredElementName, /[.A-Z]/),
				attributes,
				hasSpreadAttr,
				parentNode,
				prevNode,
				nextNode,
				pearNode: endTag,
				selfClosingSolidus: tagTokens.selfClosingSolidus,
				endSpace: tagTokens.afterAttrSpaces,
				isFragment: false,
				isGhost: false,
				tagOpenChar: '<',
				tagCloseChar: '>',
			};
			if (endTag) {
				endTag.pearNode = startTag;
			}

			if (originNode.children) {
				startTag.childNodes = traverse(originNode.children, startTag, rawHtml, options);
			}

			return startTag;
		}
		case 'IfBlock': {
			const ifBlocks = parseCtrlBlock(
				'if',
				originNode,
				raw,
				rawHtml,
				startOffset,
				parentNode,
				prevNode,
				nextNode,
				options,
			);
			return ifBlocks;
		}
		case 'EachBlock': {
			return parseCtrlBlock(
				'each',
				originNode,
				raw,
				rawHtml,
				startOffset,
				parentNode,
				prevNode,
				nextNode,
				options,
			);
		}
		case 'AwaitBlock': {
			const pendingNode = originNode.pending;
			const pendingTag = sliceFragment(rawHtml, originNode.start, pendingNode.start);
			const pending: MLASTPreprocessorSpecificBlock = {
				uuid: uuid(),
				...pendingTag,
				nodeName: pendingNode.type,
				type: 'psblock',
				parentNode,
				prevNode,
				nextNode,
				isFragment: false,
				isGhost: false,
			};
			if (pendingNode.children) {
				pending.childNodes = traverse(pendingNode.children, pending, rawHtml, options);
			}

			let then: MLASTPreprocessorSpecificBlock | null = null;
			if (originNode.then) {
				const thenNode = originNode.then;
				const thenTag = sliceFragment(
					rawHtml,
					thenNode.start,
					(thenNode.children && thenNode.children[0] && thenNode.children[0].start) ?? thenNode.end,
				);
				then = {
					uuid: uuid(),
					...thenTag,
					nodeName: thenNode.type,
					type: 'psblock',
					parentNode,
					prevNode,
					nextNode,
					isFragment: false,
					isGhost: false,
				};
				if (thenNode.children) {
					then.childNodes = traverse(thenNode.children, then, rawHtml, options);
				}
			}

			let awaitCatch: MLASTPreprocessorSpecificBlock | null = null;
			if (originNode.catch) {
				const awaitCatchNode = originNode.catch;
				const awaitCatchTag = sliceFragment(
					rawHtml,
					awaitCatchNode.start,
					(awaitCatchNode.children && awaitCatchNode.children[0] && awaitCatchNode.children[0].start) ??
						awaitCatchNode.end,
				);
				awaitCatch = {
					uuid: uuid(),
					...awaitCatchTag,
					nodeName: awaitCatchNode.type,
					type: 'psblock',
					parentNode,
					prevNode,
					nextNode,
					isFragment: false,
					isGhost: false,
				};
				if (awaitCatchNode.children) {
					awaitCatch.childNodes = traverse(awaitCatchNode.children, awaitCatch, rawHtml, options);
				}
			}

			// eslint-disable-next-line regexp/strict
			const reEndTag = /{\s*\/await\s*}$/i;
			let endTag: MLASTPreprocessorSpecificBlock | null = null;
			if (reEndTag.test(raw)) {
				const endTagRawMatched = raw.match(reEndTag);
				if (!endTagRawMatched) {
					throw new Error('Parse error');
				}
				const endTagRaw = endTagRawMatched[0];
				const endTagStartOffset = startOffset + raw.indexOf(endTagRaw);
				const endTagEndOffset = endTagStartOffset + endTagRaw.length;
				const endTagLocation = sliceFragment(rawHtml, endTagStartOffset, endTagEndOffset);
				endTag = {
					uuid: uuid(),
					raw: endTagRaw,
					startOffset: endTagStartOffset,
					endOffset: endTagEndOffset,
					startLine: endTagLocation.startLine,
					endLine: endTagLocation.endLine,
					startCol: endTagLocation.startCol,
					endCol: endTagLocation.endCol,
					nodeName: originNode.type,
					type: 'psblock',
					parentNode,
					prevNode,
					nextNode,
					isFragment: false,
					isGhost: false,
				};
			}

			const tags: MLASTPreprocessorSpecificBlock[] = [pending];

			if (then) {
				tags.push(then);
			}
			if (awaitCatch) {
				tags.push(awaitCatch);
			}
			if (endTag) {
				tags.push(endTag);
			}

			return tags;
		}
		default: {
			const startTag: MLASTPreprocessorSpecificBlock = {
				uuid: uuid(),
				raw,
				startOffset,
				endOffset,
				startLine,
				endLine,
				startCol,
				endCol,
				nodeName: originNode.name || originNode.type,
				type: 'psblock',
				parentNode,
				prevNode,
				nextNode,
				isFragment: false,
				isGhost: false,
			};
			let endTag: MLASTPreprocessorSpecificBlock | null = null;
			if (originNode.children) {
				startTag.childNodes = traverse(originNode.children, startTag, rawHtml, options);
				const firstChild = startTag.childNodes[0];
				if (firstChild) {
					startTag.endOffset = firstChild.startOffset;
					startTag.endLine = firstChild.startLine;
					startTag.endCol = firstChild.startCol;
					startTag.raw = rawHtml.slice(startTag.startOffset, startTag.endOffset);
				}
				const lastChild = startTag.childNodes.at(-1);
				if (lastChild && lastChild.endOffset > startTag.endOffset) {
					const startOffset = lastChild.endOffset;
					const startLine = lastChild.endLine;
					const startCol = lastChild.endCol;
					const raw = rawHtml.slice(startOffset, endOffset);
					endTag = {
						uuid: uuid(),
						raw,
						startOffset,
						endOffset,
						startLine,
						endLine,
						startCol,
						endCol,
						nodeName: originNode.name || originNode.type,
						type: 'psblock',
						parentNode,
						prevNode,
						nextNode,
						isFragment: false,
						isGhost: false,
					};
				}
			}
			return endTag == null ? startTag : [startTag, endTag];
		}
	}
}
