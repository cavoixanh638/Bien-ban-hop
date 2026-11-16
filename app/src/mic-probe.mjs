/** One-shot microphone check: proves samples arrive, never records or stores sound.
 * A permission prompt may outlive Stop; late-granted tracks are immediately released.
 */
export class MicProbe {
  constructor({onStatus=()=>{},onLevel=()=>{},limitMs=15000}={}){
    this.onStatus=onStatus;this.onLevel=onLevel;this.limitMs=limitMs;
    this.state='idle';this.generation=0;this.signalSeen=false;
  }
  async start(deviceId=''){
    if(this.state!=='idle')return {status:'busy'};
    const generation=++this.generation;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioContext)
      throw Error('Trình duyệt chưa cho phép truy cập micro');
    this.state='requesting';this.onStatus('requesting',{message:'Đang xin quyền micro…'});
    let stream;
    try{
      const constraints={audio:{echoCancellation:false,noiseSuppression:false,
        ...(deviceId?{deviceId:{exact:deviceId}}:{})},video:false};
      stream=await navigator.mediaDevices.getUserMedia(constraints);
      if(this.generation!==generation){for(const t of stream.getTracks())t.stop();return {status:'cancelled'};}
      this.stream=stream;
      this.track=stream.getAudioTracks()[0];
      this.context=new AudioContext();
      await this.context.resume();
      if(this.generation!==generation){await this.stop();return {status:'cancelled'};}
      this.source=this.context.createMediaStreamSource(stream);
      this.analyser=this.context.createAnalyser();
      this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=0.4;
      this.source.connect(this.analyser);
      this.buffer=new Float32Array(this.analyser.fftSize);
      this.state='testing';this.signalSeen=false;this.startedAt=performance.now();
      const name=this.track?.label||'Micro đã được cấp quyền';
      this.onStatus('testing',{message:'Đang nhận tín hiệu từ '+name,deviceLabel:name});
      this.track.onended=()=>{if(this.generation===generation)this.stop('disconnected').catch(()=>{});};
      this.timer=setTimeout(()=>this.stop('completed').catch(()=>{}),this.limitMs);
      const loop=()=>{
        if(this.state!=='testing'||this.generation!==generation)return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        let sum=0,peak=0;
        for(const v of this.buffer){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
        const rms=Math.sqrt(sum/this.buffer.length);
        const dbfs=rms>0?Math.max(-90,20*Math.log10(rms)):-90;
        if(rms>0.006)this.signalSeen=true;
        this.onLevel({rms,peak,dbfs,signalSeen:this.signalSeen,elapsedMs:performance.now()-this.startedAt});
        this.frame=requestAnimationFrame(loop);
      };
      this.frame=requestAnimationFrame(loop);
      return {status:'testing',deviceLabel:name};
    }catch(error){
      if(stream)for(const t of stream.getTracks())try{t.stop();}catch{}
      if(this.generation!==generation)return {status:'cancelled'};
      await this.stop('error');
      this.onStatus('error',{message:error.message});
      throw error;
    }
  }
  async stop(reason='stopped'){
    this.generation++;
    clearTimeout(this.timer);cancelAnimationFrame(this.frame);
    const seen=this.signalSeen;
    const stream=this.stream,context=this.context;
    this.stream=null;this.track=null;this.context=null;this.analyser=null;this.source=null;
    for(const t of stream?.getTracks()??[])try{t.stop();}catch{}
    try{await context?.close();}catch{}
    this.state='idle';
    this.onStatus(reason,{signalSeen:seen});
    return {signalSeen:seen};
  }
}
