import {BotAdapter} from './bot-adapter.js';
export class DemoController {
  constructor({rpc,onView,onThinking,onRecommendation,onResult,onError,delay=350,bot=new BotAdapter()}){
    Object.assign(this,{rpc,onView,onThinking,onRecommendation,onResult,onError,delay,bot});
    this.generation=0;this.view=null;this.busy=false;this.timer=null;this.release=null;
  }
  cancel(){
    this.generation++;this.bot.dispose();clearTimeout(this.timer);this.release?.();this.release=null;
    this.view=null;this.busy=false;
  }
  async begin(){
    this.cancel();const g=this.generation;this.busy=true;this.onThinking();
    try{const view=await this.rpc('demo-start');if(g!==this.generation)return;
      this.view=view;this.onView(view);this.busy=false;await this.next();
    }catch(e){if(g===this.generation){this.busy=false;this.onError(e);}}
  }
  async seek(index){
    if(this.busy||!this.view)return;
    const g=this.generation;this.busy=true;
    try{const view=await this.rpc('demo-seek',{index});if(g!==this.generation)return;
      this.view=view;this.busy=false;this.onView(view);
    }catch(e){if(g===this.generation){this.busy=false;this.onError(e);}}
  }
  async next(){
    if(this.busy||!this.view)return;
    if(this.view.index<this.view.total)return this.seek(this.view.index+1);
    if(this.view.stopped)return;
    const g=this.generation;this.busy=true;this.onThinking();
    try{
      for(let actions=0;actions<2;actions++){
        const revision=this.view.revision;
        let result;
        for(let candidateIndex=0;;){
          result=await this.bot.analyze(this.view.visible,{candidateIndex});if(g!==this.generation)return;
          try{await this.rpc('demo-prepare',{result,revision});break;}
          catch(error){if(g!==this.generation)return;
            candidateIndex=(result.candidateIndex??candidateIndex)+1;
            if(candidateIndex>=result.candidateCount)throw error;}
        }
        if(g!==this.generation)return;
        this.onRecommendation(result);
        if(result.action.kind==='place')await new Promise(resolve=>{this.release=resolve;this.timer=setTimeout(resolve,this.delay);});
        this.release=null;if(g!==this.generation)return;
        const view=await this.rpc('demo-commit',{revision});if(g!==this.generation)return;
        this.view=view;this.onView(view);
        if(result.action.kind==='place'){
          this.busy=false;this.onView(view);this.onResult(result);return;
        }
        if(view.stopped)throw new Error('Hold 後分支已結束。');
      }
      throw new Error('Hold 後沒有得到落子，請重試。');
    }catch(e){if(g===this.generation){this.busy=false;this.onView(this.view);this.onError(e);}}
  }
}
