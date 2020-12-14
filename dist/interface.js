"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStatus = exports.EventPhase = void 0;
var EventPhase;
(function (EventPhase) {
    EventPhase["INITIATE"] = "initiate";
    EventPhase["EXECUTE"] = "execute";
    EventPhase["COMPLETE"] = "complete";
})(EventPhase = exports.EventPhase || (exports.EventPhase = {}));
;
var EventStatus;
(function (EventStatus) {
    EventStatus["PENDING"] = "pending";
    EventStatus["IN_PROGRESS"] = "in_progress";
    EventStatus["COMPLETED"] = "completed";
    EventStatus["FAILED"] = "failed";
})(EventStatus = exports.EventStatus || (exports.EventStatus = {}));
;
