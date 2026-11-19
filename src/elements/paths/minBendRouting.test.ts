import { describe, it, expect } from 'vitest';
import { countBends } from './routeCost';
import { crosses, routeScenario, scenarios } from '@/test/routingScenarios';

describe('min-bend polyline routing', () => {
  for (const [name, sc] of Object.entries(scenarios)) {
    it(`${name}: ${sc.bends} bend(s), no node crossed`, () => {
      const path = routeScenario(sc);
      expect(countBends(path), JSON.stringify(path)).toBe(sc.bends);
      expect(path[0]).toEqual(sc.from);
      expect(path[path.length - 1]).toEqual(sc.to);
      for (const r of [...sc.others]) {
        expect(crosses(path, r), `${name} crosses ${r.id}`).toBe(false);
      }
    });
  }
});
