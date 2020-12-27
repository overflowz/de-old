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
exports.DomainEvents = exports.generateDomainEvent = void 0;
const uuid_1 = require("uuid");
const tryCatch_1 = __importDefault(require("./utils/tryCatch"));
const interface_1 = require("./interface");
const normalizeError = (err) => err instanceof Error ? err : new Error(err);
exports.generateDomainEvent = ({ id, action, params, metadata, state, }) => {
    var _a;
    return ({
        id: id !== null && id !== void 0 ? id : uuid_1.v4(),
        parent: null,
        action,
        status: interface_1.EventStatus.PENDING,
        error: null,
        params: params !== null && params !== void 0 ? params : {},
        state: (_a = state) !== null && _a !== void 0 ? _a : {},
        metadata: metadata !== null && metadata !== void 0 ? metadata : {},
    });
};
class DomainEvents {
    constructor() {
        this.handlerMap = new Map();
        this.eventMap = new Map();
        this.handleEvent = this.handleEvent.bind(this);
        this.register = this.register.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
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
    register(action, handler, middlewares) {
        if (this.handlerMap.has(action)) {
            throw new Error(`handler is already registered for the ${action} action type.`);
        }
        this.handlerMap.set(action, {
            handler,
            middlewares: middlewares !== null && middlewares !== void 0 ? middlewares : [],
        });
    }
    handleEvent(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __awaiter(this, void 0, void 0, function* () {
            let handlerMiddlewares = [];
            let returnEvent = event;
            try {
                if (returnEvent.status === interface_1.EventStatus.COMPLETED) {
                    return returnEvent;
                }
                if (returnEvent.status !== interface_1.EventStatus.PENDING) {
                    throw new Error(`event ${returnEvent.id} must be in ${interface_1.EventStatus['PENDING']} state to proceed.`);
                }
                const handlerRecord = this.handlerMap.get(returnEvent.action);
                if (!handlerRecord) {
                    return event;
                }
                const { handler, middlewares } = handlerRecord;
                handlerMiddlewares = middlewares;
                for (const middleware of handlerMiddlewares) {
                    returnEvent = (yield ((_a = middleware.before) === null || _a === void 0 ? void 0 : _a.call(middleware, returnEvent))) || returnEvent;
                }
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.IN_PROGRESS });
                // initiation phase
                for (const middleware of handlerMiddlewares) {
                    returnEvent = (yield ((_b = middleware.beforeEach) === null || _b === void 0 ? void 0 : _b.call(middleware, returnEvent, [], interface_1.EventPhase.INITIATE))) || returnEvent;
                }
                let children = yield Promise.resolve((_c = handler.initiate) === null || _c === void 0 ? void 0 : _c.call(handler, returnEvent))
                    .then((res) => Array.isArray(res) ? res : res ? [res] : []);
                returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                children = yield Promise.all(children
                    .filter((ce) => ce.id !== returnEvent.id)
                    .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                for (const middleware of handlerMiddlewares.reverse()) {
                    returnEvent = (yield ((_d = middleware.afterEach) === null || _d === void 0 ? void 0 : _d.call(middleware, returnEvent, children, interface_1.EventPhase.INITIATE))) || returnEvent;
                }
                // execution phase
                for (const middleware of handlerMiddlewares) {
                    returnEvent = (yield ((_e = middleware.beforeEach) === null || _e === void 0 ? void 0 : _e.call(middleware, returnEvent, children, interface_1.EventPhase.EXECUTE))) || returnEvent;
                }
                children = yield Promise.resolve((_f = handler.execute) === null || _f === void 0 ? void 0 : _f.call(handler, returnEvent, children))
                    .then((res) => Array.isArray(res) ? res : res ? [res] : []);
                returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                children = yield Promise.all(children
                    .filter((ce) => ce.id !== returnEvent.id)
                    .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                for (const middleware of handlerMiddlewares.reverse()) {
                    returnEvent = (yield ((_g = middleware.afterEach) === null || _g === void 0 ? void 0 : _g.call(middleware, returnEvent, children, interface_1.EventPhase.EXECUTE))) || returnEvent;
                }
                // completion phase
                for (const middleware of handlerMiddlewares) {
                    returnEvent = (yield ((_h = middleware.beforeEach) === null || _h === void 0 ? void 0 : _h.call(middleware, returnEvent, children, interface_1.EventPhase.COMPLETE))) || returnEvent;
                }
                children = yield Promise.resolve((_j = handler.complete) === null || _j === void 0 ? void 0 : _j.call(handler, returnEvent, children))
                    .then((res) => Array.isArray(res) ? res : res ? [res] : []);
                returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                // "fire and forget" events returned from the complete phase
                Promise.all(children
                    .filter((ce) => ce.id !== returnEvent.id)
                    .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                for (const middleware of handlerMiddlewares.reverse()) {
                    returnEvent = (yield ((_k = middleware.afterEach) === null || _k === void 0 ? void 0 : _k.call(middleware, returnEvent, children, interface_1.EventPhase.COMPLETE))) || returnEvent;
                }
                // call event listeners
                (_l = this.eventMap.get(returnEvent.action)) === null || _l === void 0 ? void 0 : _l.map((callback) => tryCatch_1.default(() => callback(returnEvent)));
                // mark event as completed
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.COMPLETED });
            }
            catch (err) {
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, error: normalizeError(err) });
            }
            try {
                for (const middleware of handlerMiddlewares.reverse()) {
                    returnEvent = (yield ((_m = middleware.after) === null || _m === void 0 ? void 0 : _m.call(middleware, returnEvent))) || returnEvent;
                }
            }
            catch (err) {
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, error: normalizeError(err) });
            }
            return returnEvent;
        });
    }
}
exports.DomainEvents = DomainEvents;
