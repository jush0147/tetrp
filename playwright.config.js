import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./browser-tests',timeout:60000,fullyParallel:false,workers:1,
  reporter:'list',use:{baseURL:'http://127.0.0.1:4173/tetrp/',trace:'off',screenshot:'off',video:'off'},
  projects:[{name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1280,height:900}}},
    {name:'mobile-webkit',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}}],
  webServer:{command:'npm run preview',url:'http://127.0.0.1:4173/tetrp/',reuseExistingServer:!process.env.CI},
});
