// Bot-independent viewer interface: detached canonical input, normalized result.
export class BotAdapter {
  constructor(factory=()=>new Worker(new URL('./kiwi-worker.js',import.meta.url),{type:'module'})) {
    this.factory=factory;this.generation=0;this.worker=null;this.pending=null;
  }
  initialize(){
    if(this.worker)return;
    const worker=this.worker=this.factory();
    worker.onmessage=({data:m})=>{
      if(worker!==this.worker||m.id!==this.generation||!this.pending)return;
      const pending=this.pending;this.pending=null;clearTimeout(pending.timer);
      m.error?pending.reject(new Error(m.error)):pending.resolve(m.result);
    };
    worker.onerror=()=>{if(worker===this.worker)this.cancel(new Error('Kiwi Worker 發生錯誤，請重試。'));};
    worker.onmessageerror=()=>{if(worker===this.worker)this.cancel(new Error('Kiwi Worker 回覆無法解碼，請重試。'));};
  }
  analyze(state,{candidateIndex=0}={}){
    if(this.pending)this.cancel();
    this.initialize();const id=++this.generation;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.cancel(new Error('Kiwi 分析超時，請重試或選擇其他位置。')),120000);
      this.pending={resolve,reject,timer};
      try{this.worker.postMessage({id,state,candidateIndex});}catch(error){this.cancel(error);}
    });
  }
  cancel(error=new DOMException('Analysis cancelled','AbortError')){
    ++this.generation;
    if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}
    this.worker?.terminate();this.worker=null;
  }
  dispose(){this.cancel();}
}
