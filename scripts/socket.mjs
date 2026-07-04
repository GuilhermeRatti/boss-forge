import { MODULE_ID } from "./constants.mjs";
import { log } from "./logger.mjs";

/**
 * Thin socketlib wrapper. socketlib is optional at runtime (it ships as a
 * Midi-QOL dependency on the target table): features that need it must check
 * socketAvailable() and degrade gracefully. Requires "socket": true in
 * module.json (world reload after changing it).
 */

let socket = null;
const pendingHandlers = new Map();

Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerModule(MODULE_ID);
  if (!socket) {
    log.warn("socketlib registration failed; GM-relay features are disabled.");
    return;
  }
  for (const [name, fn] of pendingHandlers) socket.register(name, fn);
  pendingHandlers.clear();
  log.debug("Socket registered.");
});

/**
 * Register a socket handler (safe to call before socketlib is ready).
 * @param {string} name
 * @param {Function} fn
 */
export function registerSocketHandler(name, fn) {
  if (socket) socket.register(name, fn);
  else pendingHandlers.set(name, fn);
}

/**
 * @returns {boolean} whether the socket layer is usable
 */
export function socketAvailable() {
  return socket !== null;
}

/**
 * Run a registered handler on (one) GM client and await its result.
 * Executes locally when the current user already is a GM.
 * @param {string} name
 * @param {...*} args
 */
export async function executeAsGM(name, ...args) {
  if (!socket) throw new Error(`${MODULE_ID}: socketlib is not available.`);
  return socket.executeAsGM(name, ...args);
}
