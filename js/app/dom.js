// The page's elements, looked up once. Modules run after the document is parsed.
export const $ = id => document.getElementById(id);
export const noteEl = $("note"), pickEl = $("pick"), phaseEl = $("phase"), trackEl = $("track");
export const inputs = { bpm: $("bpm"), prep: $("prep"), wait: $("wait") };
export const showAllEl = $("showAll"), menuBtn = $("menuBtn");
export const keyBtn = $("keyBtn"), keyPanel = $("keyPanel"), keyGrid = $("keyGrid");
export const keyCount = $("keyCount"), keysAllBtn = $("keysAll"), keysClearBtn = $("keysClear");
export const walkSetup = $("walkSetup"), pentaSetup = $("pentaSetup"), shapeGrid = $("shapeGrid"), shapeKey = $("shapeKey");
export const pentaKeyGrid = $("pentaKeyGrid"), placeRow = $("placeRow"), placeGrid = $("placeGrid"), openHint = $("openHint");
export const neckSwitch = $("neckSwitch");
export const roundKeyEl = $("roundKey");
export const bpmRange = $("bpmRange"), toggleBtn = $("toggle"), helpBtn = $("helpBtn"), tunerBtn = $("tunerBtn");
export const boardBtn = $("boardBtn"), boardPanel = $("boardPanel"), boardSwitch = $("boardSwitch");
export const fretFromEl = $("fretFrom"), fretToEl = $("fretTo"), boardEl = $("board"), mainEl = document.querySelector("main");
