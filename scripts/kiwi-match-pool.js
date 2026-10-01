// Fixed-size independent process-task pool. Stop assigning on technical failure,
// but await in-flight tasks so their results/diagnostics can finish writing.
export async function runMatchPool(tasks,workers,run){
 if(!Number.isInteger(workers)||workers<1||workers>2)throw Error('Expected 1 or 2 match workers');
 let cursor=0,failure=null;const results=new Array(tasks.length);
 async function lane(){while(!failure){const i=cursor++;if(i>=tasks.length)return;
  try{results[i]=await run(tasks[i],i);}catch(e){failure??=e;}
 }}
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},lane));
 if(failure)throw failure;return results;
}
