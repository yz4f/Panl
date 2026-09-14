let player;
let musicOn = false;
let playerReady = false;
function setToggleState(){const t=document.getElementById('musicToggle');if(!t)return;t.textContent=musicOn?'❚❚':'♫';t.setAttribute('aria-label',musicOn?'إيقاف الموسيقى':'تشغيل الموسيقى')}
function startSiteMusic(){if(!playerReady||!player)return false;try{player.seekTo(38,true);player.setVolume(42);player.unMute();player.playVideo();musicOn=true;setToggleState();return true}catch(_){return false}}
window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('yt',{height:'1',width:'1',videoId:'hqL1w4WqdcY',playerVars:{start:38,autoplay:1,controls:0,loop:1,playlist:'hqL1w4WqdcY',playsinline:1,modestbranding:1,rel:0},events:{onReady:()=>{playerReady=true;player.setVolume(42);startSiteMusic()},onStateChange:(e)=>{if(e.data===YT.PlayerState.PLAYING){musicOn=true;setToggleState()}else if(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.ENDED){musicOn=false;setToggleState()}}}})};
const resumeMusic=()=>{if(!musicOn)startSiteMusic()};['pointerdown','touchstart','keydown','scroll'].forEach(n=>window.addEventListener(n,resumeMusic,{once:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&playerReady&&!musicOn)startSiteMusic()});
const toggle=document.getElementById('musicToggle');if(toggle){toggle.onclick=()=>{if(!playerReady||!player)return;if(musicOn){player.pauseVideo();musicOn=false}else startSiteMusic();setToggleState()}}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(e=>io.observe(e));
const lb=document.getElementById('lightbox'),lbi=document.getElementById('lightboxImg');document.querySelectorAll('.tile img').forEach(img=>{img.onclick=()=>{lbi.src=img.src;lb.classList.add('open');lb.setAttribute('aria-hidden','false')}});document.getElementById('closeLightbox').onclick=()=>{lb.classList.remove('open');lb.setAttribute('aria-hidden','true')};lb.onclick=e=>{if(e.target===lb){lb.classList.remove('open');lb.setAttribute('aria-hidden','true')}};addEventListener('keydown',e=>{if(e.key==='Escape'){lb.classList.remove('open');lb.setAttribute('aria-hidden','true')}});
fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page:location.pathname,referrer:document.referrer})}).catch(()=>{});
