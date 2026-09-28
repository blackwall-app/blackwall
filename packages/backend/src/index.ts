import { makeAppHandler } from "./app";

export const { handleRequest, dispose: disposeApp } = makeAppHandler();

export default {
  port: 8000,
  fetch: handleRequest,
};
