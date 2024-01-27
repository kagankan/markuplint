import type { MLBlock } from './block.js';
import type { MLChildNode } from './child-node.js';
import type { MLDocumentFragment } from './document-fragment.js';
import type { MLDocument } from './document.js';
import type { MLElement } from './element.js';
import type { MarkuplintPreprocessorBlockType, NodeType, NodeTypeOf } from './types.js';
import type { RuleInfo } from '../../index.js';
import type {
	MLASTChildNode,
	MLASTElementCloseTag,
	MLASTInvalid,
	MLASTNode,
	MLASTParentNode,
} from '@markuplint/ml-ast';
import type { AnyRule, PlainData, Rule, RuleConfigValue } from '@markuplint/ml-config';

import { MLToken } from '../token/token.js';

import { isChildNode } from './child-node.js';
import { toNodeList } from './node-list.js';
import { nodeStore } from './node-store.js';
import { UnexpectedCallError } from './unexpected-call-error.js';

export abstract class MLNode<
		T extends RuleConfigValue,
		O extends PlainData = undefined,
		A extends MLASTNode = MLASTNode,
	>
	extends MLToken<A>
	implements Node
{
	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly ATTRIBUTE_NODE = 2;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly CDATA_SECTION_NODE = 4;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly COMMENT_NODE = 8;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly DOCUMENT_FRAGMENT_NODE = 11;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly DOCUMENT_NODE = 9;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_contained_by
	 */
	readonly DOCUMENT_POSITION_CONTAINED_BY = 0b1_0000;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_contains
	 */
	readonly DOCUMENT_POSITION_CONTAINS = 0b1000;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_disconnected
	 */
	readonly DOCUMENT_POSITION_DISCONNECTED = 0b1;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_following
	 */
	readonly DOCUMENT_POSITION_FOLLOWING = 0b100;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_implementation_specific
	 */
	readonly DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 0b10_0000;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-document_position_preceding
	 */
	readonly DOCUMENT_POSITION_PRECEDING = 0b10;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly DOCUMENT_TYPE_NODE = 10;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly ELEMENT_NODE = 1;

	/**
	 * @deprecated
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly ENTITY_NODE = 6;

	/**
	 * @deprecated
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly ENTITY_REFERENCE_NODE = 5;

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	readonly MARKUPLINT_PREPROCESSOR_BLOCK: MarkuplintPreprocessorBlockType = 101;

	/**
	 * @deprecated
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly NOTATION_NODE = 12;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly PROCESSING_INSTRUCTION_NODE = 7;

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#interface-node
	 */
	readonly TEXT_NODE = 3;

	/**
	 * Cached `childNodes` property
	 */
	#childNodes: NodeListOf<MLChildNode<T, O>> | undefined;

	/**
	 * Owner `Document`
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-ownerdocument
	 */
	readonly #ownerDocument: MLDocument<T, O>;

	/**
	 * Cached `prevToken` property
	 */
	#prevToken: MLNode<T, O> | null | undefined;

	/**
	 *
	 */
	readonly rules: Record<string, AnyRule> = {};

	protected _astToken: A;

	constructor(
		astNode: A,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		document: MLDocument<T, O>,
	) {
		super(astNode);
		this._astToken = astNode;
		this.#ownerDocument = document;
		nodeStore.setNode(astNode, this);
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-baseuri%E2%91%A0
	 */
	get baseURI(): string {
		throw new UnexpectedCallError('Not supported "baseURI" property');
	}

	/**
	 * The list of child nodes that contains `Element`, `Text`, and `Comment`.
	 *
	 * @readonly
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-childnodes%E2%91%A0
	 */
	get childNodes(): NodeListOf<MLChildNode<T, O>> {
		if (this.#childNodes != null) {
			return this.#childNodes;
		}
		if (this.is(this.DOCUMENT_NODE)) {
			const childNodes: MLChildNode<T, O>[] = [];
			for (const node of this.nodeList) {
				if (isChildNode(node) && (node.parentNode === this || node.parentNode === null)) {
					childNodes.push(node);
				}
			}

			// Cache
			this.#childNodes = toNodeList(childNodes);
			return this.#childNodes;
		}
		if (
			this.is(this.DOCUMENT_FRAGMENT_NODE) ||
			this.is(this.ELEMENT_NODE) ||
			this.is(this.MARKUPLINT_PREPROCESSOR_BLOCK)
		) {
			const astChildren: Exclude<MLASTChildNode, MLASTElementCloseTag | MLASTInvalid>[] =
				// @ts-ignore
				this._astToken?.childNodes?.filter(node => {
					if (node.type === 'endtag' || node.type === 'invalid') {
						return null;
					}
					return node;
				}) ?? [];
			const childNodes = astChildren
				.map(node => nodeStore.getNode<typeof node, T, O>(node))
				.filter(node => isChildNode(node));

			// Cache
			this.#childNodes = toNodeList(childNodes);
			return this.#childNodes;
		}
		// Cache
		this.#childNodes = toNodeList([]);
		return this.#childNodes;
	}

	/**
	 * The first node that may be `Element`, `Text`, and `CommentNode`.
	 *
	 * @readonly
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-firstchild%E2%91%A0
	 */
	get firstChild(): MLChildNode<T, O> | null {
		return this.childNodes[0] ?? null;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-isconnected%E2%91%A0
	 */
	get isConnected(): boolean {
		throw new UnexpectedCallError('Not supported "isConnected" property');
	}

	/**
	 * The last node that may be `Element`, `Text`, and `CommentNode`.
	 *
	 * @readonly
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-lastchild%E2%91%A0
	 */
	get lastChild(): MLChildNode<T, O> | null {
		// eslint-disable-next-line unicorn/prefer-at
		return this.childNodes[this.childNodes.length - 1] ?? null;
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	get nextNode(): MLNode<T, O> | null {
		const siblings = [...(this.syntacticalParentNode?.childNodes ?? this.#ownerDocument.nodeList)];
		const index = siblings.findIndex(node => node.uuid === this.uuid);
		return siblings[index + 1] ?? null;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-nextsibling%E2%91%A0
	 */
	get nextSibling(): ChildNode | null {
		throw new UnexpectedCallError('Not supported "nextSibling" property');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * It must not call from the instance of the `MLNode` class.
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-nodename%E2%91%A0
	 */
	get nodeName(): string {
		throw new Error('It must not call from the instance of the `MLNode` class');
	}

	/**
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-nodetype%E2%91%A0
	 */
	get nodeType(): NodeType | -1 {
		return -1;
	}

	/**
	 * The nodeValue getter steps are to return the following, switching on the interface this implements:
	 *
	 * - `Attr`: this’s value.
	 * - `CharacterData`: this’s data.
	 * - _Otherwise_: Null.
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-nodevalue
	 */
	get nodeValue(): string | null {
		return null;
	}

	/**
	 * The `Document` that this node belongs to.
	 *
	 * @deprecated
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-ownerdocument%E2%91%A0
	 */
	get ownerDocument(): any {
		return this.#ownerDocument;
	}

	get ownerMLDocument(): MLDocument<T, O> {
		return this.#ownerDocument;
	}

	/**
	 * The parent element.
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-parentelement%E2%91%A0
	 */
	get parentElement(): MLElement<T, O> | null {
		let parent = this.parentNode;
		while (parent) {
			if (parent.is(parent.ELEMENT_NODE)) {
				return parent;
			}
			parent = parent.parentNode;
		}
		return null;
	}

	/**
	 * The parent node that may be `Element`, `Document`, `DocumentFragment`, and `null`.
	 *
	 * ## HTML:
	 *
	 * ```html
	 * <html> // => #document
	 *   <body></body> // => <html>
	 * </html>
	 * ```
	 *
	 * ---
	 *
	 * ```html
	 * <div> // => null
	 *   <span></span> // => <div>
	 * </div>
	 * ```
	 *
	 * ## JSX:
	 *
	 * ```jsx
	 * <> // => null
	 *   <div> // => #document-fragment
	 *     {items.map(item => {
	 *       return (
	 *         <span /> // => null
	 *       )
	 *     })}
	 *   </div>
	 * </>
	 * ```
	 *
	 * ## Pug
	 *
	 * ```jade
	 * //- null
	 * div
	 *   //- <div>
	 *   if foo
	 *     //- null
	 *     span
	 * ```
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-parentnode%E2%91%A0
	 */
	get parentNode(): MLDocument<any, any> | MLDocumentFragment<any, any> | MLElement<T, O> | null {
		const parentNode = this.syntacticalParentNode;
		if (!parentNode) {
			return null;
		}
		if (parentNode.is(parentNode.MARKUPLINT_PREPROCESSOR_BLOCK)) {
			if (parentNode.isTransparent) {
				return parentNode.parentNode;
			}
			return null;
		}
		if (parentNode.is(parentNode.ELEMENT_NODE) || parentNode.is(parentNode.DOCUMENT_FRAGMENT_NODE)) {
			return parentNode;
		}
		if (parentNode.is(parentNode.DOCUMENT_NODE) && parentNode.isFragment) {
			return null;
		}
		return parentNode;
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	get prevNode(): MLNode<T, O> | null {
		const siblings = [...(this.syntacticalParentNode?.childNodes ?? this.#ownerDocument.nodeList)];
		const index = siblings.findIndex(node => node.uuid === this.uuid);
		return siblings[index - 1] ?? null;
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	get prevToken(): MLNode<T, O> | null {
		if (this.#prevToken !== undefined) {
			return this.#prevToken;
		}

		let index = -1;
		for (let i = 0; i < this.ownerMLDocument.nodeList.length; i++) {
			const node = this.ownerMLDocument.nodeList[i];
			if (!node) {
				continue;
			}

			if (node.is(this.ELEMENT_NODE) && node.isOmitted) {
				continue;
			}

			if (node.uuid === this.uuid) {
				index = i;
				break;
			}
		}
		if (index === -1) {
			this.#prevToken = null;
			return this.#prevToken;
		}
		this.#prevToken = this.ownerMLDocument.nodeList[index - 1] ?? null;
		return this.#prevToken ?? null;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-previoussibling%E2%91%A0
	 */
	get previousSibling(): ChildNode | null {
		throw new UnexpectedCallError('Not supported "previousSibling" property');
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	get rule(): RuleInfo<T, O> {
		if (!this.ownerMLDocument.currentRule) {
			throw new Error('Invalid call: Some rule evaluations may not be running asynchronously.');
		}
		const name = this.ownerMLDocument.currentRule.name;
		const settingRule = this.rules[name];

		const rule = this.ownerMLDocument.currentRule.optimizeOption(settingRule as Rule<T, O>);

		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
		if (!rule) {
			throw new Error(
				`Rule data "${name}" doesn't exist in rules ([${Object.keys(this.rules).map(
					name => `"${name}"`,
				)}]) of ${this.nodeName}("${this.raw}")`,
			);
		}

		return rule;
	}

	/**
	 * Returns a syntactical parent node
	 *
	 * ## HTML:
	 *
	 * ```html
	 * <html> // => #document
	 *   <body></body> // => <html>
	 * </html>
	 * ```
	 *
	 * ## JSX:
	 *
	 * ```jsx
	 * <> // => #document
	 *   <div> // => #document-fragment
	 *     {items.map(item => {
	 *       return (
	 *         <span /> // => #ml-block
	 *       )
	 *     })}
	 *   </div>
	 * </>
	 * ```
	 *
	 * ## Pug
	 *
	 * ```jade
	 * //- #document
	 * div
	 *   //- <div>
	 *   if foo
	 *     //- #ml-block
	 *     span
	 * ```
	 *
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	get syntacticalParentNode():
		| MLDocument<any, any>
		| MLDocumentFragment<any, any>
		| MLElement<T, O>
		| MLBlock<T, O>
		| null {
		if (this._astToken.type === 'attr' || this._astToken.type === 'spread') {
			return null;
		}
		if (!this._astToken.parentNode) {
			return this.ownerMLDocument;
		}
		return nodeStore.getNode<MLASTParentNode, T, O>(this._astToken.parentNode);
	}

	/**
	 * Return the text content.
	 *
	 * - If the node is a `Comment`, or `Text`, textContent returns, or sets, the text inside the node, i.e., the Node.nodeValue.
	 * - For other node types, textContent returns the concatenation of the textContent of every child node, excluding comments and processing instructions. (This is an empty string if the node has no children.)
	 *
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-textcontent
	 */
	get textContent(): string | null {
		return null;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `EventTarget`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-eventtarget-addeventlistener%E2%91%A2
	 */
	addEventListener(
		type: string,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		callback?: EventListenerOrEventListenerObject | null,
		options: AddEventListenerOptions | boolean = {},
	): void {
		throw new UnexpectedCallError('Not supported "addEventListener" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-appendchild
	 */
	appendChild<T extends Node>(node: T): T {
		throw new UnexpectedCallError('Not supported "appendChild" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-clonenode%E2%91%A0
	 */
	cloneNode(deep?: boolean): Node {
		throw new UnexpectedCallError('Not supported "appendChild" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-comparedocumentposition%E2%91%A0
	 */
	compareDocumentPosition(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		other: Node,
	): number {
		throw new UnexpectedCallError('Not supported "compareDocumentPosition" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-contains%E2%91%A0
	 */
	contains(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		other: Node | null,
	): boolean {
		throw new UnexpectedCallError('Not supported "contains" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `EventTarget`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-eventtarget-dispatchevent%E2%91%A2
	 */
	dispatchEvent(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		event: Event,
	): boolean {
		throw new UnexpectedCallError('Not supported "dispatchEvent" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-getrootnode%E2%91%A0
	 */
	getRootNode(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		options?: GetRootNodeOptions,
	): MLNode<T, O> {
		if (options) {
			throw new UnexpectedCallError('Not supported options');
		}
		// The original DOM API returns a document fragment if the element is a fragment.
		return this.#ownerDocument;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-haschildnodes%E2%91%A0
	 */
	hasChildNodes(): boolean {
		throw new UnexpectedCallError('Not supported "hasChildNodes" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-insertbefore
	 */
	insertBefore<T extends Node>(
		node: T,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		child: Node | null,
	): T {
		throw new UnexpectedCallError('Not supported "insertBefore" method');
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	is<NType extends NodeType>(nodeType: NType): this is NodeTypeOf<NType, T, O> {
		return this.nodeType === nodeType;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-isdefaultnamespace
	 */
	isDefaultNamespace(namespace: string | null): boolean {
		throw new UnexpectedCallError('Not supported "isDefaultNamespace" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-isequalnode%E2%91%A0
	 */
	isEqualNode(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		otherNode: Node | null,
	): boolean {
		throw new UnexpectedCallError('Not supported "isEqualNode" method');
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	isInFragmentDocument(): boolean {
		return this.ownerMLDocument.isFragment;
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-issamenode
	 */
	isSameNode(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		otherNode: Node | null,
	): boolean {
		throw new UnexpectedCallError('Not supported "isSameNode" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-lookupnamespaceuri
	 */
	lookupNamespaceURI(prefix: string | null): string | null {
		throw new UnexpectedCallError('Not supported "lookupNamespaceURI" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-lookupprefix
	 */
	lookupPrefix(namespace: string | null): string | null {
		throw new UnexpectedCallError('Not supported "lookupPrefix" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-node-normalize%E2%91%A0
	 */
	normalize(): void {
		throw new UnexpectedCallError('Not supported "normalize" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-removechild
	 */
	removeChild<T extends Node>(child: T): T {
		throw new UnexpectedCallError('Not supported "removeChild" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `EventTarget`
	 * @see https://dom.spec.whatwg.org/#ref-for-dom-eventtarget-removeeventlistener%E2%91%A1
	 */
	removeEventListener(
		type: string,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		callback?: EventListenerOrEventListenerObject | null,
		options: EventListenerOptions | boolean = {},
	): void {
		throw new UnexpectedCallError('Not supported "removeEventListener" method');
	}

	/**
	 * **IT THROWS AN ERROR WHEN CALLING THIS.**
	 *
	 * @unsupported
	 * @implements DOM API: `Node`
	 * @see https://dom.spec.whatwg.org/#dom-node-replacechild
	 */
	replaceChild<T extends Node>(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		node: Node,
		child: T,
	): T {
		throw new UnexpectedCallError('Not supported "removeChild" method');
	}

	/**
	 * @implements `@markuplint/ml-core` API: `MLNode`
	 */
	resetChildren(
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
		childNodes?: NodeListOf<MLChildNode<T, O>>,
	) {
		this.#childNodes = childNodes ?? this.#childNodes;
	}
}
