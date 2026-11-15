"""Moc Hop .mochop ZIP reference PoC (Python 3.10+; no external deps).

This is a verification oracle and staging adapter, not a production browser ZIP engine.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import time
import unicodedata
import zipfile

FORMAT = 'mochop'
VERSION = 1
BLOCK = 1024 * 1024
MAX_FILES = 10000
MAX_TOTAL = 8 * 1024 ** 3
MAX_RATIO = 200

class BackupError(ValueError):
    pass


def clean_path(name: str) -> str:
    if not isinstance(name, str) or not name or '\\' in name or '\x00' in name or name.startswith('/') or re.match(r'^[A-Za-z]:', name):
        raise BackupError('invalid path')
    if unicodedata.normalize('NFC', name) != name:
        raise BackupError('noncanonical Unicode path')
    parts = name.split('/')
    if any(part in ('', '.', '..') for part in parts):
        raise BackupError('path traversal or noncanonical path')
    if any(ord(ch) < 32 for ch in name):
        raise BackupError('control character in path')
    return name


def json_bytes(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def digest_copy(src, dst):
    size = 0
    h = hashlib.sha256()
    while True:
        chunk = src.read(BLOCK)
        if not chunk:
            break
        dst.write(chunk)
        h.update(chunk)
        size += len(chunk)
    return size, h.hexdigest()


def export_archive(source: Path, destination: Path, compression=zipfile.ZIP_STORED):
    """source contains meeting.json, note.json, audio-manifest.json, audio/*.
    Writes temp archive in same directory and atomically renames only on success.
    """
    source = Path(source)
    destination = Path(destination)
    if destination.exists():
        raise BackupError('destination already exists')
    required = ('meeting.json', 'note.json', 'audio-manifest.json')
    for name in required:
        if not (source / name).is_file():
            raise BackupError('required source missing: ' + name)
    meeting = json.loads((source / 'meeting.json').read_text('utf-8'))
    note = json.loads((source / 'note.json').read_text('utf-8'))
    audio = json.loads((source / 'audio-manifest.json').read_text('utf-8'))
    validate_contract(meeting, note, audio)
    paths = list(required)
    for seg in audio.get('segments', []):
        path = clean_path(seg['filePath'])
        if not path.startswith('audio/'):
            raise BackupError('segment outside audio/')
        if path not in paths:
            paths.append(path)
    meta = {'format': FORMAT, 'formatVersion': VERSION, 'schemaVersion': 1,
            'appVersion': 'poc-07', 'meetingIds': [meeting['meetingId']],
            'files': []}
    fd, tmp = tempfile.mkstemp(prefix='.mochop-', suffix='.tmp', dir=destination.parent)
    os.close(fd)
    started = time.perf_counter()
    try:
        with zipfile.ZipFile(tmp, 'w', compression=compression, allowZip64=True, strict_timestamps=False) as z:
            for name in paths:
                item = source / name
                if not item.is_file() or item.is_symlink():
                    raise BackupError('source item unavailable: ' + name)
                if not item.resolve().is_relative_to(source.resolve()):
                    raise BackupError('source path escapes root')
                info = zipfile.ZipInfo(name)
                info.compress_type = compression
                info.external_attr = 0o600 << 16
                with item.open('rb') as inp, z.open(info, 'w', force_zip64=True) as out:
                    size, sha = digest_copy(inp, out)
                meta['files'].append({'path': name, 'size': size, 'sha256': sha})
            z.writestr('manifest.json', json_bytes(meta), compress_type=zipfile.ZIP_STORED)
        os.replace(tmp, destination)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return {'bytes': destination.stat().st_size, 'seconds': time.perf_counter()-started, 'files': len(paths), 'manifest': meta}


def validate_contract(meeting, note, audio):
    if not all(isinstance(x, dict) for x in (meeting, note, audio)):
        raise BackupError('invalid JSON object')
    if meeting.get('schemaVersion') != 1 or note.get('schemaVersion') != 1:
        raise BackupError('unsupported schema')
    if note.get('noteDocumentId') != meeting.get('noteDocumentId'):
        raise BackupError('note mismatch')
    if note.get('content', {}).get('type') != 'doc':
        raise BackupError('not a ProseMirror doc')
    if audio.get('recordingId') not in meeting.get('recordingIds', []):
        raise BackupError('recording mismatch')
    ids = set()
    for seg in audio.get('segments', []):
        if seg['segmentId'] in ids:
            raise BackupError('duplicate segment id')
        ids.add(seg['segmentId'])
        clean_path(seg['filePath'])
    # No timestamp rewriting: timeSpan marks must survive verbatim.


def import_archive(archive: Path, repository: Path, *, allow_missing_audio=False,
                   max_total=MAX_TOTAL, max_ratio=MAX_RATIO):
    """Validate all bytes in private staging, then publish a *new* meeting.
    Existing meeting IDs cannot be overwritten. Failed staging is discarded.
    """
    repository = Path(repository)
    repository.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='.mochop-stage-', dir=repository) as staging:
        stage = Path(staging)
        with zipfile.ZipFile(archive, 'r', allowZip64=True) as z:
            infos = z.infolist()
            if len(infos) > MAX_FILES:
                raise BackupError('too many entries')
            seen = set()
            entries = {}
            total = 0
            for info in infos:
                path = clean_path(info.filename)
                folded = path.casefold()
                if folded in seen:
                    raise BackupError('collision/duplicate path')
                seen.add(folded)
                if info.flag_bits & 1 or info.is_dir() or (info.external_attr >> 16) & 0o170000 == stat.S_IFLNK:
                    raise BackupError('directory/symlink not allowed')
                total += info.file_size
                if total > max_total:
                    raise BackupError('uncompressed size limit')
                if info.file_size > max(1, info.compress_size) * max_ratio:
                    raise BackupError('ZIP bomb ratio')
                entries[path] = info
            if 'manifest.json' not in entries:
                raise BackupError('manifest missing')
            with z.open('manifest.json') as f:
                if entries['manifest.json'].file_size > 1024 * 1024:
                    raise BackupError('manifest too large')
                manifest = json.loads(f.read().decode('utf-8'))
            if manifest.get('format') != FORMAT or manifest.get('formatVersion') != VERSION or manifest.get('schemaVersion') != 1:
                raise BackupError('unsupported format/schema')
            listed = {}
            for item in manifest.get('files', []):
                path = clean_path(item['path'])
                if path in listed:
                    raise BackupError('duplicate manifest file')
                if not isinstance(item.get('size'), int) or item['size'] < 0 or not re.fullmatch('[0-9a-f]{64}', item.get('sha256', '')):
                    raise BackupError('invalid checksum metadata')
                if path == 'manifest.json' or path.casefold() in {key.casefold() for key in listed}:
                    raise BackupError('manifest self-reference or casefold duplicate')
                listed[path] = item
            missing = set(listed) - set(entries)
            if missing and not allow_missing_audio:
                raise BackupError('missing files: ' + str(sorted(missing)))
            if missing and any(not p.startswith('audio/') for p in missing):
                raise BackupError('missing required metadata')
            if set(entries) - {'manifest.json'} - set(listed):
                raise BackupError('unlisted entries')
            for required in ('meeting.json', 'note.json', 'audio-manifest.json'):
                if required not in listed:
                    raise BackupError('required file not declared')
            for name, item in listed.items():
                if name in missing:
                    continue
                if entries[name].file_size != item['size']:
                    raise BackupError('size mismatch: ' + name)
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with z.open(name) as inp, target.open('wb') as out:
                    size, sha = digest_copy(inp, out)
                if size != item['size'] or sha != item['sha256']:
                    raise BackupError('checksum mismatch: ' + name)
        meeting = json.loads((stage/'meeting.json').read_text('utf-8'))
        note = json.loads((stage/'note.json').read_text('utf-8'))
        audio = json.loads((stage/'audio-manifest.json').read_text('utf-8'))
        validate_contract(meeting, note, audio)
        if manifest['meetingIds'] != [meeting['meetingId']]:
            raise BackupError('meeting ID mismatch')
        declared = {x['filePath'] for x in audio.get('segments', [])}
        if any(p not in listed for p in declared):
            raise BackupError('audio segment not declared')
        if any(p not in declared for p in listed if p.startswith('audio/')):
            raise BackupError('orphan audio entry')
        for seg in audio.get('segments', []):
            if seg['filePath'] in missing:
                seg['completionState'] = 'missing'
                seg['missingReason'] = 'restore_source_missing'
        if missing:
            (stage/'audio-manifest.json').write_bytes(json_bytes(audio))
        meeting_id = str(meeting['meetingId'])
        if not re.fullmatch('[a-zA-Z0-9_-]{1,128}', meeting_id):
            raise BackupError('invalid meeting ID')
        target = repository / meeting_id
        # Cooperative exclusive inter-process reservation. Never replace an existing
        # meeting; a crashed writer may leave a stale lock requiring safe recovery.
        lock_path = repository / ('.restore-lock-' + meeting_id)
        try:
            lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise BackupError('meeting restore already running: ' + meeting_id) from exc
        try:
            os.close(lock_fd)
            if target.exists():
                raise BackupError('meeting collision: ' + meeting_id)
            # Only cooperating importers share this lock; production requires
            # IndexedDB atomic pointer publication, as in the JS staging adapter.
            os.rename(stage, target)
        finally:
            lock_path.unlink(missing_ok=True)
        return {'meetingId': meeting_id, 'missingAudio': sorted(missing),
                'seconds': time.perf_counter()-started, 'files': len(listed)}


def make_fixture(dest: Path, audio_bytes: int):
    dest = Path(dest)
    if dest.exists():
        raise BackupError('fixture destination exists')
    (dest/'audio').mkdir(parents=True)
    meeting = {'meetingId': 'meeting-demo', 'title': 'Họp thử tiếng Việt',
               'noteDocumentId': 'note-demo', 'recordingIds': ['recording-demo'], 'schemaVersion': 1}
    mark = {'type': 'timeSpan', 'attrs': {'anchorId': 'anchor-1', 'recordingId':'recording-demo',
             'audioOffsetMs': 12345, 'typedAt': 1794740000000, 'source':'live_recording', 'schemaVersion':1}}
    note = {'noteDocumentId':'note-demo', 'revision':3, 'schemaVersion':1,
            'content': {'type':'doc', 'content':[{'type':'paragraph', 'content':[
               {'type':'text', 'text':'Nội dung cuộc họp và mốc.', 'marks':[mark]}]}]}}
    audio = {'recordingId':'recording-demo', 'sampleRate':48000, 'mappingPoints':[],
             'segments':[{'segmentId':'segment-1','filePath':'audio/segment-1.pcm',
                         'mediaStartMs':0,'mediaDurationMs':60000, 'sampleStart':0,
                         'sampleCount':2880000,'completionState':'complete'}],
             'intervals':[{'meetingStartMs':0,'meetingEndMs':60000,'kind':'recorded',
                           'segmentRefs':['segment-1'],'mediaStartMs':0,'mediaEndMs':60000}]}
    for name, obj in (('meeting.json', meeting), ('note.json',note), ('audio-manifest.json', audio)):
        (dest/name).write_bytes(json_bytes(obj))
    # Deterministic non-compressible-ish bytes, bounded memory, synthetic only.
    pattern = hashlib.shake_256(b'MOC-HOP-SYNTHETIC-AUDIO-FIXTURE').digest(BLOCK)
    with (dest/'audio/segment-1.pcm').open('wb') as f:
        whole, remain = divmod(audio_bytes, BLOCK)
        for _ in range(whole):
            f.write(pattern)
        if remain:
            f.write(pattern[:remain])
    return dest


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    a=sub.add_parser('fixture');a.add_argument('destination');a.add_argument('--bytes',type=int,default=1024*1024)
    a=sub.add_parser('export');a.add_argument('source');a.add_argument('destination');a.add_argument('--deflate',action='store_true')
    a=sub.add_parser('import');a.add_argument('archive');a.add_argument('repository');a.add_argument('--allow-missing-audio',action='store_true')
    args=parser.parse_args()
    if args.command=='fixture': output={'path':str(make_fixture(Path(args.destination),args.bytes))}
    elif args.command=='export': output=export_archive(Path(args.source),Path(args.destination),zipfile.ZIP_DEFLATED if args.deflate else zipfile.ZIP_STORED)
    else: output=import_archive(Path(args.archive),Path(args.repository),allow_missing_audio=args.allow_missing_audio)
    print(json.dumps(output,ensure_ascii=False))

if __name__ == '__main__':
    main()
