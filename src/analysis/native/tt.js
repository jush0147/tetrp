// Bounded, request-local, full-key checked. Hash collisions are never equality.
export class Transpositions {
  constructor(capacity=32768){
    if(!Number.isInteger(capacity)||capacity<1||(capacity&(capacity-1)))throw new Error('NATIVE_TT_CAPACITY');
    this.capacity=capacity;this.keys=new Array(capacity);this.values=new Float64Array(capacity);
    this.hits=0;this.size=0;
  }
  hash(key){let h=2166136261;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);return h>>>0;}
  dominated(key,reward){
    const start=this.hash(key)&(this.capacity-1);
    for(let j=0;j<8;j++){
      const i=(start+j)&(this.capacity-1),old=this.keys[i];
      if(old===key){this.hits++;if(this.values[i]>=reward)return true;this.values[i]=reward;return false;}
      if(old===undefined){this.keys[i]=key;this.values[i]=reward;this.size++;return false;}
    }
    // Eviction loses a pruning opportunity, not correctness or root identity.
    this.keys[start]=key;this.values[start]=reward;return false;
  }
}
