/* RUN-219: public configuration. Never store provider API keys, login tokens, or private subscriber data here.
   Before activating: publish a complete privacy notice, verify an email sender, and configure a hosted
   double-opt-in form in Brevo. Keep 'enabled' false until an owner reviews consent and unsubscribe.
*/
window.VELAR_CLUB_CONFIG = Object.freeze({
  enabled: false,
  provider: 'Brevo',
  signupUrl: '',
  privacyNoticeReady: false,
  // Newsletter opt-in is separate from account/club access. No entitlement on the client.
  accessStatus: 'coming-soon'
});
