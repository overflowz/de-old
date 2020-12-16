const lazyPromiseEach = <T extends readonly (() => unknown)[] | readonly [() => unknown]>(
  values: T,
): Promise<{ -readonly [K in keyof T]: T[K] extends () => infer T ? T extends Promise<infer T> ? T : T : never }> => {
  return values.reduce<any>(
    (acc, x) => acc.then((res: any[]) => Promise.all([...res, x()])),
    Promise.resolve([]),
  );
};

export default lazyPromiseEach;
