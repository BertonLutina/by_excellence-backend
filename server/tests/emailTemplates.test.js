const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFrontendPageUrl,
  resetPasswordEmail,
  verificationEmail,
  autoClientAccountEmail,
} = require('../utils/emailTemplates');

test('auth email links use lowercase BrowserRouter paths on the public site', () => {
  assert.equal(
    buildFrontendPageUrl('https://byexcellence-as.com', 'ResetPassword', { token: 'abc' }),
    'https://byexcellence-as.com/resetpassword?token=abc'
  );
  assert.equal(
    buildFrontendPageUrl('https://www.byexcellence-as.com/', 'VerifyEmail', { token: 'xyz' }),
    'https://www.byexcellence-as.com/verifyemail?token=xyz'
  );
  assert.equal(
    buildFrontendPageUrl('https://byexcellence-as.com', 'Login'),
    'https://byexcellence-as.com/login'
  );
});

test('reset password email does not use PascalCase or HashRouter paths', () => {
  const html = resetPasswordEmail({ full_name: 'Ada', token: 'tok-1' });
  assert.match(html, /\/resetpassword\?token=tok-1/);
  assert.doesNotMatch(html, /\/ResetPassword/);
  assert.doesNotMatch(html, /\/#\/resetpassword/i);
});

test('verification email uses /verifyemail', () => {
  const html = verificationEmail({ full_name: 'Ada', token: 'tok-2' });
  assert.match(html, /\/verifyemail\?token=tok-2/);
  assert.doesNotMatch(html, /\/VerifyEmail/);
});

test('auto-created client account email uses /login without a hash route', () => {
  const html = autoClientAccountEmail({
    full_name: 'Ada',
    email: 'ada@example.com',
    temp_password: 'secret12',
  });
  assert.match(html, /\/login/);
  assert.doesNotMatch(html, /\/#\/login/);
});
