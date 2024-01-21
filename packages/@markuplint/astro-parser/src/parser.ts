import type { Node } from './astro-parser.js';
import type { MLASTParentNode, MLASTNodeTreeItem } from '@markuplint/ml-ast';
import type { ChildToken, Token } from '@markuplint/parser-utils';

import { AttrState, Parser, ParserError } from '@markuplint/parser-utils';

import { astroParse } from './astro-parser.js';

type State = {
	scopeNS: string;
};

class AstroParser extends Parser<Node, State> {
	constructor() {
		super(
			{
				endTagType: 'xml',
				selfCloseType: 'html+xml',
			},
			{
				scopeNS: 'http://www.w3.org/1999/xhtml',
			},
		);
	}

	tokenize() {
		return {
			ast: astroParse(this.rawCode).children,
			isFragment: true,
		};
	}

	nodeize(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		originNode: Node,
		parentNode: MLASTParentNode | null,
		depth: number,
	) {
		if (!originNode.position) {
			throw new TypeError("Node doesn't have position");
		}

		const startOffset = originNode.position.start.offset;
		const endOffset = originNode.position.end?.offset;
		const token = this.sliceFragment(startOffset, endOffset);

		this.#updateScopeNS(originNode, parentNode);

		switch (originNode.type) {
			case 'doctype': {
				return this.visitDoctype({
					...token,
					depth,
					parentNode,
					name: originNode.value,
					publicId: '',
					systemId: '',
				});
			}
			case 'text': {
				if (parentNode?.type === 'psblock') {
					return [];
				}
				return this.visitText({
					...token,
					depth,
					parentNode,
				});
			}
			case 'comment': {
				return this.visitComment({
					...token,
					depth,
					parentNode,
				});
			}
			case 'component':
			case 'custom-element':
			case 'fragment':
			case 'element': {
				const tagToken = token.raw ? token : this.sliceFragment(0);
				return this.visitElement(
					{
						...tagToken,
						depth,
						parentNode,
					},
					originNode.children,
				);
			}
			case 'expression': {
				const firstChild = originNode.children.at(0);
				const lastChild = originNode.children.at(-1);

				let startExpressionRaw = token.raw;
				let startExpressionStartLine = token.startLine;
				let startExpressionStartCol = token.startCol;

				const nodes: MLASTNodeTreeItem[] = [];

				if (firstChild && lastChild && firstChild !== lastChild) {
					const startExpressionEndOffset = firstChild.position?.end?.offset ?? endOffset ?? startOffset;
					const startExpressionLocation = this.sliceFragment(startOffset, startExpressionEndOffset);

					startExpressionRaw = startExpressionLocation.raw;
					startExpressionStartLine = startExpressionLocation.startLine;
					startExpressionStartCol = startExpressionLocation.startCol;

					const closeExpressionLocation = this.sliceFragment(
						lastChild.position?.start.offset ?? startOffset,
						endOffset,
					);

					nodes.push(
						...this.visitPsBlock({
							...closeExpressionLocation,
							depth,
							parentNode,
							nodeName: 'MustacheTag',
						}),
					);
				}

				nodes.push(
					...this.visitPsBlock(
						{
							raw: startExpressionRaw,
							startOffset,
							startLine: startExpressionStartLine,
							startCol: startExpressionStartCol,
							depth,
							parentNode,
							nodeName: 'MustacheTag',
						},
						originNode.children,
					),
				);

				return nodes;
			}
			default: {
				return [];
			}
		}
	}

	afterFlattenNodes(nodeList: readonly MLASTNodeTreeItem[]) {
		return super.afterFlattenNodes(nodeList, {
			exposeInvalidNode: false,
		});
	}

	visitElement(
		token: ChildToken,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		childNodes: readonly Node[],
	): readonly MLASTNodeTreeItem[] {
		const parsedNodes = this.parseCodeFragment(token);

		const startTagNode = parsedNodes.at(0);

		if (!startTagNode || startTagNode.type !== 'starttag') {
			throw new ParserError('Not found start tag', startTagNode ?? token);
		}

		return super.visitElement(startTagNode, childNodes, {
			overwriteProps: {
				namespace: this.state.scopeNS,
			},
			createEndTagToken: () => {
				if (startTagNode.selfClosingSolidus?.raw === '/') {
					return null;
				}

				const endTagNode = parsedNodes.at(-1);

				if (endTagNode?.type !== 'endtag') {
					return null;
				}

				return endTagNode ?? null;
			},
		});
	}

	visitChildren(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		children: readonly Node[],
		parentNode: MLASTParentNode | null,
	): never[] {
		const siblings = super.visitChildren(children, parentNode);
		if (siblings.length > 0) {
			throw new ParserError('Discovered child nodes with differing hierarchy levels', siblings[0]!);
		}
		return [];
	}

	visitAttr(token: Token) {
		const attr = super.visitAttr(token, {
			quoteSet: [
				{ start: '"', end: '"' },
				{ start: "'", end: "'" },
				{ start: '{', end: '}' },
			],
			quoteInValueChars: [
				{ start: '"', end: '"' },
				{ start: "'", end: "'" },
				{ start: '`', end: '`' },
				{ start: '${', end: '}' },
			],
			startState:
				// is shorthand attribute
				token.raw.trim().startsWith('{') ? AttrState.BeforeValue : AttrState.BeforeName,
		});

		if (attr.type === 'spread') {
			return attr;
		}

		const isDynamicValue = attr.startQuote.raw === '{' || undefined;

		let potentialName: string | undefined;
		let isDirective: true | undefined;

		if (isDynamicValue && attr.name.raw === '') {
			potentialName = attr.value.raw;
		}

		/**
		 * Detects Template Directive
		 *
		 * @see https://docs.astro.build/en/reference/directives-reference/
		 */
		const [, directive] = attr.name.raw.match(/^([^:]+):([^:]+)$/) ?? [];
		if (directive) {
			const lowerCaseDirectiveName = directive.toLowerCase();
			switch (lowerCaseDirectiveName) {
				case 'class': {
					potentialName = lowerCaseDirectiveName;
					break;
				}
				default: {
					isDirective = true;
				}
			}
		}

		return {
			...attr,
			isDynamicValue,
			isDirective,
			potentialName,
		};
	}

	#updateScopeNS(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		originNode: Node,
		parentNode: MLASTParentNode | null,
	) {
		const parentNS = this.state.scopeNS;

		if (
			parentNS === 'http://www.w3.org/1999/xhtml' &&
			originNode.type === 'element' &&
			originNode.name?.toLowerCase() === 'svg'
		) {
			this.state.scopeNS = 'http://www.w3.org/2000/svg';
		} else if (parentNS === 'http://www.w3.org/2000/svg' && parentNode && parentNode.nodeName === 'foreignObject') {
			this.state.scopeNS = 'http://www.w3.org/1999/xhtml';
		}
	}
}

export const parser = new AstroParser();
