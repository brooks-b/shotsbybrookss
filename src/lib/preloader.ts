/** Shared between the server layout and the client preloader. */
export const PRELOADER_KEY = "sbb-loaded";

/** Fired by the globe once its land data is on the GPU. */
export const GLOBE_READY = "globe:ready";

/** Inlined in <head>: skip the preloader on repeat visits this session. */
export const preloaderSkipScript = `try{if(sessionStorage.getItem("${PRELOADER_KEY}"))document.documentElement.dataset.loaded="1"}catch(e){}`;
