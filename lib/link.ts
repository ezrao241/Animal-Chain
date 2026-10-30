// How good this device's connection to the room is, measured from its own syncs (app/page.tsx). A weak link polls a
// little less often, asks for the lighter view (lib/net.ts viewFor lite) and gives up on a lost request sooner, so a
// player on bad Wi-Fi or mobile data stays playable instead of freezing for seconds at a time.
export const LINK={
 pollMs:{good:140,fair:180,poor:260},  // time between syncs in a round, from one send to the next
 fairRtt:250,                          // smoothed round trip (ms) above which the link counts as fair
 poorRtt:550,                          // and above which it counts as poor
 lossWindowMs:10000,                   // failed or timed-out syncs this recent count against the link
 poorLosses:2,                         // this many recent losses make it poor (one makes it fair)
 minTimeoutMs:1500,                    // a sync is abandoned and resent after the smoothed round trip plus 4 deviations,
 maxTimeoutMs:5000,                    // kept within these bounds
 recoverMs:4000,                       // a link stays at a worse level at least this long before it may improve
};
export type LinkQuality='good'|'fair'|'poor';

export class LinkMonitor{
 srtt=0;rttvar=0;losses:number[]=[];quality:LinkQuality='good';private since=0;
 /** A sync answered after ms. The first sample sets the estimate; later ones are blended in as TCP does (RFC 6298). */
 sample(ms:number,now=Date.now()){
  if(!(ms>=0))return;
  if(!this.srtt){this.srtt=ms;this.rttvar=ms/2;}else{this.rttvar+=(Math.abs(this.srtt-ms)-this.rttvar)/4;this.srtt+=(ms-this.srtt)/8;}
  this.update(now);
 }
 /** A sync failed or timed out. */
 lost(now=Date.now()){this.losses.push(now);this.update(now);}
 private update(now:number){
  this.losses=this.losses.filter(t=>now-t<LINK.lossWindowMs);
  const n=this.losses.length,want:LinkQuality=this.srtt>LINK.poorRtt||n>=LINK.poorLosses?'poor':this.srtt>LINK.fairRtt||n>0?'fair':'good';
  // worse at once; better only once the link has held up for recoverMs, so it doesn't flicker between levels
  const rank={good:0,fair:1,poor:2};
  if(rank[want]>=rank[this.quality]){this.quality=want;this.since=now;}
  else if(now-this.since>=LINK.recoverMs){this.quality=want;this.since=now;}
 }
 timeoutMs(){return this.srtt?Math.round(Math.min(LINK.maxTimeoutMs,Math.max(LINK.minTimeoutMs,this.srtt+4*this.rttvar))):LINK.maxTimeoutMs;}
 pollMs(){return LINK.pollMs[this.quality];}
 /** Ask the server for the lighter view: fewer details about far-away animals. */
 get lite(){return this.quality==='poor';}
}
