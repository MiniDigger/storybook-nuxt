/* eslint-disable import/no-unresolved */
import { join, resolve } from 'path';
import type { PresetProperty } from '@storybook/types';
import { mergeConfig, type UserConfig as ViteConfig } from 'vite';
import type { Nuxt, NuxtApp } from '@nuxt/schema';


import type { StorybookConfig } from './types';

async function configureNuxtVite(baseConfig: Record<string, any>) {
  const { loadNuxt, buildNuxt } = await import(require.resolve('@nuxt/kit'));
  const nuxt: Nuxt = await loadNuxt({
    rootDir: baseConfig.root,
    ready: false,
    dev: true,
  });

  if ((nuxt.options.builder as string) !== '@nuxt/vite-builder') {
    throw new Error(`Storybook-Nuxt does not support '${nuxt.options.builder}' for now.`);
  }

  return {
    viteConfig: await new Promise<ViteConfig>((resolve, reject) => {
      nuxt.hook('modules:done', () => {
        nuxt.hook('app:resolve', (app:NuxtApp) => {
           console.log(  ' app.plungins ',app.plugins )
        });
        nuxt.hook(
          'vite:extendConfig',
          (
            config: ViteConfig | PromiseLike<ViteConfig> | Record<string, any>,
            { isClient }: any
          ) => {
            if (isClient) {
              resolve(mergeConfig(config, baseConfig));
            }
          }
        );
      });
      nuxt
        .ready()
        .then(() => {
          buildNuxt(nuxt).catch(reject);
        })
        .catch((err: { toString: () => string | string[] }) => {
          if (!err.toString().includes('_stop_')) {
            reject(err);
          }
        });
    }),
    nuxt,
  };
}
export const core: PresetProperty<'core', StorybookConfig> = async (config, options) => {
  return {
    ...config,
    builder:'@storybook/builder-vite',
    renderer: '@storybook/vue3',
  };
};
/**
 *
 * @param entry preview entries
 * @returns preview entries with nuxt runtime
 */
export const previewAnnotations: StorybookConfig['previewAnnotations'] = (entry = []) => {
  return [...entry, resolve(join(__dirname, "preview"))];
};

export const viteFinal: StorybookConfig['viteFinal'] = async (
  config: Record<string, any>,
  options: any
) => {
  const  viteConfig = async (c: Record<string, any>, o: any) => {
    const { viteFinal } = await import( require.resolve(join("@storybook/vue3-vite", "preset")));
    return viteFinal(c, o);
  }
  const nuxtConfig = await configureNuxtVite(await viteConfig(config, options));
  const devtools = nuxtConfig.nuxt.options.runtimeConfig.public['devtools'] as Record<string, any> || {}
  
  const DEVTOOLS_UI_LOCAL_PORT = devtools.port?.toString()  ??   '12442'
  const DEVTOOLS_UI_ROUTE = '/__nuxt_devtools__/client'
  return mergeConfig(nuxtConfig.viteConfig, {
    build: { rollupOptions: { external: ['vue'] } },
    define: {
      __NUXT__: JSON.stringify({ config: nuxtConfig.nuxt.options.runtimeConfig }),
    },
    server : { 
      cors : true ,
      proxy:{ [ DEVTOOLS_UI_ROUTE ] : { 
        target:`http://localhost:${DEVTOOLS_UI_LOCAL_PORT}${DEVTOOLS_UI_ROUTE}`,
        changeOrigin: true, 
        secure: false,
        rewrite: (path: string) => path.replace(DEVTOOLS_UI_ROUTE, ''),
        ws:true 
      } ,
      fs : { strict : false }
     }
    },
    preview: {
      headers: { "Access-Control-Allow-Origin": "*" , "Access-Control-Allow-Headers": "*"},
    },
    envPrefix: ['NUXT_'],
  });
};


