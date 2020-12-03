"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDomainEvent = exports.DomainEvents = void 0;
const uuid_1 = require("uuid");
class DomainEvents {
    constructor() {
        this.handlerMap = new Map();
        this.actionMap = new Map();
    }
    initiateEvent(event, handler) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return ((yield ((_a = handler.initiate) === null || _a === void 0 ? void 0 : _a.call(handler, event))) || []);
        });
    }
    executeEvent(event, events, handler) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return ((yield ((_a = handler.execute) === null || _a === void 0 ? void 0 : _a.call(handler, event, events))) || []);
        });
    }
    completeEvent(event, events, handler) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return ((yield ((_a = handler.complete) === null || _a === void 0 ? void 0 : _a.call(handler, event, events))) || []);
        });
    }
    registerHandler(action, handler) {
        var _a;
        const handlers = (_a = this.handlerMap.get(action)) !== null && _a !== void 0 ? _a : [];
        const hasNonMiddlewareHandler = handlers.some(s => !s.isMiddleware);
        if (hasNonMiddlewareHandler && !handler.isMiddleware) {
            throw new Error('cannot have more than one non-middleware handler');
        }
        if (!handlers.includes(handler)) {
            handlers.push(handler);
        }
        this.handlerMap.set(action, handlers);
    }
    on(action, callback) {
        const callbacks = this.actionMap.get(action) || [];
        if (callbacks.includes(callback)) {
            return;
        }
        callbacks.push(callback);
        this.actionMap.set(action, callbacks);
    }
    off(action, callback) {
        var _a;
        if (!callback) {
            this.actionMap.delete(action);
            return;
        }
        const callbacks = (_a = this.actionMap.get(action)) !== null && _a !== void 0 ? _a : [];
        if (callbacks.some(s => s === callback)) {
            this.actionMap.set(action, callbacks.filter(f => f !== callback));
        }
    }
    invoke(event, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        return __awaiter(this, void 0, void 0, function* () {
            if (event.completedAt && !(options === null || options === void 0 ? void 0 : options.retryCompleted)) {
                return event;
            }
            let returnEvent = Object.assign(Object.assign({}, event), { parent: (_a = options === null || options === void 0 ? void 0 : options.parent) !== null && _a !== void 0 ? _a : null });
            returnEvent = (yield ((_c = (_b = this.hooks) === null || _b === void 0 ? void 0 : _b.beforeInvoke) === null || _c === void 0 ? void 0 : _c.call(_b, returnEvent))) || returnEvent;
            for (const [action, handlers] of this.handlerMap.entries()) {
                if (action === event.action) {
                    for (const handler of handlers) {
                        let initiateChildEvents = [];
                        let executeChildEvents = [];
                        returnEvent = handler.isMiddleware
                            ? returnEvent
                            : (yield ((_e = (_d = this.hooks) === null || _d === void 0 ? void 0 : _d.beforeInitiate) === null || _e === void 0 ? void 0 : _e.call(_d, returnEvent))) || returnEvent;
                        returnEvent = Object.assign(Object.assign({}, returnEvent), (handler.isMiddleware ? null : { initiatedAt: Date.now() }));
                        try {
                            initiateChildEvents = yield this.initiateEvent(returnEvent, handler);
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_f = returnEvent.errors) !== null && _f !== void 0 ? _f : [], err] });
                        }
                        const initiateChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(initiateChildEvents.map((event) => this.invoke(event, { parent: returnEvent.parent })));
                        if (!handler.isMiddleware) {
                            yield ((_h = (_g = this.hooks) === null || _g === void 0 ? void 0 : _g.afterInitiate) === null || _h === void 0 ? void 0 : _h.call(_g, returnEvent));
                        }
                        if (!returnEvent.errors.length) {
                            returnEvent = handler.isMiddleware
                                ? returnEvent
                                : (yield ((_k = (_j = this.hooks) === null || _j === void 0 ? void 0 : _j.beforeExecute) === null || _k === void 0 ? void 0 : _k.call(_j, returnEvent))) || returnEvent;
                            returnEvent = Object.assign(Object.assign({}, returnEvent), (handler.isMiddleware ? null : { executedAt: Date.now() }));
                            try {
                                executeChildEvents = yield this.executeEvent(returnEvent, initiateChildEventStates, handler);
                            }
                            catch (err) {
                                returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_l = returnEvent.errors) !== null && _l !== void 0 ? _l : [], err] });
                            }
                        }
                        const executeChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(executeChildEvents.map((event) => this.invoke(event, { parent: returnEvent.id })));
                        if (!handler.isMiddleware) {
                            yield ((_o = (_m = this.hooks) === null || _m === void 0 ? void 0 : _m.afterExecute) === null || _o === void 0 ? void 0 : _o.call(_m, returnEvent));
                            returnEvent = (yield ((_q = (_p = this.hooks) === null || _p === void 0 ? void 0 : _p.beforeComplete) === null || _q === void 0 ? void 0 : _q.call(_p, returnEvent))) || returnEvent;
                        }
                        returnEvent = Object.assign(Object.assign({}, returnEvent), (handler.isMiddleware ? null : { completedAt: Date.now() }));
                        try {
                            const completeChildEvents = yield this.completeEvent(returnEvent, executeChildEventStates, handler);
                            yield Promise.all(completeChildEvents.map((event) => this.invoke(event, { parent: returnEvent.id })));
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_r = returnEvent.errors) !== null && _r !== void 0 ? _r : [], err] });
                            if (!returnEvent.parent) {
                                if (!handler.isMiddleware) {
                                    yield ((_t = (_s = this.hooks) === null || _s === void 0 ? void 0 : _s.afterComplete) === null || _t === void 0 ? void 0 : _t.call(_s, returnEvent));
                                }
                                yield ((_v = (_u = this.hooks) === null || _u === void 0 ? void 0 : _u.afterInvoke) === null || _v === void 0 ? void 0 : _v.call(_u, returnEvent));
                                throw err;
                            }
                        }
                        if (!handler.isMiddleware) {
                            yield ((_x = (_w = this.hooks) === null || _w === void 0 ? void 0 : _w.afterComplete) === null || _x === void 0 ? void 0 : _x.call(_w, returnEvent));
                            // call event listeners
                            (_y = this.actionMap
                                .get(event.action)) === null || _y === void 0 ? void 0 : _y.map((callback) => {
                                try {
                                    callback(returnEvent);
                                }
                                finally { }
                            });
                        }
                    }
                }
            }
            yield ((_0 = (_z = this.hooks) === null || _z === void 0 ? void 0 : _z.afterInvoke) === null || _0 === void 0 ? void 0 : _0.call(_z, returnEvent));
            return returnEvent;
        });
    }
    setupHooks(hooks) {
        this.hooks = hooks;
    }
}
exports.DomainEvents = DomainEvents;
;
exports.createDomainEvent = ({ action, params, metadata, }) => ({
    id: uuid_1.v4(),
    parent: null,
    createdAt: Date.now(),
    initiatedAt: null,
    executedAt: null,
    completedAt: null,
    action,
    params,
    state: {},
    errors: [],
    metadata: metadata !== null && metadata !== void 0 ? metadata : {},
});
