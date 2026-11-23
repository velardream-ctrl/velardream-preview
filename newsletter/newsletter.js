/* RUN-219 — public subscription wiring. No collection of email on GitHub Pages.
 * Brevo hosts the form and tracks confirmed consent/unsubscribes. No frontend API key.
 * Fail-closed unless both double opt-in and privacy notice were verified by owner.
 */
(function(){
  'use strict';
  var cfg=window.VELAR_NEWSLETTER_CONFIG||{};
  var pending=document.getElementById('pending');
  var area=document.getElementById('form-area');
  var frame=document.getElementById('signup-iframe');
  var link=document.getElementById('open-form');
  var privacyWrap=document.getElementById('privacy-area');
  var privacyLink=document.getElementById('privacy-link');
  function approvedFormUrl(raw){
    if(typeof raw!=='string'||raw.length>2048)return null;
    try{
      var u=new URL(raw);
      if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
      var host=u.hostname.toLowerCase();
      if(!(host==='sibforms.com'||host.endsWith('.sibforms.com')))return null;
      if(u.pathname.indexOf('/serve/')!==0||u.pathname.length<15)return null;
      if(!/^\/[A-Za-z0-9/_-]+$/.test(u.pathname))return null;
      if(u.search)return null;
      return u.href;
    }catch(e){return null;}
  }
  function approvedPrivacyUrl(raw){
    if(typeof raw!=='string'||!raw||raw.length>1024)return null;
    try{
      var u=new URL(raw,window.location.href);
      if(u.protocol!=='https:'||u.origin!==window.location.origin||u.username||u.password)return null;
      if(u.pathname.indexOf('/velardream-preview/')<0)return null;
      return u.href;
    }catch(e){return null;}
  }
  var url=approvedFormUrl(cfg.hostedFormUrl);
  var privacy=approvedPrivacyUrl(cfg.privacyUrl);
  var ready=(cfg.enabled===true&&cfg.doubleOptInVerified===true&&
    cfg.privacyNoticeApproved===true&&url!==null&&privacy!==null);
  if(!ready){pending.hidden=false;area.hidden=true;privacyWrap.hidden=true;return;}
  // All contact collection happens inside provider-hosted form only.
  frame.src=url;
  link.href=url;link.hidden=false;
  privacyLink.href=privacy;privacyWrap.hidden=false;
  pending.hidden=true;area.hidden=false;
})();
