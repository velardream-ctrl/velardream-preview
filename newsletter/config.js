/* RUN-219 · Newsletter public feature flags. No API keys or email lists in frontend.
 * Publish a verified Brevo DOI form and final privacy notice before enabling.
 * The form itself asks for preferences and records consent. No marketing mailing
 * without the subscriber's opt-in. Membership entitlement is separate.
 */
window.VELAR_NEWSLETTER_CONFIG = Object.freeze({
  enabled: false,
  doubleOptInVerified: false,
  privacyNoticeApproved: false,
  hostedFormUrl: '',
  privacyUrl: '',
  senderDisplayName: 'Velar Dream Records',
  categories: ['Новые песни и альбомы', 'Инструменты для артистов']
});
