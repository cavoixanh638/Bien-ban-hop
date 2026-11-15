"""Mốc Họp .mochop ZIP verification PoC, Python standard library only.

Reference staging/restore oracle, NOT the browser production ZIP implementation.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import time
import zipfile

BLOCK=1024*1024
MAX_TOTAL=8*1024**3

class BackupError(ValueError): pass

def safe_path(name):
    if not isinstance(name,str) or not name or '\\' in name or '\x00' in name or name.startswith('/') or re.match(r'^[a-zA-Z]:',name):
        raise BackupError('invalid path')
    if any(part in ('','.', '..') for part in name.split('/')) or any(ord(ch)<32 for ch in name):
        raise BackupError('path traversal/noncanonical path')
    return name

def encoded(obj):
    return json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')

def copy_hash(src,dest):
    h=hashlib.sha256()
    length=0
    while chunk:=src.read(BLOCK):
        dest.write(chunk)
        h.update(chunk)
        length+=len(chunk)
    return length,h.hexdigest()

def validate(meeting,note,audio):
    if any(not isinstance(x,dict) for x in (meeting,note,audio)):
        raise BackupError('JSON object expected')
    if meeting.get('schemaVersion')!=1 or note.get('schemaVersion')!=1:
        raise BackupError('unsupported schema')
    if meeting.get('noteDocumentId')!=note.get('noteDocumentId') or note.get('content',{}).get('type')!='doc':
        raise BackupError('NoteDocument mismatch')
    if audio.get('recordingId') not in meeting.get('recordingIds',[]):
        raise BackupError('recording mismatch')
    ids=set()
    for segment in audio.get('segments',[]):
        if segment['segmentId'] in ids: raise BackupError('duplicate segment')
        ids.add(segment['segmentId'])
        safe_path(segment['filePath'])

def export_archive(source,dest):
    source,dest=Path(source),Path(dest)
    if dest.exists(): raise BackupError('destination exists')
    required=('meeting.json','note.json','audio-manifest.json')
    meeting,note,audio=[json.loads((source/n).read_text('utf-8')) for n in required]
    validate(meeting,note,audio)
    paths=list(required)
    for seg in audio.get('segments',[]):
        name=safe_path(seg['filePath'])
        if not name.startswith('audio/'): raise BackupError('segment outside audio/')
        if name not in paths: paths.append(name)
    manifest={'format':'mochop','formatVersion':1,'schemaVersion':1,
              'appVersion':'poc-07','meetingIds':[meeting['meetingId']],'files':[]}
    fd,tmp=tempfile.mkstemp(prefix='.mochop-',suffix='.tmp',dir=dest.parent)
    os.close(fd)
    t=time.perf_counter()
    try:
        with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
            for name in paths:
                p=source/name
                if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(source.resolve()):
                    raise BackupError('source unavailable/unsafe')
                info=zipfile.ZipInfo(name)
                info.compress_type=zipfile.ZIP_STORED
                info.external_attr=0o600<<16
                with p.open('rb') as inp,z.open(info,'w',force_zip64=True) as out:
                    size,sha=copy_hash(inp,out)
                manifest['files'].append({'path':name,'size':size,'sha256':sha})
            z.writestr('manifest.json',encoded(manifest))
        os.replace(tmp,dest)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
    return {'bytes':dest.stat().st_size,'seconds':time.perf_counter()-t,'files':len(paths)}

def import_archive(archive,repo,allow_missing_audio=False,max_total=MAX_TOTAL,max_ratio=200):
    repo=Path(repo)
    repo.mkdir(parents=True,exist_ok=True)
    t=time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='.mochop-stage-',dir=repo) as staging:
        stage=Path(staging)
        with zipfile.ZipFile(archive,'r',allowZip64=True) as z:
            infos=z.infolist()
            if len(infos)>10000: raise BackupError('entry limit')
            seen=set()
            entries={}
            total=0
            for info in infos:
                name=safe_path(info.filename)
                if name.casefold() in seen: raise BackupError('duplicate/casefold collision')
                seen.add(name.casefold())
                if info.is_dir() or ((info.external_attr>>16)&0o170000)==stat.S_IFLNK:
                    raise BackupError('directory/symlink forbidden')
                total+=info.file_size
                if total>max_total or info.file_size>max(1,info.compress_size)*max_ratio:
                    raise BackupError('ZIP bomb')
                entries[name]=info
            if 'manifest.json' not in entries or entries['manifest.json'].file_size>1024*1024:
                raise BackupError('manifest missing/oversize')
            with z.open('manifest.json') as inp:
                manifest=json.loads(inp.read().decode('utf-8'))
            if (manifest.get('format'),manifest.get('formatVersion'),manifest.get('schemaVersion'))!=('mochop',1,1):
                raise BackupError('unsupported format/schema')
            listed={}
            for item in manifest.get('files',[]):
                name=safe_path(item['path'])
                if name in listed or not isinstance(item.get('size'),int) or item['size']<0 or not re.fullmatch('[0-9a-f]{64}',item.get('sha256','')):
                    raise BackupError('bad file metadata')
                listed[name]=item
            missing=set(listed)-set(entries)
            if missing and (not allow_missing_audio or any(not p.startswith('audio/') for p in missing)):
                raise BackupError('missing required file(s)')
            if set(entries)-set(listed)-{'manifest.json'}:
                raise BackupError('unlisted entry')
            if any(n not in listed for n in ('meeting.json','note.json','audio-manifest.json')):
                raise BackupError('missing metadata declaration')
            for name,item in listed.items():
                if name in missing: continue
                if item['size']!=entries[name].file_size: raise BackupError('size mismatch')
                target=stage/name
                target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(name) as inp,target.open('wb') as out:
                    size,sha=copy_hash(inp,out)
                if size!=item['size'] or sha!=item['sha256']:
                    raise BackupError('SHA256 mismatch: '+name)
        meeting=json.loads((stage/'meeting.json').read_text('utf-8'))
        note=json.loads((stage/'note.json').read_text('utf-8'))
        audio=json.loads((stage/'audio-manifest.json').read_text('utf-8'))
        validate(meeting,note,audio)
        if manifest.get('meetingIds')!=[meeting['meetingId']]:
            raise BackupError('meeting ID mismatch')
        declared={s['filePath'] for s in audio.get('segments',[])}
        if any(name not in listed for name in declared) or any(name not in declared for name in listed if name.startswith('audio/')):
            raise BackupError('audio path mapping mismatch')
        for seg in audio.get('segments',[]):
            if seg['filePath'] in missing:
                seg['completionState']='missing'
                seg['missingReason']='restore_source_missing'
        if missing: (stage/'audio-manifest.json').write_bytes(encoded(audio))
        meeting_id=str(meeting['meetingId'])
        if not re.fullmatch('[A-Za-z0-9_-]{1,128}',meeting_id):
            raise BackupError('unsafe meeting ID')
        target=repo/meeting_id
        if target.exists(): raise BackupError('meeting collision')
        os.replace(stage,target)
        return {'meetingId':meeting_id,'missingAudio':sorted(missing),'seconds':time.perf_counter()-t,'files':len(listed)}

def fixture(dest,byte_count):
    dest=Path(dest)
    if dest.exists(): raise BackupError('fixture exists')
    (dest/'audio').mkdir(parents=True)
    meeting={'meetingId':'meeting-demo','title':'Họp thử tiếng Việt','noteDocumentId':'note-demo','recordingIds':['recording-demo'],'schemaVersion':1}
    mark={'type':'timeSpan','attrs':{'anchorId':'anchor-1','recordingId':'recording-demo','audioOffsetMs':12345,'typedAt':1794740000000,'source':'live_recording','schemaVersion':1}}
    note={'noteDocumentId':'note-demo','revision':3,'schemaVersion':1,'content':{'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'Nội dung cuộc họp và mốc.','marks':[mark]}]}]}}
    audio={'recordingId':'recording-demo','sampleRate':48000,'mappingPoints':[],'segments':[{'segmentId':'segment-1','filePath':'audio/segment-1.pcm','mediaStartMs':0,'mediaDurationMs':60000,'sampleStart':0,'sampleCount':2880000,'completionState':'complete'}],'intervals':[{'meetingStartMs':0,'meetingEndMs':60000,'kind':'recorded','segmentRefs':['segment-1'],'mediaStartMs':0,'mediaEndMs':60000}]}
    for name,obj in (('meeting.json',meeting),('note.json',note),('audio-manifest.json',audio)):
        (dest/name).write_bytes(encoded(obj))
    block=hashlib.shake_256(b'MOC-HOP-SYNTHETIC-AUDIO-FIXTURE').digest(BLOCK)
    with (dest/'audio/segment-1.pcm').open('wb') as f:
        whole,rest=divmod(byte_count,BLOCK)
        for _ in range(whole): f.write(block)
        f.write(block[:rest])

def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest='action',required=True)
    a=sub.add_parser('fixture');a.add_argument('dest');a.add_argument('--bytes',type=int,default=1024*1024)
    a=sub.add_parser('export');a.add_argument('source');a.add_argument('dest')
    a=sub.add_parser('import');a.add_argument('archive');a.add_argument('repo');a.add_argument('--allow-missing-audio',action='store_true')
    args=p.parse_args()
    if args.action=='fixture': fixture(args.dest,args.bytes);result={'fixture':args.dest,'bytes':args.bytes}
    elif args.action=='export': result=export_archive(args.source,args.dest)
    else: result=import_archive(args.archive,args.repo,allow_missing_audio=args.allow_missing_audio)
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__': main()
