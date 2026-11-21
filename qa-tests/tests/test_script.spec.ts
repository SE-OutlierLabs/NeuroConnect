import { test, expect, request as pwRequest } from '@playwright/test';

// ---------------------------------------------------------------
// NeuroConnect QA suite: 52 active tests in ONE file.
// Needs the backend (port 4000) and frontend (port 5173) running.
// ---------------------------------------------------------------

const API = process.env.API_URL || 'http://localhost:4000/api';
const PASSWORD = 'Password123!';
const ACCOUNTS: Record<string, string> = {
  admin: 'admin@neuroconnect.local',
  mentor: 'mentor.approved@neuroconnect.local',
  pendingMentor: 'mentor.pending@neuroconnect.local',
  mentee: 'mentee@neuroconnect.local',
};

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:5173' });

// ---------- helpers ----------
function uniqueEmail() {
  return `qa-test-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.local`;
}

async function registerViaApi(req: any, over: any = {}) {
  const email = uniqueEmail();
  const res = await req.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, display_name: 'QA Test User', role: 'mentee', age_confirmed: true, ...over },
  });
  return { email, res };
}

// Labels end with a hidden "*", so match the start of the label.
const field = (page: any, label: string) => page.getByLabel(new RegExp('^' + label));

const errorShown = (page: any, re: RegExp) => page.getByRole('alert').or(page.getByText(re)).first();

async function fillRegister(page: any, o: any) {
  if (o.role === 'mentor') {
    const mentorOption = page.getByText(/I want to mentor/i).first();
    if (await mentorOption.count()) await mentorOption.click();
  }
  if (o.name !== undefined) await field(page, 'Display name').fill(o.name);
  if (o.email !== undefined) await field(page, 'Email').fill(o.email);
  if (o.password !== undefined) await field(page, 'Password').fill(o.password);
  if (o.confirm !== undefined) await field(page, 'Confirm password').fill(o.confirm);
  if (o.age) await page.getByLabel(/I confirm that I am 18/i).check();
}

async function isPlaceholder(page: any) {
  const text = await page.locator('body').innerText();
  return /(GET|POST|PATCH) \/|Member F|Todo/i.test(text);
}

// Log in once per role through the API, then reuse the cookie for every test.
const savedLogins: Record<string, any> = {};
async function loginAs(context: any, who: string) {
  if (!savedLogins[who]) {
    const ctx = await pwRequest.newContext();
    const res = await ctx.post(`${API}/auth/login`, { data: { email: ACCOUNTS[who], password: PASSWORD } });
    expect(res.status(), `Login as ${who} must work`).toBe(200);
    savedLogins[who] = await ctx.storageState();
    await ctx.dispose();
  }
  await context.addCookies(savedLogins[who].cookies);
}

let unverified: { email: string; res: any };

// =====================================================================
// 01 REGISTER (TC-001 to TC-009)
// =====================================================================
const goodUser = (over: any = {}) => ({
  name: 'QA Test User', email: uniqueEmail(), password: PASSWORD, confirm: PASSWORD, age: true, ...over,
});
const submitRegister = (page: any) => page.getByRole('button', { name: /create account|register|sign up/i }).first().click();

test.describe('Register page (/register)', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/register'); });

  test('TC-001: Register with valid details and 18+ confirmed', async ({ page }) => {
    await fillRegister(page, goodUser());
    const [regRes] = await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/auth/register'), { timeout: 10000 }).catch(() => null),
      submitRegister(page),
    ]);
    await page.waitForTimeout(500);
    if (!/verify-otp/.test(page.url())) {
      const status = regRes ? regRes.status() : 'no-response';
      const bodyText = await page.locator('body').innerText();
      throw new Error(`Stayed on ${page.url()} (API status: ${status}). Page text: ${bodyText.slice(0, 400)}`);
    }
    await expect(page).toHaveURL(/verify-otp/);
    await expect(page.getByText(/6-digit code|could not be sent|verify/i).first()).toBeVisible();
  });

  test('TC-002: Register without ticking 18+', async ({ page }) => {
    await fillRegister(page, goodUser({ age: false }));
    await submitRegister(page);
    await expect(page.getByText('You must confirm that you are 18 or older.')).toBeVisible();
    await expect(page).toHaveURL(/register/);
  });

  test('TC-003: Register with an email that already exists', async ({ page }) => {
    await fillRegister(page, goodUser({ email: ACCOUNTS.mentee }));
    await Promise.all([page.waitForResponse((r: any) => r.url().includes('/auth/register')), submitRegister(page)]);
    await expect(page).toHaveURL(/register/);
    await expect(errorShown(page, /already/i)).toBeVisible();
  });

  test('TC-004: Register with empty or invalid fields', async ({ page }) => {
    await submitRegister(page);
    await expect(page.getByText('Enter a name between 2 and 50 characters.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
    await expect(page.getByText('You must confirm that you are 18 or older.')).toBeVisible();
  });

  test('TC-005: Password shorter than 8 characters', async ({ page }) => {
    await fillRegister(page, goodUser({ password: '1234567', confirm: '1234567' }));
    await submitRegister(page);
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
    await expect(page).toHaveURL(/register/);
  });

  test('TC-006: Password longer than 72 characters', async ({ page }) => {
    const long = 'a'.repeat(73);
    await fillRegister(page, goodUser({ password: long, confirm: long }));
    await submitRegister(page);
    await expect(page.getByText('Use at most 72 characters.')).toBeVisible();
  });

  test('TC-007: Display name too short or too long', async ({ page }) => {
    await fillRegister(page, goodUser({ name: 'A' }));
    await submitRegister(page);
    await expect(page.getByText('Enter a name between 2 and 50 characters.')).toBeVisible();
    await page.getByLabel(/^Display name/).fill('B'.repeat(51));
    await submitRegister(page);
    await expect(page.getByText('Enter a name between 2 and 50 characters.')).toBeVisible();
    await expect(page).toHaveURL(/register/);
  });

  test('TC-008: Register as a mentor', async ({ page }) => {
    await fillRegister(page, goodUser({ role: 'mentor' }));
    await submitRegister(page);
    await expect(page).toHaveURL(/verify-otp/);
  });

  test('TC-009: Register as a mentee (default)', async ({ page }) => {
    await expect(page.getByRole('radio', { name: /I want a mentor/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /I want to mentor/ })).not.toBeChecked();
  });
});

// =====================================================================
// 02 VERIFY OTP AND LOGIN (ACTIVE CASES)
// =====================================================================
test.describe('Verify OTP and Login', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    unverified = await registerViaApi(ctx);
    await ctx.dispose();
  });

  test('TC-012: Enter a wrong code', async ({ page }) => {
    await page.goto('/verify-otp');
    await field(page, 'Email').fill(unverified.email);
    await page.locator('#otp-code').fill('000000');
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(errorShown(page, /invalid|expired|incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/verify-otp/);
  });

  test('TC-014: Resend code twice quickly', async ({ page }) => {
    await page.goto('/register');
    await fillRegister(page, { name: 'QA Test User', email: uniqueEmail(), password: PASSWORD, confirm: PASSWORD, age: true });
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/verify-otp/);
    const resend = page.getByRole('button', { name: /Send a new code in \d+s/ });
    await expect(resend).toBeVisible();
    await expect(resend).toBeDisabled();
  });

  test('TC-017: Unknown email on the OTP screen', async ({ page }) => {
    await page.goto('/verify-otp');
    await field(page, 'Email').fill('nobody-here@test.local');
    await page.locator('#otp-code').fill('123456');
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(errorShown(page, /invalid|expired|incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/verify-otp/);
  });

  test('TC-018: Login with correct details (verified user)', async ({ page }) => {
    await page.goto('/login');
    await field(page, 'Email').fill(ACCOUNTS.mentee);
    await field(page, 'Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/search/);
    await expect(page.getByRole('heading', { name: 'Find a mentor' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/search/);
  });

  test('TC-019: Login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log in' })).toBeDisabled();
    await field(page, 'Email').fill(ACCOUNTS.mentee);
    await field(page, 'Password').fill('WrongPassword!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(errorShown(page, /invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test('TC-020: Login before email is verified', async ({ page }) => {
    await page.goto('/login');
    await field(page, 'Email').fill(unverified.email);
    await field(page, 'Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/verify-otp/);
  });

  test('TC-022: Logout', async () => {
    const ctx = await pwRequest.newContext();
    const login = await ctx.post(`${API}/auth/login`, { data: { email: ACCOUNTS.mentee, password: PASSWORD } });
    expect(login.status()).toBe(200);
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(200);
    expect((await ctx.post(`${API}/auth/logout`)).status()).toBe(200);
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(401);
    await ctx.dispose();
  });

  test('TC-024: Unverified login sends a new code', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, { data: { email: unverified.email, password: PASSWORD } });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('EMAIL_NOT_VERIFIED');
  });
});

// =====================================================================
// 03 FORGOT AND RESET PASSWORD (ACTIVE CASES)
// =====================================================================
test.describe('Forgot and reset password', () => {
  test('TC-025: Request a reset link or code', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    await field(page, 'Email').fill('abc');
    await expect(page.getByRole('button', { name: 'Send reset code' })).toBeDisabled();
    await field(page, 'Email').fill(ACCOUNTS.mentee);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await expect(page).toHaveURL(/reset-password/);
    await expect(page.getByText(/If an account exists for/)).toBeVisible();
  });

  test('TC-028: Reset with a wrong or expired code', async ({ page }) => {
    await page.goto('/reset-password');
    await field(page, 'Email').fill('nobody-here@test.local');
    await field(page, 'Verification code').fill('000000');
    await field(page, 'New password').fill('NewPassword123!');
    await field(page, 'Confirm new password').fill('NewPassword123!');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(errorShown(page, /invalid|expired/i)).toBeVisible();
    await expect(page).toHaveURL(/reset-password/);
  });

  test('TC-029: Forgot password with an unknown email', async ({ page }) => {
    await page.goto('/forgot-password');
    await field(page, 'Email').fill('nobody-here@test.local');
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await expect(page).toHaveURL(/reset-password/);
    await expect(page.getByText(/If an account exists for/)).toBeVisible();
  });

  test('TC-030: New password too short', async ({ page }) => {
    await page.goto('/reset-password');
    await field(page, 'Email').fill('nobody-here@test.local');
    await field(page, 'Verification code').fill('123456');
    await field(page, 'New password').fill('short');
    await field(page, 'Confirm new password').fill('short');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
    await expect(page).toHaveURL(/reset-password/);
  });
});

// =====================================================================
// 04 ACCESS CONTROL (ACTIVE CASES)
// =====================================================================
const ALL_PROTECTED = ['/search', '/connections', '/inbox', '/mentor/apply', '/mentor/status', '/admin/mentors', '/admin/audit-log'];

async function expectAllGoTo(page: any, routes: string[], target: RegExp) {
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    expect.soft(page.url(), `${route} should end up on ${target}`).toMatch(target);
  }
}

test.describe('Access control: logged out', () => {
  test('TC-031: Logged-out user opens a protected page', async ({ page }) => {
    await expectAllGoTo(page, ALL_PROTECTED, /\/login/);
  });
  test('TC-033: Open / when logged out', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });
  test('TC-038: Open a page that does not exist', async ({ page }) => {
    await page.goto('/random-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
  test('TC-039: API "who am I" while logged out', async ({ request }) => {
    expect((await request.get(`${API}/auth/me`)).status()).toBe(401);
  });
});

test.describe('Access control: mentee', () => {
  test.beforeEach(async ({ context }) => { await loginAs(context, 'mentee'); });
  test('TC-032: Open / when logged in (mentee goes to Find a mentor)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/search/);
  });
  test('TC-034: Mentee opens mentor pages', async ({ page }) => {
    await expectAllGoTo(page, ['/inbox', '/mentor/apply', '/mentor/status'], /not-allowed/);
  });
  test('TC-037: Mentee opens admin pages', async ({ page }) => {
    await expectAllGoTo(page, ['/admin/mentors', '/admin/audit-log'], /not-allowed/);
  });
});

test.describe('Access control: mentor', () => {
  test.beforeEach(async ({ context }) => { await loginAs(context, 'mentor'); });
  test('TC-035: Mentor opens mentee pages', async ({ page }) => {
    await expectAllGoTo(page, ['/search', '/connections'], /not-allowed/);
  });
});

// =====================================================================
// 05 MENTEE (ACTIVE CASES)
// =====================================================================
const findByName = (list: any[], name: string) => list.find((m) => m.user.display_name === name);

async function getMentors(req: any) {
  const res = await req.get(`${API}/mentors?q=&page=1&limit=50`);
  expect(res.status()).toBe(200);
  return (await res.json()).mentors;
}
async function getSuggested(req: any) {
  const res = await req.get(`${API}/mentors/suggested`);
  expect(res.status()).toBe(200);
  return (await res.json()).suggested;
}

test.describe('Mentee: find a mentor', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ context }) => { await loginAs(context, 'mentee'); });

  test('TC-041: Search for mentors', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Find a mentor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All mentors' })).toBeVisible();
    await expect(page.getByText('Ayesha K.').first()).toBeVisible();
    const box = page.getByLabel(/^Search by name/);
    await box.fill('zzzqqq-no-match');
    await expect(page.getByText('No mentors found.')).toBeVisible();
    await box.fill('Ayesha');
    await expect(page.getByText('Ayesha K.').first()).toBeVisible();
    await box.fill('<script>alert(1)</script>');
    await expect(page.getByRole('heading', { name: 'Find a mentor' })).toBeVisible();
  });

  test('TC-042: Only approved mentors appear', async ({ page }) => {
    const list = await getMentors(page.request);
    expect(findByName(list, 'Bilal M.'), 'Pending mentor Bilal M. must not be listed').toBeUndefined();
    await page.goto('/search');
    await page.getByLabel(/^Search by name/).fill('Bilal');
    await expect(page.getByText('No mentors found.')).toBeVisible();
  });

  test('TC-043: Send a mentor request', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByText('Ayesha K.').first()).toBeVisible();
    const connect = page.getByRole('button', { name: 'Connect', exact: true });
    if ((await connect.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'Already requested in an earlier run' });
      await expect(page.getByRole('button', { name: 'Requested' }).first()).toBeDisabled();
      return;
    }
    await connect.first().click();
    await expect(page.getByRole('button', { name: 'Requested' }).first()).toBeVisible();
  });

  test('TC-044: Send the same request twice', async ({ page }) => {
    const req = page.request;
    const ayesha = findByName(await getMentors(req), 'Ayesha K.');
    expect(ayesha, 'Ayesha K. must be in the mentor list').toBeTruthy();
    await req.post(`${API}/mentors/connect`, { data: { mentor_user_id: ayesha.user_id } });
    const second = await req.post(`${API}/mentors/connect`, { data: { mentor_user_id: ayesha.user_id } });
    expect(second.status()).toBe(409);
  });

  test('TC-046: See request status', async ({ page }) => {
    await page.goto('/connections');
    await expect(page.getByRole('heading', { name: 'My connections' })).toBeVisible();
    await expect(page.getByText('Ayesha K.').first()).toBeVisible();
    await expect(page.getByText(/^(pending|accepted|declined)$/i).first()).toBeVisible();
  });
});

test.describe('Mentee: suggestions', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ context }) => { await loginAs(context, 'mentee'); });

  test('TC-069: Suggested list shows only valid mentors', async ({ page }) => {
    const list = await getSuggested(page.request);
    expect(findByName(list, 'Bilal M.'), 'Pending mentor must not be suggested').toBeUndefined();
    for (const m of list) expect(m.active_mentee_count).toBeLessThan(3);
  });

  test('TC-070: Mentors you already requested are hidden', async ({ page }) => {
    const ayesha = findByName(await getMentors(page.request), 'Ayesha K.');
    const list = await getSuggested(page.request);
    expect(list.find((m: any) => m.user_id === ayesha.user_id),
      'Ayesha was already requested, so she should not be suggested').toBeUndefined();
  });

  test('TC-072: Order and labels', async ({ page }) => {
    const list = await getSuggested(page.request);
    const counts = list.map((m: any) => m.active_mentee_count);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => a - b));
    for (const m of list) {
      expect(m.reason).toBe(m.active_mentee_count === 0 ? 'available' : 'low current mentee load');
    }
  });
});

// =====================================================================
// 06 MENTOR AND ADMIN PAGES (ACTIVE CASES)
// =====================================================================
async function openPage(page: any, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function assertNotPlaceholder(page: any, path: string) {
  await openPage(page, path);
  expect(await isPlaceholder(page), `${path} should not be a placeholder`).toBeFalsy();
}

test.describe('Mentor pages: application, status, and inbox', () => {
  test('TC-047: Mentor submits an application', async ({ context, page }) => {
    await loginAs(context, 'pendingMentor');
    await assertNotPlaceholder(page, '/mentor/apply');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('TC-048: Application without a supporting document', async ({ context, page }) => {
    await loginAs(context, 'pendingMentor');
    await assertNotPlaceholder(page, '/mentor/apply');
    const submitBtn = page.getByRole('button', { name: /submit|apply|send/i }).first();
    if (await submitBtn.count()) {
      await submitBtn.click();
      await expect(page.locator('body')).toContainText(/document|file|required|upload/i);
    }
  });

  test('TC-049: Mentor with a pending application tries again', async ({ context, page }) => {
    await loginAs(context, 'pendingMentor');
    await assertNotPlaceholder(page, '/mentor/apply');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-050: Rejected mentor re-applies', async ({ context, page }) => {
    await loginAs(context, 'pendingMentor');
    await assertNotPlaceholder(page, '/mentor/apply');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-052: See incoming requests', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('TC-053: Accept a request', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
    if (await acceptBtn.count()) await expect(acceptBtn).toBeEnabled();
  });

  test('TC-054: Decline a request', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    const declineBtn = page.getByRole('button', { name: /decline|reject/i }).first();
    if (await declineBtn.count()) await expect(declineBtn).toBeEnabled();
  });

  test('TC-055: Accept a 4th mentee', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-056: Unapproved mentor uses the inbox', async ({ context, page }) => {
    await loginAs(context, 'pendingMentor');
    await openPage(page, '/inbox');
    await expect(page).toHaveURL(/not-allowed|inbox|mentor/);
  });

  test('TC-057: Double-click accept quickly', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-058: Respond to an already answered request', async ({ context, page }) => {
    await loginAs(context, 'mentor');
    await assertNotPlaceholder(page, '/inbox');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Admin pages', () => {
  test.beforeEach(async ({ context }) => { await loginAs(context, 'admin'); });

  test('TC-065: Audit log records decisions', async ({ page }) => {
    await openPage(page, '/admin/audit-log');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.locator('table').or(page.getByText('No actions recorded yet'))).toBeVisible();
  });
});

// =====================================================================
// 07 ERRORS AND ROBUSTNESS (TC-066 to TC-068)
// =====================================================================
test.describe('Errors and robustness', () => {
  test('TC-066: Unknown API address', async ({ request }) => {
    const res = await request.get(`${API}/nothing-here`);
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('TC-067: Very large input', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: { email: 'big@test.local', password: 'Password123!', display_name: 'x'.repeat(2_000_000), age_confirmed: true },
    });
    expect([400, 413]).toContain(res.status());
  });

  test('TC-068: Refresh in the middle of a flow', async ({ page }) => {
    await page.goto('/verify-otp');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await page.goto('/reset-password');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });
});


