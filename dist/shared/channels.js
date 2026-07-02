"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
exports.IPC = {
    // Renderer -> Main
    PICK_MODE: "browser:pick-mode",
    PICK_RESULT: "browser:pick-result",
    ANNOTATION_SUBMIT: "browser:annotation-submit",
    TAB_NAVIGATE: "browser:tab-navigate",
    TAB_BACK: "browser:tab-back",
    TAB_FORWARD: "browser:tab-forward",
    TAB_RELOAD: "browser:tab-reload",
    TAB_NEW: "browser:tab-new",
    TAB_SWITCH: "browser:tab-switch",
    TAB_CLOSE: "browser:tab-close",
    TAB_LIST: "browser:tab-list",
    CAPTURE_PAGE: "browser:capture-page",
    TAB_STATE_UPDATE: "browser:tab-state-update",
    // Main -> Renderer
    PICK_START: "browser:pick-start",
    PICK_CANCEL: "browser:pick-cancel",
    SET_PICK_MODE: "browser:set-pick-mode",
    DO_NAVIGATE: "browser:do-navigate",
    DO_BACK: "browser:do-back",
    DO_FORWARD: "browser:do-forward",
    DO_RELOAD: "browser:do-reload",
    DO_TAB_NEW: "browser:do-tab-new",
    DO_TAB_SWITCH: "browser:do-tab-switch",
    DO_TAB_CLOSE: "browser:do-tab-close",
    GET_SNAPSHOT: "browser:get-snapshot",
    SNAPSHOT_RESULT: "browser:snapshot-result",
    GET_SCREENSHOT: "browser:get-screenshot",
    SCREENSHOT_RESULT: "browser:screenshot-result",
    DO_CLICK: "browser:do-click",
    DO_FILL: "browser:do-fill",
    DO_PRESS: "browser:do-press",
    ACTION_RESULT: "browser:action-result",
};
