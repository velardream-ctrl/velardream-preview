/* RUN-219: newsletter signup activation. Fail closed until verified double opt-in and privacy documents.
   This file never collects email addresses or performs API calls. The hosted form handles submissions.
*/
(function(){
  'use strict';
  var cfg=window.VELAR_CLUB_CONFIG||{};
  var link=document.getElementById('signup-link');
  var pending=document.getElementById('signup-pending');
  var privacy=document.getElementById('signup-privacy');
  function isApprovedSignupUrl(value){
    if(typeof value!=='string'||value.length>2048)return false;
    try{
      var url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
      var host=url.hostname.toLowerCase();
      return (host==='sibforms.com'||host.endsWith('.sibforms.com')) &&
        /^\/serve\//.test(url.pathname);
    }catch(error){return false;}
  }
  // Do not activate until an owner has configured the *confirmed* Brevo form,
  // a visible privacy notice and a working unsubscribe mechanism.
  if(cfg.enabled!==true||cfg.privacyNoticeReady!==true||!isApprovedSignupUrl(cfg.signupUrl)){
    link.hidden=true;
    pending.hidden=false;
    return;
  }
  link.href=cfg.signupUrl;
  link.hidden=false;
  pending.hidden=true;
  privacy.textContent='Подписка оформляется в защищённой форме Brevo. Требуется подтверждение email; отписка доступна через ссылку в каждом письме. Членство и согласие на маркетинговую рассылку оформляются отдельно.';
})();
