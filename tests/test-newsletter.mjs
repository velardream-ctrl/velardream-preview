// RUN-219: newsletter UI never collects email until provider-hosted DOI and privacy notice are approved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('newsletter/index.html','utf8');
const js=readFileSync('newsletter/newsletter.js','utf8');
const cfg=readFileSync('newsletter/config.js','utf8');
const home=readFileSync('index.html','utf8');
const adminContract=readFileSync('newsletter/ADMIN_INTEGRATION_RU.md','utf8');
new Function('window','document',js);
assert.match(html,/<h1>Новые песни/);
assert.match(html,/id="signup-iframe"/);
assert.match(html,/id="pending"/);
assert.match(html,/id="form-area" hidden/);
assert.doesNotMatch(html,/<input[^>]+type="email"/);
assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bFormData\s*\(/);
assert.match(cfg,/enabled: false/);
assert.match(cfg,/doubleOptInVerified: false/);
assert.match(cfg,/privacyNoticeApproved: false/);
assert.doesNotMatch(home,/href="newsletter\/"/);
assert.doesNotMatch(home,/href="club\/"/);
assert.match(adminContract,/vmm_outreach/);
function simulate(configuration) {
  const nodes={};
  for(const id of ['pending','form-area','signup-iframe','open-form','privacy-area','privacy-link'])
    nodes[id]={hidden:id!=='pending',src:null,href:null};
  const w={location:{href:'https://velardream-ctrl.github.io/velardream-preview/newsletter/',origin:'https://velardream-ctrl.github.io'},VELAR_NEWSLETTER_CONFIG:configuration};
  const d={getElementById(id){return nodes[id]}};
  new Function('window','document','URL',js)(w,d,URL);
  return nodes;
}
const approved={
  enabled:true,doubleOptInVerified:true,privacyNoticeApproved:true,
  hostedFormUrl:'https://sibforms.com/serve/MUIExampleForUnitTest',
  privacyUrl:'/velardream-preview/newsletter/privacy.html'
};
let nodes=simulate(approved);
assert.equal(nodes['form-area'].hidden,false);
assert.equal(nodes['pending'].hidden,true);
assert.equal(nodes['signup-iframe'].src,approved.hostedFormUrl);
nodes=simulate({...approved,enabled:false});
assert.equal(nodes['form-area'].hidden,true);
nodes=simulate({...approved,doubleOptInVerified:false});
assert.equal(nodes['form-area'].hidden,true);
nodes=simulate({...approved,privacyNoticeApproved:false});
assert.equal(nodes['form-area'].hidden,true);
nodes=simulate({...approved,hostedFormUrl:'https://evil.example/steal'});
assert.equal(nodes['form-area'].hidden,true);
nodes=simulate({...approved,privacyUrl:'https://evil.example/legal'});
assert.equal(nodes['form-area'].hidden,true);
console.log('RUN-219: newsletter form security, DOI and privacy gating PASS');
