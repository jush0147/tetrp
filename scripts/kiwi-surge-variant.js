import assert from 'node:assert/strict';
export function variant(name='residual') {
 const choices={residual:{boolean:0.5,bank:0.5},'boolean-off':{boolean:0,bank:0.5},'both-one':{boolean:1,bank:1},'clear-off':{boolean:0.5,bank:0,clearOff:true},'btb-clear-off':{boolean:0.5,bank:0,btbClear:0},'btb-clear-double':{boolean:0.5,bank:0,btbClear:2}};
 assert.ok(Object.hasOwn(choices,name),`Unknown Surge variant: ${name}`);
 return Object.freeze({name,...choices[name]});
}
export const VARIANT=variant(process.env.SURGE_VARIANT??'residual');
export function candidateConfig(original,v=VARIANT){
 const result=structuredClone(original);
 assert.equal(result.freestyle_weights.has_back_to_back,0.5);
 assert.equal(result.freestyle_weights.h3_surge_bank_value,0);
 result.freestyle_weights.has_back_to_back=v.boolean;
 result.freestyle_weights.h3_surge_bank_value=v.bank;
 if(v.clearOff)for(const k of ['normal_clears','mini_spin_clears','spin_clears'])result.freestyle_weights[k]=result.freestyle_weights[k].map(()=>0);
 if(v.btbClear!==undefined){assert.equal(result.freestyle_weights.back_to_back_clear,1);result.freestyle_weights.back_to_back_clear=v.btbClear;}
 return result;
}
