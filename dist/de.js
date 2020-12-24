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
exports.generateDomainEvent = ({ id, action, params, metadata, state, }) => ({
    id: id !== null && id !== void 0 ? id : uuid_1.v4(),
    parent: null,
    action,
    status: interface_1.EventStatus.PENDING,
    error: null,
    params: params !== null && params !== void 0 ? params : {},
    state: state !== null && state !== void 0 ? state : {},
    metadata: metadata !== null && metadata !== void 0 ? metadata : {},
});
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
    register(action, handlers) {
        if (this.handlerMap.has(action)) {
            throw new Error(`handlers are already registered for the ${action} action.`);
        }
        this.handlerMap.set(action, handlers);
    }
    handleEvent(event) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            let returnEvent = event;
            try {
                if (returnEvent.status === interface_1.EventStatus.COMPLETED) {
                    return returnEvent;
                }
                if (returnEvent.status !== interface_1.EventStatus.PENDING) {
                    throw new Error(`event ${returnEvent.id} must be in ${interface_1.EventStatus['PENDING']} state to proceed.`);
                }
                const handlers = (_a = this.handlerMap.get(returnEvent.action)) !== null && _a !== void 0 ? _a : [];
                if (!handlers.length) {
                    return returnEvent;
                }
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.IN_PROGRESS });
                for (const handler of handlers) {
                    // initiation phase
                    let children = (yield ((_b = handler.initiate) === null || _b === void 0 ? void 0 : _b.call(handler, returnEvent))) || [];
                    returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                    children = yield Promise.all(children
                        .filter((ce) => ce.id !== returnEvent.id)
                        .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                    // execution phase
                    children = (yield ((_c = handler.execute) === null || _c === void 0 ? void 0 : _c.call(handler, returnEvent, children))) || [];
                    returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                    children = yield Promise.all(children
                        .filter((ce) => ce.id !== returnEvent.id)
                        .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                    // completion phase
                    children = (yield ((_d = handler.complete) === null || _d === void 0 ? void 0 : _d.call(handler, returnEvent, children))) || [];
                    returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), children.find((ce) => ce.id === returnEvent.id)), { status: returnEvent.status });
                    // "fire and forget" events returned from the complete phase
                    Promise.all(children
                        .filter((ce) => ce.id !== returnEvent.id)
                        .map((ce) => this.handleEvent(Object.assign(Object.assign({}, ce), { parent: returnEvent.id }))));
                }
                // call event listeners
                (_e = this.eventMap.get(returnEvent.action)) === null || _e === void 0 ? void 0 : _e.map((callback) => tryCatch_1.default(() => callback(returnEvent)));
                // mark event as completed
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.COMPLETED });
            }
            catch (err) {
                const normalizedError = err instanceof Error
                    ? err
                    : new Error(err);
                returnEvent = Object.assign(Object.assign({}, returnEvent), { status: interface_1.EventStatus.FAILED, message: normalizedError.message });
            }
            return returnEvent;
        });
    }
}
exports.DomainEvents = DomainEvents;
