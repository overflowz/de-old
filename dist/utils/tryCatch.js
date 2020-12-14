"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tryCatch = (fn) => {
    try {
        const res = fn();
        return typeof (res === null || res === void 0 ? void 0 : res.then) === 'function'
            ? res.catch((err) => err instanceof Error ? err : new Error(err))
            : res;
    }
    catch (err) {
        return err instanceof Error
            ? err
            : new Error(err);
    }
};
exports.default = tryCatch;
