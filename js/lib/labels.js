import { setting } from "./store.js";

export const hasGrades = () => setting("platform") === "ps";
export const trophyWord = () => (hasGrades() ? "Trophy" : "Achievement");
export const trophiesWord = () => (hasGrades() ? "Trophies" : "Achievements");
