const brandGroups = {
  national: ['civicaNews','The Telegram','StateLine','InsideStory','Caprica Now','The Sentinel'],
  international: ['WorldDesk','GlobalWire','Dispatch','Meridian','WorldView','ForeignAffairs'],
  local: ['regions.news','Caille Times','Montiablo Times','CapitalNow','The Chronicle','LocalGovernment']
};
const brands = Object.values(brandGroups).flat();
const brandBlurbs = {
  'civicaNews':'Flagship national desk for institutions, policy, and public affairs.',
  'The Telegram':'Long-form reporting, political dispatches, and national editions.',
  'StateLine':'State-level government, electoral politics, and federal relations.',
  'InsideStory':'Investigations, profiles, explainers, and insider analysis.',
  'Caprica Now':'Fast national updates, live developments, and breaking alerts.',
  'The Sentinel':'Security, justice, civil order, and institutional coverage.',
  'WorldDesk':'Global affairs from a Caprican perspective.',
  'GlobalWire':'Rapid international newswire and foreign desk bulletins.',
  'Dispatch':'Field reports, conflict monitoring, and diplomatic movements.',
  'Meridian':'Markets, international economy, and regional power coverage.',
  'WorldView':'Analysis, opinion, and world affairs features.',
  'ForeignAffairs':'Diplomacy, foreign ministries, alliances, and strategy.',
  'regions.news':'Aggregated regional coverage across Caprica.',
  'Caille Times':'Capital region politics, culture, transport, and civic life.',
  'Montiablo Times':'Montiablo city desk, local institutions, and public life.',
  'CapitalNow':'City hall, legislature-adjacent coverage, and daily civic updates.',
  'The Chronicle':'Community reporting, public notices, and local features.',
  'LocalGovernment':'Councils, agencies, budgets, planning, and services.'
};
const $ = s => document.querySelector(s);
async function api(path, opts={}){const r=await fetch(path,{headers:{'content-type':'application/json'},...opts}); if(!r.ok) throw new Error((await r.json().catch(()=>({error:r.statusText}))).error); return r.json()}
function nav(){return `<header class="top"><div class="wrap nav"><a class="brand" href="/">Caprica Media Group</a><nav class="navlinks"><a href="/">Front Page</a><a href="/brands.html">Brands</a><a href="/standards.html">Standards</a><a href="/admin.html">Admin</a></nav></div></header>`}
function foot(){return `<footer class="footer"><div class="wrap footer-grid"><div><b>civicaGroup</b><p>Caprica Media Group is a Caprican media and communications company powered by Civica.</p></div><p>The views and opinions expressed by individual publications, contributors, commentators, or guests do not necessarily reflect those of Caprica Media Group, Civica Holdings, or affiliated organisations. Editorial positions remain the responsibility of each publication.</p></div></footer>`}
function brandLink(b, cls='brand-tile'){return `<a class="${cls}" href="/brand.html?brand=${encodeURIComponent(b)}"><strong>${b}</strong><span>${brandBlurbs[b]||'CMG publication'}</span></a>`}
function storyCard(p, cls='story-card'){return `<a class="${cls}" href="/article.html?slug=${p.slug}"><span class="tag">${p.brand} / ${p.category}</span><h3>${p.title}</h3><p>${p.dek||''}</p><span class="meta">${new Date(p.published_at||p.created_at).toLocaleDateString()}</span></a>`}
function placeholderStories(){return [
  {brand:'civicaNews',category:'Network',title:'No published stories yet',dek:'Log in as an admin to publish the first CMG article.',slug:'#',created_at:new Date()},
  {brand:'The Telegram',category:'Analysis',title:'Editorial desks awaiting first edition',dek:'Draft and publish from the admin console to populate the front page.',slug:'#',created_at:new Date()},
  {brand:'WorldDesk',category:'International',title:'International wire ready for publication',dek:'Global coverage will appear here when stories are published.',slug:'#',created_at:new Date()},
  {brand:'regions.news',category:'Local',title:'Regional feeds standing by',dek:'Local brand pages will update automatically from the shared CMS.',slug:'#',created_at:new Date()}
]}
async function renderHome(){
  document.body.insertAdjacentHTML('afterbegin',nav()); $('#foot').innerHTML=foot();
  const d=new Date(); const tl=$('#todayline'); if(tl) tl.textContent=d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('#nationalBrands').innerHTML=brandGroups.national.map(b=>brandLink(b,'mini-brand')).join('');
  $('#internationalBrands').innerHTML=brandGroups.international.map(b=>brandLink(b,'mini-brand')).join('');
  $('#localBrands').innerHTML=brandGroups.local.map(b=>brandLink(b,'mini-brand')).join('');
  let posts=await api('/api/posts').catch(()=>[]); if(!posts.length) posts=placeholderStories();
  const lead=posts[0];
  $('#leadStory').innerHTML=`<a class="lead-card" href="${lead.slug==='#'?'#':'/article.html?slug='+lead.slug}"><span class="tag">${lead.brand} / ${lead.category}</span><h2>${lead.title}</h2><p>${lead.dek}</p><span class="meta">CMG Front Page</span></a>`;
  $('#briefs').innerHTML=posts.slice(1,5).map(p=>`<a class="brief" href="${p.slug==='#'?'#':'/article.html?slug='+p.slug}"><span>${p.brand}</span><strong>${p.title}</strong></a>`).join('');
  $('#latest').innerHTML=posts.slice(0,8).map(p=>storyCard(p)).join('');
}
async function renderBrandsPage(){document.body.insertAdjacentHTML('afterbegin',nav()); $('#foot').innerHTML=foot(); $('#allBrands').innerHTML=Object.entries(brandGroups).map(([k,arr])=>`<section class="directory-section"><h2>${k[0].toUpperCase()+k.slice(1)} News Media Branch</h2><div class="directory-grid">${arr.map(b=>brandLink(b)).join('')}</div></section>`).join('')}
async function renderBrand(){document.body.insertAdjacentHTML('afterbegin',nav()); $('#foot').innerHTML=foot(); const brand=new URLSearchParams(location.search).get('brand')||'civicaNews'; $('#brandName').textContent=brand; const posts=await api('/api/posts?brand='+encodeURIComponent(brand)).catch(()=>[]); $('#posts').innerHTML=posts.map(p=>storyCard(p)).join('')||`<div class="empty-card"><h3>No published stories for ${brand} yet.</h3><p>Stories published from the admin console will appear here.</p></div>`}
async function renderArticle(){document.body.insertAdjacentHTML('afterbegin',nav()); $('#foot').innerHTML=foot(); const slug=new URLSearchParams(location.search).get('slug'); const p=await api('/api/posts/'+slug); $('#article').innerHTML=`<span class="tag">${p.brand} / ${p.category}</span><h1>${p.title}</h1><p class="meta">By ${p.author_email} · ${new Date(p.published_at||p.created_at).toLocaleString()}</p><p class="article-dek">${p.dek}</p><div class="body">${p.body}</div>`}
async function renderAdmin(){document.body.insertAdjacentHTML('afterbegin',nav()); $('#foot').innerHTML=foot(); brands.forEach(b=>$('#brand').insertAdjacentHTML('beforeend',`<option>${b}</option>`)); async function refresh(){const me=await api('/api/auth/me').catch(()=>({user:null})); $('#login').classList.toggle('hidden',!!me.user); $('#dash').classList.toggle('hidden',!me.user); if(me.user){$('#who').textContent=`${me.user.email} / ${me.user.role} / ${me.user.brand}`; const posts=await api('/api/admin/posts').catch(()=>[]); $('#adminPosts').innerHTML=posts.map(p=>`<div class="card"><span class="tag">${p.status} / ${p.brand}</span><h3>${p.title}</h3><p>${p.dek}</p></div>`).join('')}} await refresh(); $('#loginForm').onsubmit=async e=>{e.preventDefault(); await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); refresh()}; $('#postForm').onsubmit=async e=>{e.preventDefault(); await api('/api/admin/posts',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); refresh()}; $('#logout').onclick=async()=>{await api('/api/auth/logout',{method:'POST'}); refresh()}}
