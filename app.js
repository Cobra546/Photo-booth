const { createClient } = supabase;
const sb = createClient(window.PHOTO_BOOTH_CONFIG.SUPABASE_URL, window.PHOTO_BOOTH_CONFIG.SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const screens = ['home','create','join','booth','result'];
let role=null, roomCode='', channel=null, pc=null, localStream=null, remoteStream=null;
let iceQueue=[], connected=false, shotIndex=0, shots=[], countdownTimer=null, lastStripBlob=null;
const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

function show(id){screens.forEach(s=>$(s).classList.toggle('active',s===id));}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2200)}
function randomCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join('')}
function setCode(c){roomCode=c.toUpperCase();$('roomCode').textContent=roomCode;$('boothCode').textContent=roomCode}
function resetProgress(){document.querySelectorAll('.shot-dot').forEach((d,i)=>d.classList.toggle('active',i===0));shotIndex=0;shots=[];$('stripImage').removeAttribute('src')}
function updateProgress(){document.querySelectorAll('.shot-dot').forEach((d,i)=>d.classList.toggle('active',i===shotIndex))}

async function getCamera(){
 if(localStream)return localStream;
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API unavailable');
 localStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
 $('localVideo').srcObject=localStream;return localStream;
}
function sendSignal(payload){if(channel)channel.send({type:'broadcast',event:'signal',payload})}
function createPeer(){
 if(pc)pc.close();pc=new RTCPeerConnection(rtcConfig);
 localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));
 pc.ontrack=e=>{$('remoteVideo').srcObject=e.streams[0];remoteStream=e.streams[0];$('remoteWaiting').style.display='none';checkReady()};
 pc.onicecandidate=e=>{if(e.candidate)sendSignal({type:'ice',candidate:e.candidate})};
 pc.onconnectionstatechange=()=>{const s=pc.connectionState;if(s==='connected'){connected=true;$('captureBtn').disabled=false;$('boothStatus').textContent='Both cameras connected • Ready!';$('waitingText').textContent='Connected!'}else if(['failed','disconnected','closed'].includes(s)){connected=false;$('captureBtn').disabled=true;$('boothStatus').textContent='Connection interrupted…'}};
 return pc;
}
function checkReady(){if(remoteStream)$('boothStatus').textContent=connected?'Both cameras connected • Ready!':'Camera connected…'}

async function setupRoom(newRole,code){
 role=newRole;setCode(code);resetProgress();await getCamera();
 channel=sb.channel(`photo-booth-${code}`,{config:{broadcast:{self:false},presence:{key:crypto.randomUUID()}}});
 channel.on('broadcast',{event:'signal'},async({payload})=>{try{await handleSignal(payload)}catch(e){console.error(e)}});
 await channel.subscribe(async status=>{if(status==='SUBSCRIBED'){ $('boothStatus').textContent=role==='host'?'Waiting for your partner to join…':'Connecting to host…';sendSignal({type:'hello',role}) }});
 show('booth');
}
async function handleSignal(m){
 if(!m)return;
 if(m.type==='hello'&&role==='host'&&m.role==='guest'){
  createPeer();const offer=await pc.createOffer();await pc.setLocalDescription(offer);sendSignal({type:'offer',sdp:pc.localDescription});$('boothStatus').textContent='Partner joined • Connecting cameras…';$('waitingText').textContent='Partner joined!';return;
 }
 if(m.type==='offer'&&role==='guest'){createPeer();await pc.setRemoteDescription(m.sdp);for(const c of iceQueue)await pc.addIceCandidate(c);iceQueue=[];const answer=await pc.createAnswer();await pc.setLocalDescription(answer);sendSignal({type:'answer',sdp:pc.localDescription});return}
 if(m.type==='answer'&&role==='host'&&pc){await pc.setRemoteDescription(m.sdp);for(const c of iceQueue)await pc.addIceCandidate(c);iceQueue=[];return}
 if(m.type==='ice'){if(pc?.remoteDescription)await pc.addIceCandidate(m.candidate);else iceQueue.push(m.candidate);return}
 if(m.type==='countdown'&&role==='guest'){runCountdown(m.target);return}
 if(m.type==='shot'&&role==='guest'){shots[m.shot]=m.data;if(shots.filter(Boolean).length===4)finishResult();return}
 if(m.type==='reset'){resetProgress();show('booth');$('boothStatus').textContent='Ready for another session.';$('captureBtn').disabled=!connected}
}
function runCountdown(target){clearInterval(countdownTimer);const el=$('countdown');countdownTimer=setInterval(()=>{const r=Math.max(0,target-Date.now());el.textContent=r>0?Math.ceil(r/1000):'📸';if(r<=0){clearInterval(countdownTimer);setTimeout(()=>el.textContent='',350)}},50)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function startSession(){
 if(!connected||role!=='host'||shotIndex>=4)return;$('captureBtn').disabled=true;
 const target=Date.now()+3200;sendSignal({type:'countdown',shot:shotIndex,target});runCountdown(target);await sleep(3300);
 const data=await captureShot();shots[shotIndex]=data;sendSignal({type:'shot',shot:shotIndex,data});shotIndex++;updateProgress();
 if(shotIndex<4){$('boothStatus').textContent=`Shot ${shotIndex}/4 complete • Get ready!`;await sleep(900);$('captureBtn').disabled=false}else{ $('boothStatus').textContent='Creating your photo strip…';await finishResult() }
}
async function captureShot(){
 const w=620,h=760,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),half=w/2;
 ctx.fillStyle='#111';ctx.fillRect(0,0,w,h);drawVideoCover(ctx,$('localVideo'),0,0,half,h);drawVideoCover(ctx,$('remoteVideo'),half,0,half,h);
 ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(0,h-58,w,58);ctx.fillStyle='#fff';ctx.font='700 16px DM Sans, sans-serif';ctx.textAlign='center';ctx.fillText('YOU',half/2,h-29);ctx.fillText('FRIEND',half+half/2,h-29);
 return canvas.toDataURL('image/jpeg',.62);
}
function drawVideoCover(ctx,video,x,y,w,h){
 if(!video.videoWidth){ctx.fillStyle='#222';ctx.fillRect(x,y,w,h);return}const s=Math.max(w/video.videoWidth,h/video.videoHeight),sw=video.videoWidth*s,sh=video.videoHeight*s,dx=x+(w-sw)/2,dy=y+(h-sh)/2;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(video,dx,dy,sw,sh);ctx.restore();
}
async function finishResult(){
 if(shots.filter(Boolean).length<4)return;const canvas=document.createElement('canvas'),width=620,shotH=760,gap=18,top=74,bottom=92;canvas.width=width;canvas.height=top+(shotH+gap)*4-gap+bottom;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#f7f1e8';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#17131a';ctx.textAlign='center';ctx.font='700 25px Playfair Display, serif';ctx.fillText('OUR PHOTO BOOTH',width/2,45);
 for(let i=0;i<4;i++){const img=new Image();img.src=shots[i];await new Promise(r=>img.onload=r);ctx.drawImage(img,0,top+i*(shotH+gap),width,shotH)}
 ctx.font='600 16px DM Sans, sans-serif';ctx.fillText(new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'}),width/2,canvas.height-48);const data=canvas.toDataURL('image/png');$('stripImage').src=data;lastStripBlob=await(await fetch(data)).blob();show('result')
}
async function copyCode(){try{await navigator.clipboard.writeText(roomCode);toast('Room code copied!')}catch{toast(roomCode)}}
async function shareCode(){const text=`Join my Photo Booth room! Code: ${roomCode}`;if(navigator.share){try{await navigator.share({title:'Photo Booth',text})}catch{}}else copyCode()}
function downloadStrip(){const a=document.createElement('a');a.href=$('stripImage').src;a.download=`photo-booth-${roomCode}.png`;a.click();toast('Photo strip downloaded!')}
async function shareStrip(){if(!lastStripBlob)return;const f=new File([lastStripBlob],`photo-booth-${roomCode}.png`,{type:'image/png'});if(navigator.canShare?.({files:[f]})){try{await navigator.share({title:'Our Photo Booth',text:'Our four-shot memory ❤️',files:[f]})}catch{}}else toast('File sharing is not supported here — download it instead.')}
async function leaveRoom(){
 clearInterval(countdownTimer);if(channel){await sb.removeChannel(channel);channel=null}if(pc){pc.close();pc=null}remoteStream=null;connected=false;iceQueue=[];$('localVideo').srcObject=null;$('remoteVideo').srcObject=null;$('remoteWaiting').style.display='grid';if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}show('home')
}

$('createBtn').onclick=async()=>{try{const code=randomCode();setCode(code);show('create');await setupRoom('host',code)}catch(e){console.error(e);toast('Could not start the room.')}};
$('joinBtn').onclick=()=>{show('join');$('codeInput').focus()};
$('enterRoomBtn').onclick=async()=>{const code=$('codeInput').value.trim().toUpperCase();if(code.length!==6){$('joinError').textContent='Enter a valid 6-character code.';return}$('joinError').textContent='';try{await setupRoom('guest',code)}catch(e){console.error(e);$('joinError').textContent='Could not access your camera.'}};
$('codeInput').addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase());
$('copyCodeBtn').onclick=copyCode;$('shareCodeBtn').onclick=shareCode;$('captureBtn').onclick=startSession;$('leaveBtn').onclick=leaveRoom;$('downloadBtn').onclick=downloadStrip;$('shareBtn').onclick=shareStrip;
$('retakeBtn').onclick=()=>{resetProgress();show('booth');$('boothStatus').textContent='Ready for another session.';$('captureBtn').disabled=!connected;if(channel)sendSignal({type:'reset'})};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show(b.dataset.back));
window.addEventListener('beforeunload',()=>{if(channel)sb.removeChannel(channel);if(pc)pc.close();localStream?.getTracks().forEach(t=>t.stop())});
