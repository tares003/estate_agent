// Playwright CT mount setup. Load the design tokens so components render with
// their real var(--token) values in the browser (jsdom can't, but the CT runner
// can). Component stylesheets are imported by the components themselves.
import '@estate/tokens/tokens.css';
