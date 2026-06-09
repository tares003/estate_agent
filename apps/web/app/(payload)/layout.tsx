/* THIS FILE IS A ROOT LAYOUT for the Payload CMS surface (CLAUDE.md §9).
 *
 * The app uses Next's multiple-root-layouts pattern: there is no top-level
 * app/layout.tsx — the (app) group owns the public/admin site's <html>, and this
 * (payload) group owns the CMS admin's <html> via Payload's RootLayout. Navigating
 * between the two triggers a full reload, which is correct (separate surfaces).
 */
import type { ReactNode } from 'react';
import type { ServerFunctionClient } from 'payload';

import config from '@payload-config';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';

import { importMap } from './admin/cms/importMap.js';

import '@payloadcms/next/css';

type Args = {
  children: ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
