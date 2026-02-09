export function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    const aValue = (a as Record<string, unknown>)[key];
    const bValue = (b as Record<string, unknown>)[key];

    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      if (aValue.length !== bValue.length) {
        return false;
      }
      for (let i = 0; i < aValue.length; i++) {
        if (aValue[i] !== bValue[i]) {
          return false;
        }
      }
      continue;
    }

    if (aValue !== bValue) {
      return false;
    }
  }

  return true;
}
