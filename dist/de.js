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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEvents = void 0;
const uuid_1 = require("uuid");
const tryCatch_1 = __importDefault(require("./utils/tryCatch"));
const interface_1 = require("./interface");
class DomainEvents {
    constructor(hooks) {
        this.handlerMap = new Map();
        this.eventMap = new Map();
        this.generateDomainEvent = this.generateDomainEvent.bind(this);
        this.handleEvent = this.handleEvent.bind(this);
        // this.retryEvent = this.retryEvent.bind(this);
        this.register = this.register.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
        this.hooks = hooks;
    }
    generateDomainEvent({ action, params, metadata, state }) {
        return {
            id: uuid_1.v4(),
            parent: null,
            action,
            phase: interface_1.EventPhase.INITIATE,
            status: interface_1.EventStatus.PENDING,
            error: null,
            params: params !== null && params !== void 0 ? params : {},
            state: state !== null && state !== void 0 ? state : {},
            metadata: metadata !== null && metadata !== void 0 ? metadata : {},
        };
    }
    on(action, callback) {
        var _a;
        const callbacks = (_a = this.eventMap.get(action)) !== null && _a !== void 0 ? _a : [];
        if (!callbacks.includes(callback)) {
            callbacks.push(callback);
            this.eventMap.set(action, callbacks);
        }
    }
    off(action, callback) {
        var _a;
        if (!callback) {
            this.eventMap.delete(action);
        }
        else {
            const callbacks = (_a = this.eventMap.get(action)) !== null && _a !== void 0 ? _a : [];
            if (callbacks.some((s) => s === callback)) {
                this.eventMap.set(action, callbacks.filter((f) => f !== callback));
            }
        }
    }
    register(action, handler) {
        if (this.handlerMap.has(action)) {
            throw new Error(`handler is already registered for the ${action} action.`);
        }
        this.handlerMap.set(action, handler);
    }
    handleEvent(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        return __awaiter(this, void 0, void 0, function* () {
            let returnEvent = (yield ((_b = (_a = this.hooks) === null || _a === void 0 ? void 0 : _a.beforeInvoke) === null || _b === void 0 ? void 0 : _b.call(_a, event))) || event;
            if (returnEvent.status === interface_1.EventStatus.COMPLETED) {
                // return already completed event immediately without handling it.
                // we dont execute event listeners in this case, because it could've already
                // fired when the event was completed.
                return returnEvent;
            }
            if (returnEvent.status !== interface_1.EventStatus.PENDING || returnEvent.phase !== interface_1.EventPhase.INITIATE) {
                // event must be in an INITIATE phase with status of PENDING, otherwise
                // unexpected results might occur (i.e., duplicate processing, data integrity issues, etc.).
                throw new Error(`event ${returnEvent.id} must be in ${interface_1.EventStatus['PENDING']} state and ${interface_1.EventPhase.INITIATE} phase to proceed.`);
            }
            const handler = this.handlerMap.get(returnEvent.action);
            bp: if (typeof handler !== 'undefined') {
                returnEvent = (yield ((_d = (_c = this.hooks) === null || _c === void 0 ? void 0 : _c.beforeInitiate) === null || _d === void 0 ? void 0 : _d.call(_c, returnEvent))) || returnEvent;
                // handler found, set status to IN_PROGRESS
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.IN_PROGRESS });
                // initiation phase
                const initiateEvents = (yield tryCatch_1.default(() => { var _a; return (_a = handler.initiate) === null || _a === void 0 ? void 0 : _a.call(handler, returnEvent); })) || [];
                if (initiateEvents instanceof Error) {
                    returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, error: initiateEvents.message });
                    yield ((_f = (_e = this.hooks) === null || _e === void 0 ? void 0 : _e.afterInitiate) === null || _f === void 0 ? void 0 : _f.call(_e, returnEvent));
                    break bp;
                }
                yield ((_h = (_g = this.hooks) === null || _g === void 0 ? void 0 : _g.afterInitiate) === null || _h === void 0 ? void 0 : _h.call(_g, returnEvent));
                // execution phase
                returnEvent = Object.assign(Object.assign({}, returnEvent), { phase: interface_1.EventPhase.EXECUTE });
                const initiateEventStates = yield Promise.all(initiateEvents.map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                returnEvent = (yield ((_k = (_j = this.hooks) === null || _j === void 0 ? void 0 : _j.beforeExecute) === null || _k === void 0 ? void 0 : _k.call(_j, returnEvent, initiateEventStates))) || returnEvent;
                const executeEvents = (yield tryCatch_1.default(() => { var _a; return (_a = handler.execute) === null || _a === void 0 ? void 0 : _a.call(handler, returnEvent, initiateEventStates); })) || [];
                if (executeEvents instanceof Error) {
                    returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, error: executeEvents.message });
                    yield ((_m = (_l = this.hooks) === null || _l === void 0 ? void 0 : _l.afterExecute) === null || _m === void 0 ? void 0 : _m.call(_l, returnEvent, initiateEventStates));
                    break bp;
                }
                yield ((_p = (_o = this.hooks) === null || _o === void 0 ? void 0 : _o.afterExecute) === null || _p === void 0 ? void 0 : _p.call(_o, returnEvent, initiateEventStates));
                // completion phase
                returnEvent = Object.assign(Object.assign({}, returnEvent), { phase: interface_1.EventPhase.COMPLETE });
                const executeEventStates = yield Promise.all(executeEvents.map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                returnEvent = (yield ((_r = (_q = this.hooks) === null || _q === void 0 ? void 0 : _q.beforeComplete) === null || _r === void 0 ? void 0 : _r.call(_q, returnEvent, executeEventStates))) || returnEvent;
                const completeEvents = (yield tryCatch_1.default(() => { var _a; return (_a = handler.complete) === null || _a === void 0 ? void 0 : _a.call(handler, returnEvent, executeEventStates); })) || [];
                if (completeEvents instanceof Error) {
                    returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, error: completeEvents.message });
                    yield ((_t = (_s = this.hooks) === null || _s === void 0 ? void 0 : _s.afterComplete) === null || _t === void 0 ? void 0 : _t.call(_s, returnEvent, executeEventStates));
                    break bp;
                }
                // "fire and forget" events returned from the complete phase
                Promise.all(completeEvents.map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                // call event listeners
                (_u = this.eventMap.get(returnEvent.action)) === null || _u === void 0 ? void 0 : _u.map((callback) => tryCatch_1.default(() => callback(returnEvent)));
                // mark event as completed
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.COMPLETED });
                yield ((_w = (_v = this.hooks) === null || _v === void 0 ? void 0 : _v.afterComplete) === null || _w === void 0 ? void 0 : _w.call(_v, returnEvent, executeEventStates));
            }
            yield ((_y = (_x = this.hooks) === null || _x === void 0 ? void 0 : _x.afterInvoke) === null || _y === void 0 ? void 0 : _y.call(_x, returnEvent));
            return returnEvent;
        });
    }
    /**
     * @deprecated will be implemented later
     */
    retryEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
    }
}
exports.DomainEvents = DomainEvents;
