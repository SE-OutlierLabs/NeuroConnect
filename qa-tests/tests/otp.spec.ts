import { test, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';

// ---------------------------------------------------------------
// OTP tests: TC-011, 013, 015, 016, 026, 027
// The backend must be started with:
//   npm run dev 2>&1 | tee /tmp/server.log
// The server prints each code as: [DEV OTP] To: <email> | Purpose: <purpose> | Code: <code>
// These tests read that line from /tmp/server.log.
// ---------------------------------------------------------------

const API = process.env.API_URL || 'http://localhost:4000/api';
const LOG = process.env.SERVER_LOG || '/tmp/server.log';
const PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword456!';

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:5173' });
test.describe.configure({ mode: 'serial' });

function uniqueEmail() {
  return `qa-test-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.local`;
}
const field = (page: any, label: string) => page.getByLabel(new RegExp('^' + label));

function logSize(): number {
  if (!fs.existsSync(LOG)) {
    throw new Error(`${LOG} not found. Start the backend with: npm run dev 2>&1 | tee ${LOG}`);
  }
  return fs.statSync(LOG).size;
}

// Wait until a NEW [DEV OTP] line for this email appears in the log, and return its code.
async function waitForOtp(email: string, fromOffset: number): Promise<string> {
  const re = new RegExp(`\\[DEV OTP\\] To: ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| Purpose: (\\S+) \\| Code: (\\d+)`, 'g');
  for (let i = 0; i < 40; i++) {
    const text = fs.readFileSync(LOG, 'utf8').slice(fromOffset);
    let last: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) last = m[2];
    if (last) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No [DEV OTP] line for ${email} appeared in ${LOG} within 10 seconds`);
}

// Register a new user through the API and return the email plus the code the server printed.
async function registerNew(api: any) {
  const email = uniqueEmail();
  const offset = logSize();
  const res = await api.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, display_name: 'QA Test User', role: 'mentee', age_confirmed: true },
  });
  expect(res.status(), 'register must return 201').toBe(201);
  const code = await waitForOtp(email, offset);
  return { email, code };
}

// Register and verify a new user so it can log in. Leaves api logged in (verify sets the session).
async function registerAndVerify(api: any) {
  const { email, code } = await registerNew(api);
  const res = await api.post(`${API}/auth/verify-otp`, { data: { email, code } });
  expect(res.status(), 'verify with the real code must return 200').toBe(200);
  return email;
}

// A code that is guaranteed to be different from the real one.
const otherThan = (code: string) => (code === '000000' ? '111111' : '000000');

test.describe('OTP and password reset (codes read from the server log)', () => {
  test('TC-011: Verify email with the correct code', async ({ page }) => {
    const api = await pwRequest.newContext();
    const { email, code } = await registerNew(api);
    await page.goto('/verify-otp');
    await field(page, 'Email').fill(email);
    await page.locator('#otp-code').fill(code);
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page).toHaveURL(/search/); // mentee home
    await api.dispose();
  });

  test('TC-013: Wrong code more than 5 times locks the code', async () => {
    const api = await pwRequest.newContext();
    const { email, code } = await registerNew(api);
    const wrong = otherThan(code);
    for (let i = 0; i < 5; i++) {
      const r = await api.post(`${API}/auth/verify-otp`, { data: { email, code: wrong } });
      expect(r.status(), `wrong attempt ${i + 1} must be refused`).toBe(400);
    }
    const last = await api.post(`${API}/auth/verify-otp`, { data: { email, code } });
    expect(last.status(), 'even the correct code must be refused after 5 wrong tries').toBe(400);
    await api.dispose();
  });

  test('TC-015: Expired code', async () => {
    test.skip(!process.env.RUN_EXPIRY, 'Not run by default: the code lasts about 10 minutes. Run with RUN_EXPIRY=1.');
    test.setTimeout(12 * 60 * 1000);
    const api = await pwRequest.newContext();
    const { email, code } = await registerNew(api);
    await new Promise((r) => setTimeout(r, 10.5 * 60 * 1000)); // wait for the code to expire
    const res = await api.post(`${API}/auth/verify-otp`, { data: { email, code } });
    expect(res.status(), 'an expired code must be refused').toBe(400);
    await api.dispose();
  });

  test('TC-016: Reuse a code that already worked', async () => {
    const api = await pwRequest.newContext();
    const { email, code } = await registerNew(api);
    const first = await api.post(`${API}/auth/verify-otp`, { data: { email, code } });
    expect(first.status()).toBe(200);
    const second = await api.post(`${API}/auth/verify-otp`, { data: { email, code } });
    expect(second.status(), 'the same code must not work twice').toBe(400);
    await api.dispose();
  });

  test('TC-026: Complete the password reset', async ({ page }) => {
    const api = await pwRequest.newContext();
    const email = await registerAndVerify(api);

    const offset = logSize();
    const forgot = await api.post(`${API}/auth/forgot-password`, { data: { email } });
    expect(forgot.status()).toBe(200);
    const code = await waitForOtp(email, offset);

    await page.goto('/reset-password');
    await field(page, 'Email').fill(email);
    await field(page, 'Verification code').fill(code);
    await field(page, 'New password').fill(NEW_PASSWORD);
    await field(page, 'Confirm new password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/login/);

    const fresh = await pwRequest.newContext();
    const oldLogin = await fresh.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
    expect(oldLogin.status(), 'old password must stop working').toBe(401);
    const newLogin = await fresh.post(`${API}/auth/login`, { data: { email, password: NEW_PASSWORD } });
    expect(newLogin.status(), 'new password must work').toBe(200);
    await fresh.dispose();
    await api.dispose();
  });

  test('TC-027: Old sessions end after reset', async () => {
    const browserA = await pwRequest.newContext(); // stays logged in
    const email = await registerAndVerify(browserA);
    expect((await browserA.get(`${API}/auth/me`)).status(), 'browser A is logged in').toBe(200);

    const browserB = await pwRequest.newContext(); // does the reset
    const offset = logSize();
    await browserB.post(`${API}/auth/forgot-password`, { data: { email } });
    const code = await waitForOtp(email, offset);
    const reset = await browserB.post(`${API}/auth/reset-password`, {
      data: { email, code, new_password: NEW_PASSWORD },
    });
    expect(reset.status()).toBe(200);

    expect((await browserA.get(`${API}/auth/me`)).status(), 'browser A must be logged out').toBe(401);
    await browserA.dispose();
    await browserB.dispose();
  });
});

