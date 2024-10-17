export function hideSensitiveData<T extends Record<string, any>>(
  obj: T,
  keys: Array<keyof T>
): Omit<T, keyof T> {
  const newObj = { ...obj };
  keys.forEach((key) => delete newObj[key]);
  return newObj as Omit<T, keyof T>;
}
