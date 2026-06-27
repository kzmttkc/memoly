import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('/Users/takeshi/Memoly/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const URL=env.NEXT_PUBLIC_SUPABASE_URL, ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SR=env.SUPABASE_SERVICE_ROLE_KEY
const REF=URL.match(/https:\/\/([^.]+)\./)[1], BASE='https://memoly-chat.vercel.app'
const email=`insv_${Date.now()}@example.com`, password='Test!verify12345'
const admin=createClient(URL,SR,{auth:{persistSession:false}})
const cookieH=s=>{const raw='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const n=`sb-${REF}-auth-token`;if(raw.length<=3180)return `${n}=${raw}`;const p=[];for(let i=0,k=0;i<raw.length;i+=3180,k++)p.push(`${n}.${k}=${raw.slice(i,i+3180)}`);return p.join('; ')}
const post=(path,cookie,body)=>fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)})
let uid
try{
  const {data:cu,error:ce}=await admin.auth.admin.createUser({email,password,email_confirm:true}); if(ce)throw new Error(ce.message); uid=cu.user.id
  const {data:si}=await createClient(URL,ANON,{auth:{persistSession:false}}).auth.signInWithPassword({email,password})
  const cookie=cookieH(si.session)
  const cj=await (await post('/api/company',cookie,{name:'検証製造K.K.',seats:5})).json()
  const companyId=cj.company?.companyId; console.log('company:',companyId?'OK':JSON.stringify(cj))
  for(const [key,value] of [['業種','製造業'],['従業員数','8名'],['36協定','未締結'],['雇用形態','正社員5名・パート3名'],['課題','非正規の処遇改善を検討中']])
    await post('/api/company/profile',cookie,{companyId,key,value})
  for(let i=1;i<=3;i++){
    const t0=Date.now(); const r=await post('/api/company/insights',cookie,{companyId}); const ms=Date.now()-t0
    const j=await r.json().catch(()=>({}))
    console.log(`run${i}: HTTP ${r.status} ${ms}ms  subsidiesSource=${j.subsidiesSource}  subsidies=${(j.subsidies||[]).length}  lawChanges=${(j.lawChanges||[]).length}`)
    if(i===1 && j.subsidies?.[0]) console.log('  sample subsidy:', JSON.stringify(j.subsidies[0]).slice(0,200))
  }
}catch(e){console.error('ERROR:',e.message)}finally{if(uid){await admin.auth.admin.deleteUser(uid);console.log('[cleanup] deleted')}}
