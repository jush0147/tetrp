// One current replay and its version-bound recovery record: raw bytes are authoritative; view is only a recovery hint.
export const NAME='tetrp-current-replay',VERSION=2,STORE='current',KEY='current';
export class CurrentReplayStore {
  constructor(factory=globalThis.indexedDB){this.factory=factory;this.tail=Promise.resolve();this.record=null;}
  async database(){
    if(!this.factory)throw new Error('IndexedDB unavailable');
    return new Promise((resolve,reject)=>{
      let blocked=false;const request=this.factory.open(NAME,VERSION);
      request.onupgradeneeded=event=>{
        if(event.oldVersion===0)request.result.createObjectStore(STORE);
        else if(event.oldVersion===1){
          // v1 stored view inline with the raw replay. v2 avoids rewriting the raw bytes on seeks.
          const store=request.transaction.objectStore(STORE);
          store.get(KEY).onsuccess=e=>{const row=e.target.result;if(row){
            store.put({id:row.id,view:row.view??null},'view');delete row.view;store.put(row,KEY);
          }};
        }
      };
      request.onerror=()=>reject(request.error);request.onblocked=()=>{blocked=true;reject(new Error('Replay storage upgrade blocked'));};
      request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>db.close();resolve(db);};
    });
  }
  async transaction(mode,action){
    const db=await this.database();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let value;
      tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Replay transaction aborted'));
      action(store,result=>{value=result;},tx);
    });}finally{db.close();}
  }
  queue(action){const result=this.tail.catch(()=>{}).then(action);this.tail=result;return result;}
  async read(){
    const value=await this.transaction('readwrite',(store,done)=>{
      store.get(KEY).onsuccess=e=>{const raw=e.target.result;
        store.get('view').onsuccess=v=>{
          const view=v.target.result?.id===raw?.id?v.target.result?.view:null;
          if(!raw)store.delete('view');
          else if(v.target.result?.id!==raw.id)store.put({id:raw.id,view:null},'view');
          done(raw?{...raw,view}:null);
        };
      };
    });
    if(!value)return null;
    if(value.format!==1||typeof value.id!=='string'||!(value.raw instanceof ArrayBuffer)||typeof value.name!=='string'){
      await this.clear(value.id);return null;
    }
    return value;
  }
  replace(file){
    const record={format:1,id:crypto.randomUUID(),name:file.name,raw:file,view:null};this.record=record;
    return this.queue(async()=>{record.raw=await file.arrayBuffer();if(this.record?.id===record.id)this.record={...this.record,raw:record.raw};await this.transaction('readwrite',store=>{store.put({...record,view:undefined},KEY);store.put({id:record.id,view:null},'view');});});
  }
  view(view){if(this.record)this.record={...this.record,view};}
  flush(){
    const record=this.record;if(!record)return this.tail;
    return this.queue(async()=>{const raw=record.raw instanceof Blob?await record.raw.arrayBuffer():record.raw;return this.transaction('readwrite',(store,done,tx)=>{
      function save(current){
        // A different tab's new file must never acquire this tab's old position.
        if(current&&current.id!==record.id){tx.abort();return;}
        if(!current)store.put({...record,raw,view:undefined},KEY);
        store.put({id:record.id,view:record.view},'view');
      }
      // The ID lives beside the view so ordinary saves do not read/copy the raw bytes.
      store.get('view').onsuccess=e=>{
        if(e.target.result)save(e.target.result);
        else store.get(KEY).onsuccess=rawEvent=>save(rawEvent.target.result);
      };
    });});
  }
  clear(id=this.record?.id){
    this.record=null;
    return this.queue(()=>this.transaction('readwrite',store=>{
      store.get(KEY).onsuccess=e=>{const current=e.target.result;if(current?.id===id||(!id&&(!current||current.format!==1||!(current.raw instanceof ArrayBuffer)))){store.delete(KEY);store.delete('view');}};
    }));
  }
}
