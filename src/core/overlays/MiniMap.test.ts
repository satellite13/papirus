import { BaseOverlay } from './BaseOverlay';
import { MiniMap } from './MiniMap';

describe('MiniMap', () => {
  it('uses the shared overlay lifecycle', () => {
    expect(new MiniMap()).toBeInstanceOf(BaseOverlay);
  });
});
