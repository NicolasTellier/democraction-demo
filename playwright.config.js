import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/browser',
 timeout:30000,
 use:{baseURL:'http://127.0.0.1:4173',headless:true},
 projects:[
  {name:'desktop',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
  {name:'portable',use:{browserName:'chromium',viewport:{width:1280,height:800}}},
  {name:'iphone',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'android',use:{browserName:'chromium',viewport:{width:412,height:915},isMobile:true,hasTouch:true}}
 ],
 webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',url:'http://127.0.0.1:4173/',reuseExistingServer:!process.env.CI,timeout:30000}
});
