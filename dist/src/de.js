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
exports.createDomainEvent = exports.DomainEvents = void 0;
const uuid_1 = __importDefault(require("uuid"));
class DomainEvents {
    constructor(adapter) {
        this.adapter = adapter;
        this.eventMap = new Map();
    }
    initiateEvent(event, handler) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            return (_b = yield ((_a = handler.initiate) === null || _a === void 0 ? void 0 : _a.call(handler, event))) !== null && _b !== void 0 ? _b : event;
        });
    }
    executeEvent(event, handler) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return (yield ((_a = handler.execute) === null || _a === void 0 ? void 0 : _a.call(handler, event))) || [];
        });
    }
    completeEvent(event, events, handler) {
        var _a;
        if (typeof handler.complete === 'function') {
            return (_a = handler.complete(event, events)) !== null && _a !== void 0 ? _a : event;
        }
        return event;
    }
    on(eventName, handler) {
        var _a;
        const handlers = (_a = this.eventMap.get(eventName)) !== null && _a !== void 0 ? _a : [];
        if (!handlers.includes(handler)) {
            handlers.push(handler);
        }
        this.eventMap.set(eventName, handlers);
    }
    off(eventName, handler) {
        var _a;
        const handlers = (_a = this.eventMap.get(eventName)) !== null && _a !== void 0 ? _a : [];
        if (handlers.includes(handler)) {
            this.eventMap.set(eventName, handlers.filter(f => f !== handler));
        }
    }
    invoke(event, parent) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            yield ((_b = (_a = this.adapter) === null || _a === void 0 ? void 0 : _a.beforeInvoke) === null || _b === void 0 ? void 0 : _b.call(_a, event));
            let returnEvent = Object.assign(Object.assign({}, event), { executedAt: Date.now(), parent: parent !== null && parent !== void 0 ? parent : null });
            for (const [eventTypeId, handlers] of this.eventMap.entries()) {
                if (eventTypeId === event.name) {
                    for (const handler of handlers) {
                        let childEvents = [];
                        try {
                            returnEvent = yield this.initiateEvent(returnEvent, handler);
                            childEvents = yield this.executeEvent(returnEvent, handler);
                        }
                        catch (err) {
                            returnEvent = Object.assign(Object.assign({}, returnEvent), { errors: [...(_c = returnEvent.errors) !== null && _c !== void 0 ? _c : [], err] });
                        }
                        // if there are any errors, pass an empty array instead.
                        const childEventStates = returnEvent.errors.length ? [] : yield Promise.all(childEvents.map((event) => this.invoke(event, returnEvent.id)));
                        returnEvent = Object.assign(Object.assign(Object.assign({}, returnEvent), { completedAt: Date.now() }), this.completeEvent(returnEvent, childEventStates, handler));
                    }
                }
            }
            yield ((_e = (_d = this.adapter) === null || _d === void 0 ? void 0 : _d.afterInvoke) === null || _e === void 0 ? void 0 : _e.call(_d, returnEvent));
            return returnEvent;
        });
    }
}
exports.DomainEvents = DomainEvents;
;
exports.createDomainEvent = ({ name, params, state, parent, }) => ({
    id: uuid_1.default.v4(),
    parent: parent !== null && parent !== void 0 ? parent : null,
    createdAt: Date.now(),
    executedAt: null,
    completedAt: null,
    name,
    params,
    state,
    errors: [],
});
