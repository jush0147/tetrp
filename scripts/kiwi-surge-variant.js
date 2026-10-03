import assert from 'node:assert/strict';
export function variant(name='residual') {
 const choices={residual:{boolean:0.5,bank:0.5},'boolean-off':{boolean:0,bank:0.5},'both-one':{boolean:1,bank:1}};
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
 return result;
}
