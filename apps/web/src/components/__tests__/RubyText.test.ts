import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import RubyText from '../RubyText.svelte';

const ruby = [{ start: 0, end: 2, reading: 'きょう' }];

describe('RubyText', () => {
    it('puts readings over the text they belong to', () => {
        const { container } = render(RubyText, {
            props: { text: '今日は晴れ。', ruby },
        });
        const node = container.querySelector('ruby');
        expect(node?.firstChild?.textContent).toBe('今日');
        expect(node?.querySelector('rt')).toHaveTextContent('きょう');
        expect(container).toHaveTextContent(/は晴れ。$/);
    });

    it('shows plain text when furigana is off or missing', () => {
        const off = render(RubyText, {
            props: { text: '今日は晴れ。', ruby, show: false },
        });
        expect(off.container.querySelector('ruby')).toBeNull();
        expect(off.container).toHaveTextContent('今日は晴れ。');

        const none = render(RubyText, { props: { text: 'Plain line.' } });
        expect(none.container.querySelector('ruby')).toBeNull();
        expect(none.container).toHaveTextContent('Plain line.');
    });
});
