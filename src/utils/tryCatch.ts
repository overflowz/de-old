const tryCatch = <T>(fn: () => T): T | Error => {
  try {
    const res: any = fn();

    return typeof res?.then === 'function'
      ? res.catch((err: any) => err instanceof Error ? err : new Error(err))
      : res;
  } catch (err: any) {
    return err instanceof Error
      ? err
      : new Error(err);
  }
};

export default tryCatch;
