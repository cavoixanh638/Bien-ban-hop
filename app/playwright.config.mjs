import {defineConfig,devices} from '@playwright/test';
const preview=process.env.G10_PREVIEW==='1';
const port=preview?4173:5173;
export default defineConfig({
  testDir:'./e2e',
  timeout:45000,
  expect:{timeout:15000},
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?[['list'],['html',{open:'never',outputFolder:'playwright-report'}]]:'list',
  use:{
    baseURL:'http://127.0.0.1:'+port,
    headless:true,
    ...devices['Desktop Chrome'],
    launchOptions:{args:[
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]},
    permissions:['microphone'],
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  },
  webServer:{
    command:preview?'npm run preview':'npm run dev',
    url:'http://127.0.0.1:'+port,
    timeout:120000,
    reuseExistingServer:!process.env.CI
  }
});
