import { describe, expect, it } from 'vitest';
import { shouldPreferSoftware2dContext } from './software2dContext';

describe('shouldPreferSoftware2dContext', () => {
  it('is true for desktop Chrome so the 2D backing store stays off the GPU', () => {
    expect(
      shouldPreferSoftware2dContext(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
      )
    ).toBe(true);
  });

  it('is true for Edge and Opera, which share the Blink canvas GPU path', () => {
    expect(
      shouldPreferSoftware2dContext(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0'
      )
    ).toBe(true);
    expect(
      shouldPreferSoftware2dContext(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/117.0.0.0'
      )
    ).toBe(true);
  });

  it('is false for Safari, which does not drop the accelerated 2D context this way', () => {
    expect(
      shouldPreferSoftware2dContext(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
      )
    ).toBe(false);
  });

  it('is false for iOS Chrome, which is WebKit rather than Blink', () => {
    expect(
      shouldPreferSoftware2dContext(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.0.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(false);
  });
});
