/**
 * Omit properties from an object that have default values
 * @param obj - The object to filter
 * @param defaults - Default values to compare against
 * @returns New object with only non-default values
 */
export function omitDefaultValues<T extends Record<string, unknown>>(
  obj: T,
  defaults: Partial<T>
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(obj) as (keyof T)[]) {
    const objValue = obj[key];
    const defaultValue = defaults[key];

    // Skip if value equals default
    if (objValue === defaultValue) {
      continue;
    }

    // Handle arrays - compare by value
    if (Array.isArray(objValue) && Array.isArray(defaultValue)) {
      if (objValue.length === defaultValue.length) {
        const arraysEqual = objValue.every((val, idx) => val === defaultValue[idx]);
        if (arraysEqual) {
          continue;
        }
      }
    }

    // Handle objects - compare shallow
    if (
      typeof objValue === 'object' &&
      objValue !== null &&
      typeof defaultValue === 'object' &&
      defaultValue !== null
    ) {
      if (!Array.isArray(objValue) && !Array.isArray(defaultValue)) {
        const objKeys = Object.keys(objValue);
        const defaultKeys = Object.keys(defaultValue);
        if (objKeys.length === defaultKeys.length) {
          const objectsEqual = objKeys.every(
            (k) => (objValue as Record<string, unknown>)[k] === (defaultValue as Record<string, unknown>)[k]
          );
          if (objectsEqual) {
            continue;
          }
        }
      }
    }

    result[key] = objValue;
  }

  return result;
}

/**
 * Check if an object has any non-default values
 * @param obj - The object to check
 * @param defaults - Default values to compare against
 * @returns True if object has non-default values
 */
export function hasNonDefaultValues<T extends Record<string, unknown>>(
  obj: T,
  defaults: Partial<T>
): boolean {
  return Object.keys(omitDefaultValues(obj, defaults)).length > 0;
}

/**
 * Omit undefined and null values from an object
 * @param obj - The object to filter
 * @returns New object with only defined values
 */
export function omitEmptyValues<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Omit empty arrays and empty objects from an object
 * @param obj - The object to filter
 * @returns New object with only non-empty values
 */
export function omitEmptyCollections<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      continue;
    }
    result[key] = value;
  }

  return result;
}
