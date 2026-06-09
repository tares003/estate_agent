// Payload ships a CSS side-effect entry (`@payloadcms/next/css`) that the CMS
// root layout imports. It resolves to a stylesheet, not a typed module, so give
// tsc an ambient declaration for the side-effect import. Next/SWC handles the
// actual CSS at build time.
declare module '@payloadcms/next/css';
