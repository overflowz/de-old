"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const uuid = __importStar(require("uuid"));
class DomainEvents {
    constructor(hooks) {
        this.hooks = hooks;
        this.eventMap = new Map();
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
            if (typeof handler.complete === 'function') {
                return (_a = handler.complete(event, events)) !== null && _a !== void 0 ? _a : event.state;
            }
            return event.state;
        });
    }
    on(eventType, handler) {
        var _a;
        const handlers = (_a = this.eventMap.get(eventType)) !== null && _a !== void 0 ? _a : [];
        if (!handlers.includes(handler)) {
            handlers.push(handler);
        }
        this.eventMap.set(eventType, handlers);
    }
    off(eventType, handler) {
        var _a;
        const handlers = (_a = this.eventMap.get(eventType)) !== null && _a !== void 0 ? _a : [];
        if (handlers.includes(handler)) {
            this.eventMap.set(eventType, handlers.filter(f => f !== handler));
        }
    }
    invoke(event, parent) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        return __awaiter(this, void 0, void 0, function* () {
            let returnEvent = Object.assign(Object.assign({}, event), { parent: parent !== null && parent !== void 0 ? parent : null });
            returnEvent = (yield ((_b = (_a = this.hooks) === null || _a === void 0 ? void 0 : _a.beforeInvoke) === null || _b === void 0 ? void 0 : _b.call(_a, returnEvent))) || returnEvent;
            for (const [eventType, handlers] of this.eventMap.entries()) {
                if (eventType === event.type) {
                    for (const handler of handlers) {
                        let initiateChildEvents = [];
                        let executeChildEvents = [];
                        returnEvent = (yield ((_d = (_c = this.hooks) === null || _c === void 0 ? void 0 : _c.beforeInitiate) === null || _d === void 0 ? void 0 : _d.call(_c, returnEvent))) || returnEvent;
                        returnEvent = Object.assign(Object.assign({}, returnEvent), { initiatedAt: Date.now() });
                        try {
                            initiateChildEvents = yield this.initiateEvent(returnEvent, handler);
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_e = returnEvent.errors) !== null && _e !== void 0 ? _e : [], err] });
                        }
                        const initiateChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(initiateChildEvents.map((event) => this.invoke(event, returnEvent.id)));
                        yield ((_g = (_f = this.hooks) === null || _f === void 0 ? void 0 : _f.afterInitiate) === null || _g === void 0 ? void 0 : _g.call(_f, returnEvent));
                        if (!returnEvent.errors.length) {
                            returnEvent = (yield ((_j = (_h = this.hooks) === null || _h === void 0 ? void 0 : _h.beforeExecute) === null || _j === void 0 ? void 0 : _j.call(_h, returnEvent))) || returnEvent;
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { executedAt: Date.now() });
                            try {
                                executeChildEvents = yield this.executeEvent(returnEvent, initiateChildEventStates, handler);
                            }
                            catch (err) {
                                returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_k = returnEvent.errors) !== null && _k !== void 0 ? _k : [], err] });
                            }
                        }
                        const executeChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(executeChildEvents.map((event) => this.invoke(event, returnEvent.id)));
                        yield ((_m = (_l = this.hooks) === null || _l === void 0 ? void 0 : _l.afterExecute) === null || _m === void 0 ? void 0 : _m.call(_l, returnEvent));
                        returnEvent = (yield ((_p = (_o = this.hooks) === null || _o === void 0 ? void 0 : _o.beforeComplete) === null || _p === void 0 ? void 0 : _p.call(_o, returnEvent))) || returnEvent;
                        returnEvent = Object.assign(Object.assign({}, returnEvent), { completedAt: Date.now() });
                        try {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { state: yield this.completeEvent(returnEvent, executeChildEventStates, handler) });
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_q = returnEvent.errors) !== null && _q !== void 0 ? _q : [], err] });
                            yield ((_s = (_r = this.hooks) === null || _r === void 0 ? void 0 : _r.afterComplete) === null || _s === void 0 ? void 0 : _s.call(_r, returnEvent));
                            yield ((_u = (_t = this.hooks) === null || _t === void 0 ? void 0 : _t.afterInvoke) === null || _u === void 0 ? void 0 : _u.call(_t, returnEvent));
                            throw err;
                        }
                    }
                    yield ((_w = (_v = this.hooks) === null || _v === void 0 ? void 0 : _v.afterComplete) === null || _w === void 0 ? void 0 : _w.call(_v, returnEvent));
                }
            }
            yield ((_y = (_x = this.hooks) === null || _x === void 0 ? void 0 : _x.afterInvoke) === null || _y === void 0 ? void 0 : _y.call(_x, returnEvent));
            return returnEvent;
        });
    }
}
exports.DomainEvents = DomainEvents;
;
exports.createDomainEvent = ({ type, params, metadata, }) => ({
    id: uuid.v4(),
    parent: null,
    createdAt: Date.now(),
    initiatedAt: null,
    executedAt: null,
    completedAt: null,
    type,
    params,
    state: {},
    errors: [],
    metadata: metadata !== null && metadata !== void 0 ? metadata : {},
});
