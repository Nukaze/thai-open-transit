// apps/web/lib/visitCounter.test.ts
import { describe, it, expect } from "vitest";
import { deviceClass, isBot, parseStats } from "./visitCounter";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const SAMSUNG =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36";
// CUBOT phones have "bot" in the model name: a person, must count.
const CUBOT =
  "Mozilla/5.0 (Linux; Android 11; CUBOT X30 Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const CUBOT_UNDERSCORE =
  "Mozilla/5.0 (Linux; Android 10; CUBOT_X19_S) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
// In-app browsers: a viral TikTok or LINE share lands here, must count.
const TIKTOK_IN_APP =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 trill_370104 BytedanceWebview/d8a21c6";
const LINE_IN_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.10.0";

describe("isBot", () => {
  it("never treats a real browser as a bot", () => {
    for (const ua of [
      CHROME,
      SAFARI_IOS,
      SAMSUNG,
      CUBOT,
      CUBOT_UNDERSCORE,
      TIKTOK_IN_APP,
      LINE_IN_APP,
    ]) {
      expect(isBot(ua, false)).toBe(false);
    }
  });

  it("catches crawlers that render JavaScript", () => {
    expect(
      isBot(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/141.0.0.0 Safari/537.36",
        false,
      ),
    ).toBe(true);
    expect(
      isBot(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
        false,
      ),
    ).toBe(true);
  });

  it("catches headless tooling", () => {
    expect(isBot(CHROME.replace("Chrome/", "HeadlessChrome/"), false)).toBe(
      true,
    );
    expect(isBot(`${CHROME} Chrome-Lighthouse`, false)).toBe(true);
    expect(isBot(CHROME, true)).toBe(true); // navigator.webdriver
  });
});

describe("deviceClass", () => {
  it("splits at the layout's 768px desktop breakpoint", () => {
    expect(deviceClass(390)).toBe("mobile");
    expect(deviceClass(767)).toBe("mobile");
    expect(deviceClass(768)).toBe("desktop");
    expect(deviceClass(1920)).toBe("desktop");
  });
});

describe("parseStats", () => {
  it("reads the single row an RPC table returns", () => {
    expect(parseStats([{ total: 1234, today: 5 }])).toEqual({
      total: 1234,
      today: 5,
    });
  });

  it("rejects anything else", () => {
    expect(parseStats([])).toBeNull();
    expect(parseStats({ total: 1, today: 1 })).toBeNull();
    expect(parseStats([{ total: "1", today: 1 }])).toBeNull();
    expect(parseStats(null)).toBeNull();
  });
});
