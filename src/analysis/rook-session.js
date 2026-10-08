// ROOK runs only against a detached player-visible snapshot. Tetrp owns the
// private generator, replay checkpoint, garbage holes, and every actual action.
// The bot never receives those private authority objects.
import {BotDemo} from './demo.js';
import {chooseMove} from './rook.js';

function exposedView(view){
  // The bot-facing contract is the allowed projection ONLY. Never forward
  // BotDemo's engine, replay history, original sequence, or full viewer state.
  return structuredClone(view.visible);
}

export class RookSession {
  #demo;
  #decide;
  #options;
  constructor(engine,{decide=chooseMove,options={}}={}){
    if(typeof decide!=='function')throw new TypeError('ROOK decision function required');
    this.#demo=new BotDemo(engine);
    this.#decide=decide;
    this.#options={...options};
  }
  view(){return this.#demo.view();}
  seek(index){return this.#demo.seek(index);}
  // A single step ends in one authority-validated lock, possibly preceded
  // by exactly one separately committed Hold and another fresh decision.
  step(){
    let view=this.#demo.view();
    if(view.stopped)throw new Error('ROOK cannot play a finished round');
    const actions=[];
    for(let decisionNo=0;decisionNo<2;decisionNo++){
      const snapshot=exposedView(view);
      if(!Array.isArray(snapshot.next)||snapshot.next.length!==5)
        throw new Error('ROOK requires exactly five visible previews');
      const result=this.#decide(snapshot,{...this.#options});
      if(!result||!['hold','place'].includes(result.kind))
        throw new Error('ROOK did not return an explicit Hold or Place');
      if(result.kind==='hold'){
        if(decisionNo!==0||snapshot.hold.locked)
          throw new Error('ROOK requested a second Hold on the same piece');
        const expectedMode=snapshot.hold.piece===null?'empty':'occupied';
        if(result.mode!==expectedMode)throw new Error('ROOK Hold intent does not match the authority');
        const samePiece=(snapshot.hold.piece??snapshot.next[0])===snapshot.current.type;
        if(result.samePiece!==samePiece||result.requiresReanalysis!==true)
          throw new Error('ROOK Hold must declare same-piece identity and require reanalysis');
        this.#demo.prepare({action:{kind:'hold',mode:expectedMode}},view.revision);
        view=this.#demo.commit(view.revision); // Authority pulls/reveals the piece here.
        if(!view.visible.hold.locked)throw new Error('Tetrp did not lock Hold');
        actions.push({kind:'hold',mode:expectedMode});
        continue; // Fresh, newly visible snapshot; no pre-Hold landing reused.
      }
      this.#demo.prepare({action:{kind:'place'},move:result.move,execution:result.execution},view.revision);
      view=this.#demo.commit(view.revision);
      actions.push({kind:'place',move:result.move,spin:result.execution.spin});
      return {view,actions,decisions:decisionNo+1};
    }
    throw new Error('ROOK Hold was not followed by an executable Place');
  }
}
