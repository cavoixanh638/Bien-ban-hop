import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',
  timeout:45000,
  expect:{timeout:15000},
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?[['list'],['html',{open:'never',outputFolder:'playwright-report'}]]:'list',
  use:{
    baseURL:'http://127.0.0.1:5173',
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
    command:'npm run dev',
    url:'http://127.0.0.1:5173',
    timeout:120000,
    reuseExistingServer:!process.env.CI
  }
});
