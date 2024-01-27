import type { QuoteSet } from './types.js';

import { defaultSpaces } from './const.js';
import { AttrState } from './enums.js';

const defaultQuoteSet: ReadonlyArray<QuoteSet> = [
	{ start: '"', end: '"' },
	{ start: "'", end: "'" },
];

const defaultQuoteInValueChars = [] as const;

const spaces = defaultSpaces as ReadonlyArray<string>;

const EQUAL = '=';

/**
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tag-name-state
 * @see https://html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state
 * @see https://html.spec.whatwg.org/multipage/parsing.html#attribute-name-state
 */
export function attrTokenizer(
	raw: string,
	quoteSet = defaultQuoteSet,
	startState = AttrState.BeforeName,
	quoteInValueChars: ReadonlyArray<QuoteSet> = defaultQuoteInValueChars,
	endOfUnquotedValueChars: ReadonlyArray<string> = [...defaultSpaces, '/', '>'],
) {
	let state: AttrState = startState;
	let spacesBeforeAttrName = '';
	let attrName = '';
	let spacesBeforeEqual = '';
	let equal = '';
	let spacesAfterEqual = '';
	let quoteTypeIndex = -1;
	let quoteStart = '';
	let attrValue = '';
	let quoteEnd = '';

	const isBeforeValueStarted = startState === AttrState.BeforeValue;

	const quoteModeStack: QuoteSet[] = [];

	const chars = [...raw];

	while (chars.length > 0) {
		if (state === AttrState.AfterValue) {
			break;
		}

		const char = chars.shift()!;

		switch (state) {
			case AttrState.BeforeName: {
				if (char === '>') {
					chars.unshift(char);
					state = AttrState.AfterValue;
					break;
				}

				if (char === '/') {
					chars.unshift(char);
					state = AttrState.AfterValue;
					break;
				}

				if (spaces.includes(char)) {
					spacesBeforeAttrName += char;
					break;
				}
				attrName += char;
				state = AttrState.Name;
				break;
			}
			case AttrState.Name: {
				if (char === '>') {
					chars.unshift(char);
					state = AttrState.AfterValue;
					break;
				}
				if (char === '/') {
					chars.unshift(char);
					state = AttrState.AfterValue;
					break;
				}
				if (spaces.includes(char)) {
					spacesBeforeEqual += char;
					state = AttrState.Equal;
					break;
				}
				if (char === EQUAL) {
					equal += char;
					state = AttrState.BeforeValue;
					break;
				}
				attrName += char;
				break;
			}
			case AttrState.Equal: {
				if (spaces.includes(char)) {
					spacesBeforeEqual += char;
					break;
				}
				if (char === EQUAL) {
					equal += char;
					state = AttrState.BeforeValue;
					break;
				}

				// End of attribute
				chars.unshift(spacesBeforeEqual, char);
				spacesBeforeEqual = '';

				state = AttrState.AfterValue;
				break;
			}
			case AttrState.BeforeValue: {
				if (endOfUnquotedValueChars.includes(char) && spaces.includes(char)) {
					if (isBeforeValueStarted) {
						spacesBeforeAttrName += char;
						break;
					}
					spacesAfterEqual += char;
					break;
				}

				quoteTypeIndex = quoteSet.findIndex(quote => quote.start === char);
				const quote = quoteSet[quoteTypeIndex];
				if (quote) {
					quoteStart = quote.start;
					state = AttrState.Value;
					break;
				}

				const raw = char + chars.join('');
				const inQuote = quoteInValueChars.find(quote => raw.startsWith(quote.start));
				if (inQuote) {
					quoteModeStack.push(inQuote);
					attrValue += inQuote.start;
					chars.splice(0, inQuote.start.length - 1);
					state = AttrState.Value;
					break;
				}

				chars.unshift(char);
				state = AttrState.Value;
				break;
			}
			case AttrState.Value: {
				if (!quoteSet[quoteTypeIndex] && endOfUnquotedValueChars.includes(char)) {
					chars.unshift(char);
					state = AttrState.AfterValue;
					break;
				}

				if (quoteModeStack.length === 0 && char === quoteSet[quoteTypeIndex]?.end) {
					quoteEnd = char;
					state = AttrState.AfterValue;
					break;
				}

				const raw = char + chars.join('');

				const inQuoteEnd = quoteModeStack.at(-1);
				if (inQuoteEnd && raw.startsWith(inQuoteEnd.end)) {
					quoteModeStack.pop();
					attrValue += inQuoteEnd.end;
					chars.splice(0, inQuoteEnd.end.length - 1);
					break;
				}

				const inQuoteStart = quoteInValueChars.find(quote => raw.startsWith(quote.start));
				if (inQuoteStart) {
					quoteModeStack.push(inQuoteStart);
					attrValue += inQuoteStart.start;
					chars.splice(0, inQuoteStart.start.length - 1);
					break;
				}

				attrValue += char;
				break;
			}
		}
	}

	if (state === AttrState.Value && quoteTypeIndex !== -1) {
		throw new SyntaxError(`Unclosed attribute value: ${raw}`);
	}

	const leftover = chars.join('');

	return {
		spacesBeforeAttrName,
		attrName,
		spacesBeforeEqual,
		equal,
		spacesAfterEqual,
		quoteStart,
		attrValue,
		quoteEnd,
		leftover,
	};
}
