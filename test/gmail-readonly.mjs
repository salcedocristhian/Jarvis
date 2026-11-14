import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const src = await readFile(new URL("../public/gmail-readonly.js",import.meta.url),"utf8");
const html = await readFile(new URL("../index.html",import.meta.url),"utf8");
assert.ok(html.includes('src="./public/gmail-readonly.js"'));
assert.ok(html.includes('id="gmailConnect"'));
assert.ok(html.includes('gmail_read: agentGmailRead'));
assert.ok(html.includes('clientTools: { jobtread_read: agentJobTreadRead, gmail_read: agentGmailRead }'));
assert.ok(!src.includes("localStorage.setItem"));
assert.ok(!src.includes("localStorage.getItem"));
assert.ok(!src.includes("refresh_token"));
assert.ok(!src.includes("https://www.googleapis.com/auth/gmail.modify"));
let callback = null, oauthCalls=0, revoked=false;
const fetchCalls=[];
const ctx = {
 console, Promise, Date, String, Number, RegExp, Object, TextDecoder, atob: data => Buffer.from(data, "base64").toString("binary"),
 google:{accounts:{oauth2:{
    initTokenClient(config) {
      assert.equal(config.scope,"https://www.googleapis.com/auth/gmail.readonly");
      callback=config.callback;
      return {requestAccessToken(options) {
        oauthCalls++;
        assert.equal(options.prompt,"consent");
        callback({access_token:"TEST_TOKEN_NOT_REAL",expires_in:3600});
      }};
    },
    revoke(token,cb) {revoked=true;assert.equal(token,"TEST_TOKEN_NOT_REAL"); cb?.();}
 }}},
 fetch:async (url,opts)=>{
   fetchCalls.push({url,opts});
   assert.equal(opts.headers.Authorization,"Bearer TEST_TOKEN_NOT_REAL");
   if(url.includes("/messages?"))return {ok:true,json:async()=>({messages:[{id:"M01"}],resultSizeEstimate:9,nextPageToken:"PAGE_2"})};
   if(url.includes("messages/M01?format=full"))return {ok:true,json:async()=>({id:"M01",payload:{mimeType:"text/plain",body:{data:Buffer.from("Hello from Gmail").toString("base64url")},headers:[{name:"Subject",value:"Reporte semanal"},{name:"From",value:"test@example.com"}]}})};
   if(url.includes("messages/M01"))return {ok:true,json:async()=>({
       id:"M01",threadId:"T1",snippet:"Coordinación semanal",
       payload:{headers:[{name:"Subject",value:"Reporte semanal"},
       {name:"From",value:"Contratista <test@example.com>"},{name:"Date",value:"Fri Nov 13"}]},
       labelIds:["UNREAD"]
   })};
   throw Error("unexpected request "+url);
 }
};
vm.runInNewContext(src,ctx);
const gmail=ctx.JarvisGmail;
assert.equal(gmail.connected,false);
assert.equal(gmail.isClientId("not-an-id"),false);
await assert.rejects(gmail.connect("not-an-id"),/Client ID/);
await assert.rejects(gmail.messages(),/no está autorizado/);
const res=await gmail.connect("123456789-abc.apps.googleusercontent.com");
assert.equal(res.connected,true);
assert.equal(gmail.connected,true);
assert.equal(oauthCalls,1);
const got=await gmail.messages("in:inbox is:unread",5);
assert.equal(got.messages.length,1);
assert.equal(got.messages[0].subject,"Reporte semanal");
assert.equal(got.messages[0].unread,true);
assert.equal(got.countEstimate,9);
assert.equal(got.nextPageToken,"PAGE_2");
const full = await gmail.readMessage("M01");
assert.equal(full.subject, "Reporte semanal");
assert.equal(full.body, "Hello from Gmail");
await gmail.messages("in:inbox",20,"PAGE_2");
assert.ok(fetchCalls.some(x=>x.url.includes("pageToken=PAGE_2")));
assert.ok(fetchCalls[0].url.includes("is%3Aunread"));
const rootSrc=html;
const idx=rootSrc.indexOf("function gmailSearchForQuestion(");
const end=rootSrc.indexOf("async function agentGmailRead(",idx);
assert.ok(idx>0&&end>idx);
const searchFn = new Function(rootSrc.slice(idx,end)+"; return gmailSearchForQuestion;")();
assert.equal(searchFn("Busca un email de Lembos"),"from:Lembos");
assert.equal(searchFn("Muéstrame todos mis correos"),"in:anywhere");
assert.equal(searchFn("Emails sin leer"),"in:inbox is:unread");
gmail.disconnect(); assert.equal(gmail.connected,false); assert.equal(revoked,true);
console.log("✓ Gmail OAuth: no passwords/secrets, in-memory token, restricted read-only, messages metadata, revoke");
