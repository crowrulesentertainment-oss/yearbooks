/* CrowRules Universal Membership Client */
window.CrowRulesMembership=(function(){
 const SUPABASE_URL='https://cevylpnoexugwgygvtgu.supabase.co';
 const SUPABASE_KEY='sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-';
 const FUNCTION_URL=SUPABASE_URL+'/functions/v1/membership-status';
 let client=null;
 function init(){
   if(!window.supabase) throw new Error('Supabase JS must be loaded before crowrules-membership.js');
   client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
   return client;
 }
 async function status(){
   if(!client) init();
   const {data:{session}}=await client.auth.getSession();
   if(!session) return {ok:true,authenticated:false,membership:null,sites:[],entitlements:[]};
   const r=await fetch(FUNCTION_URL,{headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY}});
   return await r.json();
 }
 async function ensureCrow(){
   if(!client) init();
   const r=await client.rpc('ensure_crow_membership');
   if(r.error) throw r.error;
   return r.data;
 }
 async function hasAccess(siteKey,minLevel){
   const s=await status();
   if(!s.membership) return false;
   const levels={crow:1,crowner:2,creator:3,founder:4};
   return (levels[s.membership.plan_key]||0)>=(levels[minLevel||'crow']||1);
 }
 return {init,status,ensureCrow,hasAccess};
})();