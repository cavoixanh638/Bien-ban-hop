// Deterministic IndexedDB-like transactional fake for Node tests.
// Models asynchronous IDBRequests, transaction serialization, abort and close/reopen.
// Not a substitute for a real browser IndexedDB implementation.
const copy = value => JSON.parse(JSON.stringify(value));
const keyFields={meetings:'meetingId',notes:'noteDocumentId',journals:'journalId'};
export function createFakeIndexedDB({commitDelayMs=3,seed={}}={}) {
  const dbs=new Map();
  let nextCommitFailure=null;
  const ensure=name=>{
    if(!dbs.has(name))dbs.set(name,{stores:new Map(Object.entries(seed).map(([key,values])=>[key,new Map(values.map(v=>[v[keyFields[key]],copy(v)]))])),queue:[],active:null});
    return dbs.get(name);
  };
  const open=(name,version=1)=>{
    const request={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
    setTimeout(()=>{
      const state=ensure(name);
      let closed=false;
      request.result={
        objectStoreNames:{contains:s=>state.stores.has(s)},
        createObjectStore:(s,{keyPath})=>{if(!state.stores.has(s))state.stores.set(s,new Map());return {keyPath};},
        close:()=>{closed=true;},
        transaction:(stores,mode)=>{
          if(closed)throw new Error('InvalidStateError: database closed');
          const names=Array.isArray(stores)?stores:[stores];
          for(const s of names)if(!state.stores.has(s))throw new Error('NotFoundError: '+s);
          const tx={oncomplete:null,onabort:null,onerror:null,error:null};
          let snapshot=null,aborted=false,finished=false,started=false,busy=false;
          const requests=[];
          const schedule=()=>setTimeout(()=>{
            if(!started||finished||aborted)return;
            if(requests.length){
              const next=requests.shift();busy=true;
              setTimeout(()=>{
                if(aborted)return;
                try{
                  next.req.result=next.job();
                  next.req.onsuccess?.({target:next.req});
                }catch(e){
                  next.req.error=e;
                  next.req.onerror?.({target:next.req});
                  abort(e);return;
                }finally{busy=false;}
                schedule();
              },0);
            }else if(!busy){
              const failure=mode==='readwrite'?nextCommitFailure:null;
              if(failure){nextCommitFailure=null;abort(new Error(failure));return;}
              finished=true;
              if(mode==='readwrite')state.stores=snapshot;
              tx.oncomplete?.({target:tx});
              state.active=null;
              startNext();
            }
          },commitDelayMs);
          const abort=(reason)=>{
            if(aborted||finished)return;
            aborted=true;finished=true;tx.error=reason||new Error('AbortError');
            tx.onabort?.({target:tx});
            if(state.active===tx){state.active=null;startNext();}
            else state.queue=state.queue.filter(t=>t!==tx);
          };
          tx.abort=()=>abort(new Error('AbortError'));
          const start=()=>{
            if(aborted||finished)return;
            state.active=tx;started=true;
            snapshot=new Map([...state.stores].map(([name,values])=>[name,new Map([...values].map(([k,v])=>[k,copy(v)]))]));
            schedule();
          };
          tx._start=start;
          tx.objectStore=(s)=>{
            if(!names.includes(s))throw new Error('NotFoundError: Store is outside transaction: '+s);
            const req=job=>{
              if(finished)throw new Error('TransactionInactiveError');
              const request={result:null,error:null,onsuccess:null,onerror:null};
              requests.push({req:request,job});return request;
            };
            return {
              get:k=>req(()=>copy(snapshot.get(s).get(k)??null)),
              getAll:()=>req(()=>[...snapshot.get(s).values()].map(copy)),
              put:v=>req(()=>{
                if(mode!=='readwrite')throw new Error('ReadOnlyError');
                const key=v[keyFields[s]];
                if(key===undefined)throw new Error('DataError: missing key');
                snapshot.get(s).set(key,copy(v));return key;
              }),
              delete:k=>req(()=>{if(mode!=='readwrite')throw new Error('ReadOnlyError');snapshot.get(s).delete(k);})
            };
          };
          state.queue.push(tx);startNext();return tx;
        }
      };
      function startNext(){if(state.active||!state.queue.length)return;const candidate=state.queue.shift();candidate._start();}
      // An existing database may lack stores from a legacy version. Upgrades are non-destructive.
      if(version>=1 && Object.keys(keyFields).some(s=>!state.stores.has(s)))request.onupgradeneeded?.({target:request});
      request.onsuccess?.({target:request});
    },0);
    return request;
  };
  return {open,failNextCommit:(message='QuotaExceededError')=>{nextCommitFailure=message;},
    inspect:name=>{const state=ensure(name);return Object.fromEntries([...state.stores].map(([s,values])=>[s,[...values.values()].map(copy)]));},
    simulateCrash:name=>{const state=ensure(name);state.active?.abort?.();}
  };
}
