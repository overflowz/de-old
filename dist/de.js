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
            return (yield ((_a = handler.initiate) === null || _a === void 0 ? void 0 : _a.call(handler, event))) || [];
        });
    }
    executeEvent(event, events, handler) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return (yield ((_a = handler.execute) === null || _a === void 0 ? void 0 : _a.call(handler, event, events))) || [];
        });
    }
    completeEvent(event, events, handler) {
        var _a;
        if (typeof handler.complete === 'function') {
            return (_a = handler.complete(event, events)) !== null && _a !== void 0 ? _a : event;
        }
        return event;
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
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            let completeCallbackError;
            let returnEvent = Object.assign(Object.assign({}, event), { parent: parent !== null && parent !== void 0 ? parent : null });
            for (const [eventType, handlers] of this.eventMap.entries()) {
                if (eventType === event.type) {
                    yield ((_b = (_a = this.hooks) === null || _a === void 0 ? void 0 : _a.beforeInvoke) === null || _b === void 0 ? void 0 : _b.call(_a, returnEvent));
                    returnEvent = Object.assign(Object.assign({}, returnEvent), { executedAt: Date.now() });
                    for (const handler of handlers) {
                        let initiateChildEvents = [];
                        let executeChildEvents = [];
                        try {
                            initiateChildEvents = yield this.initiateEvent(returnEvent, handler);
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_c = returnEvent.errors) !== null && _c !== void 0 ? _c : [], err] });
                        }
                        const initiateChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(initiateChildEvents.map((event) => this.invoke(event, returnEvent.id)));
                        if (!returnEvent.errors.length) {
                            try {
                                executeChildEvents = yield this.executeEvent(returnEvent, initiateChildEventStates, handler);
                            }
                            catch (err) {
                                returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_d = returnEvent.errors) !== null && _d !== void 0 ? _d : [], err] });
                            }
                        }
                        const executeChildEventStates = returnEvent.errors.length ? [] : yield Promise.all(executeChildEvents.map((event) => this.invoke(event, returnEvent.id)));
                        try {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), this.completeEvent(returnEvent, executeChildEventStates, handler));
                        }
                        catch (err) {
                            completeCallbackError = err;
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_e = returnEvent.errors) !== null && _e !== void 0 ? _e : [], err] });
                        }
                    }
                    returnEvent = Object.assign(Object.assign({}, returnEvent), { completedAt: Date.now() });
                    yield ((_g = (_f = this.hooks) === null || _f === void 0 ? void 0 : _f.afterInvoke) === null || _g === void 0 ? void 0 : _g.call(_f, returnEvent));
                    // if complete callback threw an error, rethrow it. we need
                    // this check to make sure the adapter is called before throwing.
                    if (completeCallbackError) {
                        throw completeCallbackError;
                    }
                }
            }
            return returnEvent;
        });
    }
}
exports.DomainEvents = DomainEvents;
;
exports.createDomainEvent = ({ type, params, }) => ({
    id: uuid.v4(),
    parent: null,
    createdAt: Date.now(),
    executedAt: null,
    completedAt: null,
    type,
    params,
    state: {},
    errors: [],
});
